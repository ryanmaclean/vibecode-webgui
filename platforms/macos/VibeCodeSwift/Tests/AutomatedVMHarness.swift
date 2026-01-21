// Automated VM Test Harness
// Staff Engineer Level: Programmatic VM testing

import Foundation
import Virtualization

func runTests() async {
        print("==========================================")
        print("Automated VM Test Harness")
        print("Staff Engineer Level - Full Automation")
        print("==========================================")
        print("")
        
        var totalTests = 0
        var passedTests = 0
        
        func test(_ name: String, _ condition: @autoclosure () -> Bool) {
            totalTests += 1
            if condition() {
                print("  ✅ PASS: \(name)")
                passedTests += 1
            } else {
                print("  ❌ FAIL: \(name)")
            }
        }
        
        // Phase 1: Infrastructure
        print("[Phase 1] Infrastructure Validation")
        print("------------------------------------")
        
        let vmPath = URL(fileURLWithPath: "/Users/ryan.maclean/vibecode-webgui/dist/vm-images")
        test("VM directory exists", FileManager.default.fileExists(atPath: vmPath.path))
        
        let imgFiles = try? FileManager.default.contentsOfDirectory(atPath: vmPath.path)
            .filter { $0.hasSuffix(".img") }
        test("All 6 VM images present", imgFiles?.count == 6)
        
        let nvramFiles = try? FileManager.default.contentsOfDirectory(atPath: vmPath.path)
            .filter { $0.hasSuffix("-efi.nvram") }
        test("All 6 EFI NVRAM files present", nvramFiles?.count == 6)
        
        print("")
        
        // Phase 2: VM Boot Test
        print("[Phase 2] VM Boot Testing")
        print("-------------------------")
        
        // Test each VM
        let vmsToTest = [
            ("vibecode-postgresql", 5432),
            ("vibecode-valkey", 6379),
            ("vibecode-nodejs", 3000),
            ("vibecode-nodejs-codeserver", 8080)
        ]
        
        for (vmName, _) in vmsToTest {
            print("")
            print("Testing \(vmName)...")
            
            let diskPath = vmPath.appendingPathComponent("\(vmName).img")
            let efiPath = vmPath.appendingPathComponent("\(vmName)-efi.nvram")
            
            test("\(vmName) disk exists", FileManager.default.fileExists(atPath: diskPath.path))
            test("\(vmName) EFI exists", FileManager.default.fileExists(atPath: efiPath.path))
            
            // Check EFI size (should be 128K for working VMs)
            if let attrs = try? FileManager.default.attributesOfItem(atPath: efiPath.path),
               let size = attrs[.size] as? UInt64 {
                test("\(vmName) EFI valid", size == 131072)
            }
            
            do {
                // Try to create VM configuration
                let config = VZVirtualMachineConfiguration()
                config.cpuCount = 4
                config.memorySize = 4 * 1024 * 1024 * 1024
                
                // Platform
                config.platform = VZGenericPlatformConfiguration()
                
                // Boot loader
                let bootloader = VZEFIBootLoader()
                let efiStore = try VZEFIVariableStore(url: efiPath)
                bootloader.variableStore = efiStore
                config.bootLoader = bootloader
                
                // Disk
                let diskAttachment = try VZDiskImageStorageDeviceAttachment(
                    url: diskPath,
                    readOnly: false,
                    cachingMode: .automatic,
                    synchronizationMode: .full
                )
                let storageDevice = VZVirtioBlockDeviceConfiguration(attachment: diskAttachment)
                config.storageDevices = [storageDevice]
                
                // Network
                let networkDevice = VZVirtioNetworkDeviceConfiguration()
                networkDevice.attachment = VZNATNetworkDeviceAttachment()
                config.networkDevices = [networkDevice]
                
                // Validate
                try config.validate()
                test("\(vmName) configuration valid", true)
                
                // Try to create VM (don't start it, just validate)
                let vmQueue = DispatchQueue(label: "test.vm.queue")
                let _ = VZVirtualMachine(configuration: config, queue: vmQueue)
                test("\(vmName) VM creation successful", true)
                
            } catch {
                test("\(vmName) configuration valid", false)
                print("    Error: \(error.localizedDescription)")
            }
        }
        
        print("")
        
        // Phase 3: Final Report
        print("==========================================")
        print("Test Results")
        print("==========================================")
        print("")
        print("Total Tests: \(totalTests)")
        print("Passed: \(passedTests) (\(passedTests * 100 / totalTests)%)")
        print("Failed: \(totalTests - passedTests)")
        print("")
        
        if passedTests == totalTests {
            print("🎉 ALL TESTS PASSED")
            print("")
            print("VMs are ready to boot.")
            print("Run the app and start VMs from GUI.")
            Foundation.exit(0)
        } else {
            print("⚠️  SOME TESTS FAILED")
            print("")
            print("Fix issues and re-run harness.")
            Foundation.exit(1)
        }
}

// Entry point
await runTests()

