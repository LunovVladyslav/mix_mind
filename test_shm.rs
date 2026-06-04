use shared_memory::ShmemConf;

fn main() {
    println!("Testing SHM...");
    let names = vec!["MixMindBridge", "Global\\MixMindBridge", "Local\\MixMindBridge"];
    
    for name in names {
        match ShmemConf::new().os_id(name).open() {
            Ok(shm) => {
                println!("Successfully opened: {}", name);
                println!("Size: {}", shm.len());
                let magic = unsafe { *(shm.as_ptr() as *const u32).add(1) };
                println!("Magic: 0x{:X} (Expected: 0x4D4D4D42)", magic);
            }
            Err(e) => {
                println!("Failed to open {}: {}", name, e);
            }
        }
    }
}
