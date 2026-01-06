import Foundation

// Minimal test of VMLogger path
let logFile = FileManager.default.temporaryDirectory.appendingPathComponent("vibecode-vm.log")
print("VMLogger will write to: \(logFile.path)")

// Test if we can write
let testData = "Test log entry\n".data(using: .utf8)!
do {
    try testData.write(to: logFile)
    print("✓ Successfully wrote to log file")
    
    let content = try String(contentsOf: logFile, encoding: .utf8)
    print("✓ Successfully read back: \(content)")
} catch {
    print("✗ Error: \(error)")
}
