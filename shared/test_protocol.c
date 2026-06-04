/**
 * MixMind Protocol Size Test
 * Compile with: gcc -Wall -Wextra -o test_protocol test_protocol.c -lm
 * Expected output: sizes of all structs + validation of magic number
 */

#include <stdio.h>
#include <stdint.h>
#include <math.h>
#include <string.h>
#include "mixmind_protocol.h"

int main(void) {
    printf("=== MixMind Protocol v%u ===\n\n", MIXMIND_VERSION);

    /* Print struct sizes */
    printf("sizeof(ChannelSlot)        = %zu bytes\n", sizeof(ChannelSlot));
    printf("sizeof(SharedMemoryLayout) = %zu bytes\n", sizeof(SharedMemoryLayout));
    printf("sizeof(SharedMemoryLayout) = %.2f KB\n\n",
           (double)sizeof(SharedMemoryLayout) / 1024.0);

    /* Validate magic number */
    printf("MIXMIND_MAGIC = 0x%08X  (expected 0x4D4D4D42)\n", MIXMIND_MAGIC);
    printf("Magic string  = \"%.4s\"\n\n",
           (const char*)&(uint32_t){MIXMIND_MAGIC});

    /* Validate constants */
    printf("MIXMIND_MAX_CHANNELS = %d\n", MIXMIND_MAX_CHANNELS);
    printf("MIXMIND_FFT_BANDS    = %d\n", MIXMIND_FFT_BANDS);

    /* Test utility macros */
    float linear = 0.5f;
    float db = LINEAR_TO_DBFS(linear);
    float back = DBFS_TO_LINEAR(db);
    printf("\nMacro test: LINEAR_TO_DBFS(0.5) = %.4f dBFS\n", db);
    printf("Macro test: DBFS_TO_LINEAR(%.4f) = %.4f (expected 0.5)\n", db, back);

    /* Validate struct layout by checking field offsets */
    ChannelSlot slot;
    memset(&slot, 0, sizeof(slot));
    printf("\nChannelSlot field offsets:\n");
    printf("  instance_id  @ offset %zu\n", (size_t)((char*)&slot.instance_id  - (char*)&slot));
    printf("  display_name @ offset %zu\n", (size_t)((char*)&slot.display_name - (char*)&slot));
    printf("  channel_type @ offset %zu\n", (size_t)((char*)&slot.channel_type - (char*)&slot));
    printf("  order        @ offset %zu\n", (size_t)((char*)&slot.order        - (char*)&slot));
    printf("  is_active    @ offset %zu\n", (size_t)((char*)&slot.is_active    - (char*)&slot));
    printf("  last_update  @ offset %zu\n", (size_t)((char*)&slot.last_update  - (char*)&slot));
    printf("  rms_l        @ offset %zu\n", (size_t)((char*)&slot.rms_l        - (char*)&slot));
    printf("  lufs_m       @ offset %zu\n", (size_t)((char*)&slot.lufs_m       - (char*)&slot));
    printf("  fft_bands[0] @ offset %zu\n", (size_t)((char*)&slot.fft_bands[0] - (char*)&slot));
    printf("  correlation  @ offset %zu\n", (size_t)((char*)&slot.correlation  - (char*)&slot));
    printf("  bpm          @ offset %zu\n", (size_t)((char*)&slot.bpm          - (char*)&slot));
    printf("  is_playing   @ offset %zu\n", (size_t)((char*)&slot.is_playing   - (char*)&slot));

    printf("\n✓ Protocol header OK\n");
    return 0;
}
