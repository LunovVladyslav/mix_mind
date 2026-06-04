// MixMind Bridge — SharedMemoryWriter implementation

#include "SharedMemoryWriter.h"
#include <thread>
#include <chrono>
#include <ctime>

#ifdef _WIN32
  #define WIN32_LEAN_AND_MEAN
  #include <windows.h>
  #include <intrin.h>
#else
  #include <sys/mman.h>
  #include <sys/stat.h>
  #include <fcntl.h>
  #include <unistd.h>
#endif

static const size_t kShmSize = sizeof(SharedMemoryLayout);

SharedMemoryWriter::SharedMemoryWriter() = default;

SharedMemoryWriter::~SharedMemoryWriter()
{
    close();
}

bool SharedMemoryWriter::open()
{
    if (m_isOpen) return true;

#ifdef _WIN32
    // ── Windows implementation ─────────────────────────────────────────
    m_hMapFile = CreateFileMappingA(
        INVALID_HANDLE_VALUE,     // Use paging file
        nullptr,                  // Default security
        PAGE_READWRITE,           // Read/write access
        0,                        // High-order DWORD of size
        (DWORD)kShmSize,          // Low-order DWORD of size
        MIXMIND_SHM_NAME          // Name of mapping object
    );

    if (m_hMapFile == nullptr)
        return false;

    bool isNew = (GetLastError() != ERROR_ALREADY_EXISTS);

    m_layout = static_cast<SharedMemoryLayout*>(
        MapViewOfFile(m_hMapFile, FILE_MAP_ALL_ACCESS, 0, 0, kShmSize)
    );

    if (!m_layout)
    {
        CloseHandle(m_hMapFile);
        m_hMapFile = nullptr;
        return false;
    }

    if (isNew)
    {
        memset(m_layout, 0, kShmSize);
        m_layout->magic   = MIXMIND_MAGIC;
        m_layout->version = MIXMIND_VERSION;
        m_layout->slot_count = 0;
    }

#else
    // ── POSIX implementation (macOS / Linux) ───────────────────────────
    m_shmFd = shm_open("/" MIXMIND_SHM_NAME, O_CREAT | O_RDWR, 0666);
    if (m_shmFd < 0) return false;

    // Resize to required size
    if (ftruncate(m_shmFd, kShmSize) < 0)
    {
        ::close(m_shmFd);
        m_shmFd = -1;
        return false;
    }

    m_layout = static_cast<SharedMemoryLayout*>(
        mmap(nullptr, kShmSize, PROT_READ | PROT_WRITE, MAP_SHARED, m_shmFd, 0)
    );

    if (m_layout == MAP_FAILED)
    {
        m_layout = nullptr;
        ::close(m_shmFd);
        m_shmFd = -1;
        return false;
    }

    // Initialize if this is a fresh block
    if (m_layout->magic != MIXMIND_MAGIC)
    {
        memset(m_layout, 0, kShmSize);
        m_layout->magic   = MIXMIND_MAGIC;
        m_layout->version = MIXMIND_VERSION;
        m_layout->slot_count = 0;
    }
#endif

    m_isOpen = true;
    return true;
}

void SharedMemoryWriter::close()
{
    if (!m_isOpen || !m_layout) return;

#ifdef _WIN32
    UnmapViewOfFile(m_layout);
    CloseHandle(m_hMapFile);
    m_hMapFile = nullptr;
#else
    munmap(m_layout, kShmSize);
    ::close(m_shmFd);
    m_shmFd = -1;
#endif

    m_layout = nullptr;
    m_isOpen = false;
}

void SharedMemoryWriter::writeSlot(const ChannelSlot& slot)
{
    if (!m_isOpen || !m_layout) return;

    acquireLock();

    // Find existing slot for this instance, or claim a new one
    int idx = findSlotIndex(slot.instance_id);

    if (idx < 0)
    {
        // Find a free slot (inactive or empty)
        for (int i = 0; i < MIXMIND_MAX_CHANNELS; ++i)
        {
            if (!m_layout->slots[i].is_active)
            {
                idx = i;
                break;
            }
        }
    }

    if (idx >= 0)
    {
        m_layout->slots[idx] = slot;
        m_ownSlotIndex = idx;

        // Update slot count if needed
        if ((uint32_t)(idx + 1) > m_layout->slot_count)
            m_layout->slot_count = idx + 1;
    }

    releaseLock();
}

void SharedMemoryWriter::markInactive(const char* instanceId)
{
    if (!m_isOpen || !m_layout) return;

    acquireLock();

    int idx = findSlotIndex(instanceId);
    if (idx >= 0)
        m_layout->slots[idx].is_active = 0;

    releaseLock();
}

int SharedMemoryWriter::findSlotIndex(const char* instanceId) const
{
    if (!m_layout) return -1;

    for (int i = 0; i < MIXMIND_MAX_CHANNELS; ++i)
    {
        if (strncmp(m_layout->slots[i].instance_id, instanceId, 64) == 0)
            return i;
    }
    return -1;
}

void SharedMemoryWriter::acquireLock()
{
    if (!m_layout) return;

    // Spinlock with 2ms timeout to avoid stalling the audio thread
    auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(2);

    while (true)
    {
        uint32_t expected = MIXMIND_LOCK_FREE;
#ifdef _WIN32
        if (_InterlockedCompareExchange((volatile long*)&m_layout->spinlock, MIXMIND_LOCK_HELD, expected) == expected)
            return;
#else
        if (__atomic_compare_exchange_n(
                &m_layout->spinlock, &expected, MIXMIND_LOCK_HELD,
                false, __ATOMIC_ACQUIRE, __ATOMIC_RELAXED))
            return;
#endif

        if (std::chrono::steady_clock::now() >= deadline)
            return; // Proceed anyway to avoid audio thread stall

        std::this_thread::yield();
    }
}

void SharedMemoryWriter::releaseLock()
{
    if (!m_layout) return;
#ifdef _WIN32
    _InterlockedExchange((volatile long*)&m_layout->spinlock, MIXMIND_LOCK_FREE);
#else
    __atomic_store_n(&m_layout->spinlock, MIXMIND_LOCK_FREE, __ATOMIC_RELEASE);
#endif
}
