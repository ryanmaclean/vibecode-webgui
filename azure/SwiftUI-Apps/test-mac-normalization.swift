#!/usr/bin/env swift
//
// test-mac-normalization.swift
// Quick test runner for MAC address normalization
//
// Usage:
//   swift test-mac-normalization.swift
//

import Foundation

/// Normalize MAC address format by padding octets with leading zeros
func normalizeMACAddress(_ mac: String) -> String {
    let octets = mac.split(separator: ":")
    let normalized = octets.map { octet in
        // Pad single-digit octets with leading zero
        return octet.count == 1 ? "0\(octet)" : String(octet)
    }
    return normalized.joined(separator: ":")
}

print("\n" + String(repeating: "=", count: 70))
print("DHCP LEASE MONITOR - MAC ADDRESS NORMALIZATION TEST")
print(String(repeating: "=", count: 70) + "\n")

print("Testing MAC address normalization to fix port forwarding bug...\n")

// Test cases
let testCases: [(input: String, expected: String, description: String)] = [
    // Real-world case from the bug report
    ("52:54:0:e0:17:c3", "52:54:00:e0:17:c3", "Bug case: Apple DHCP format"),
    ("52:54:00:e0:17:c3", "52:54:00:e0:17:c3", "Bug case: Standard format (no change)"),

    // Additional test cases
    ("52:54:0:0:0:1", "52:54:00:00:00:01", "Multiple single-digit octets"),
    ("a:b:c:d:e:f", "0a:0b:0c:0d:0e:0f", "All single hex digits"),
    ("1:2:3:4:5:6", "01:02:03:04:05:06", "All single decimal digits"),
    ("ff:ff:ff:ff:ff:ff", "ff:ff:ff:ff:ff:ff", "Broadcast MAC (no change)"),
    ("0:0:0:0:0:0", "00:00:00:00:00:00", "Zero MAC"),
]

var totalTests = 0
var passedTests = 0
var failedTests = 0

for (input, expected, description) in testCases {
    totalTests += 1
    let result = normalizeMACAddress(input)
    let passed = result == expected

    if passed {
        passedTests += 1
        print("✅ PASS: \(description)")
        print("   Input:    \(input)")
        print("   Expected: \(expected)")
        print("   Result:   \(result)")
    } else {
        failedTests += 1
        print("❌ FAIL: \(description)")
        print("   Input:    \(input)")
        print("   Expected: \(expected)")
        print("   Result:   \(result)")
    }
    print()
}

// Test comparison logic
print(String(repeating: "-", count: 70))
print("TESTING MAC COMPARISON WITH NORMALIZATION")
print(String(repeating: "-", count: 70) + "\n")

let dhcpMAC = "52:54:0:e0:17:c3"  // From DHCP lease file (Apple format)
let searchMAC = "52:54:00:e0:17:c3" // From NATNetworkStrategy (standard format)

print("Real-world scenario:")
print("  DHCP lease file has:   \(dhcpMAC)")
print("  Searching for:         \(searchMAC)")
print()

let normalizedDHCP = normalizeMACAddress(dhcpMAC)
let normalizedSearch = normalizeMACAddress(searchMAC)

print("After normalization:")
print("  DHCP MAC:   \(normalizedDHCP)")
print("  Search MAC: \(normalizedSearch)")
print()

let matches = normalizedDHCP.uppercased() == normalizedSearch.uppercased()
print("Result: \(matches ? "✅ MATCH" : "❌ NO MATCH")")

if matches {
    print("SUCCESS! DHCPLeaseMonitor will find the IP address.")
    print("Port forwarding will work correctly.")
} else {
    print("FAILURE! DHCPLeaseMonitor will NOT find the IP address.")
    print("Port forwarding will fail.")
}
print()

// Summary
print(String(repeating: "=", count: 70))
print("TEST SUMMARY")
print(String(repeating: "=", count: 70))
print("Total tests:  \(totalTests)")
print("Passed:       \(passedTests) ✅")
print("Failed:       \(failedTests) \(failedTests > 0 ? "❌" : "")")
print("Success rate: \(totalTests > 0 ? (passedTests * 100 / totalTests) : 0)%")
print()

if failedTests == 0 && matches {
    print("✅ ALL TESTS PASSED - MAC normalization fix is working correctly!")
    print()
    print("Next steps:")
    print("  1. Rebuild the affected apps (BasicVibeCodeApp, LiquidGlassVibeCodeApp)")
    print("  2. Test with a real VM to verify port forwarding works")
    print("  3. Check DHCP lease file format: sudo cat /var/db/dhcpd_leases")
} else {
    print("❌ SOME TESTS FAILED - Review the implementation")
}

print(String(repeating: "=", count: 70) + "\n")
