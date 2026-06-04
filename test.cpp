#include <iostream>
#include "shared/mixmind_protocol.h"
int main() {
    std::cout << "ChannelSlot size: " << sizeof(ChannelSlot) << std::endl;
    std::cout << "SharedMemoryLayout size: " << sizeof(SharedMemoryLayout) << std::endl;
    return 0;
}
