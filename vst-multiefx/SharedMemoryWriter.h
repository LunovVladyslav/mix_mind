// MixMind Bridge — SharedMemoryWriter
// Handles the cross-platform named shared memory block.
// Platform: Windows (CreateFileMapping) + POSIX (shm_open)

#pragma once

#include <string>
#include <cstdint>
#include <cstring>
#include <atomic>

#include "../shared/mixmind_protocol.h"

class SharedMemoryWriter
{
public:
    SharedMemoryWriter();
    ~SharedMemoryWriter();

    /** Open or create the shared memory block. Call once on plugin init. */
    bool open();

    /** Release the shared memory mapping. Call on plugin destruction. */
    void close();

    /** Returns true if the shared memory is open and valid. */
    bool isOpen() const { return m_isOpen; }

    /** Write all fields of a channel slot atomically.
     *  Finds the slot by instanceId; creates a new slot if not found.
     *  @param slot The slot data to write (all fields must be populated).
     */
    void writeSlot(const ChannelSlot& slot);

    /** Mark this instance as inactive (called on plugin destruction). */
    void markInactive(const char* instanceId);

    /** Get the slot index for a given instance ID, or -1 if not found. */
    int findSlotIndex(const char* instanceId) const;

private:
    SharedMemoryLayout* m_layout = nullptr;
    bool m_isOpen = false;
    int  m_ownSlotIndex = -1;

#ifdef _WIN32
    void* m_hMapFile = nullptr;
#else
    int   m_shmFd = -1;
#endif

    /** Lock the spinlock with a timeout to prevent deadlock. */
    void acquireLock();

    /** Release the spinlock. */
    void releaseLock();
};
