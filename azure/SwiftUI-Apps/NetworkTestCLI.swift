import Foundation

// Command-line tool to test different VZNATNetworkDeviceAttachment configurations

// Main execution
@main
struct NetworkTestCLIMain {
    static func main() {
        print("VibeCode Network Configuration Tester")
        print("=====================================\n")

        let args = CommandLine.arguments
        if args.count > 1 {
            // Test specific configuration
            if let config = CLINetworkConfig(rawValue: args[1]) {
                let tester = NetworkTestCLIManager(config: config)
                tester.runTest(timeout: 20)
            } else {
                print("Invalid configuration: \(args[1])")
                print("Valid options: \(CLINetworkConfig.allCases.map { $0.rawValue }.joined(separator: ", "))")
            }
        } else {
            // Test all configurations
            for config in CLINetworkConfig.allCases {
                let tester = NetworkTestCLIManager(config: config)
                tester.runTest(timeout: 20)
                sleep(2) // Brief pause between tests
            }
        }

        print("\n✓ Testing complete")
    }
}
