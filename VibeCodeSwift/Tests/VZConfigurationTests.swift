import XCTest
import Virtualization

final class VZConfigurationTests: XCTestCase {
    
    func testVZDiskAttachmentInitializer() {
        // Test that we can create a disk attachment with synchronization mode
        let tempURL = URL(fileURLWithPath: "/tmp/test-disk.img")
        
        // Create a temporary file for testing
        FileManager.default.createFile(atPath: tempURL.path, contents: Data(count: 1024))
        defer {
            try? FileManager.default.removeItem(at: tempURL)
        }
        
        do {
            let attachment = try VZDiskImageStorageDeviceAttachment(
                url: tempURL,
                readOnly: true,
                cachingMode: .automatic,
                synchronizationMode: .full
            )
            XCTAssertNotNil(attachment, "Disk attachment should be created")
        } catch {
            XCTFail("Failed to create disk attachment: \(error)")
        }
    }
    
    func testVZEFIBootLoaderAvailability() {
        let bootLoader = VZEFIBootLoader()
        XCTAssertNotNil(bootLoader, "EFI boot loader should be available")
    }
    
    func testVZGenericPlatformConfiguration() {
        let platform = VZGenericPlatformConfiguration()
        XCTAssertNotNil(platform, "Generic platform configuration should be available")
    }
    
    func testVZVirtioBlockDeviceConfiguration() {
        let tempURL = URL(fileURLWithPath: "/tmp/test-block.img")
        FileManager.default.createFile(atPath: tempURL.path, contents: Data(count: 1024))
        defer {
            try? FileManager.default.removeItem(at: tempURL)
        }
        
        do {
            let attachment = try VZDiskImageStorageDeviceAttachment(
                url: tempURL,
                readOnly: true,
                cachingMode: .automatic,
                synchronizationMode: .full
            )
            let blockDevice = VZVirtioBlockDeviceConfiguration(attachment: attachment)
            XCTAssertNotNil(blockDevice, "Virtio block device should be created")
        } catch {
            XCTFail("Failed to create block device: \(error)")
        }
    }
    
    func testVZNATNetworkAttachment() {
        let natAttachment = VZNATNetworkDeviceAttachment()
        XCTAssertNotNil(natAttachment, "NAT network attachment should be available")
    }
}

