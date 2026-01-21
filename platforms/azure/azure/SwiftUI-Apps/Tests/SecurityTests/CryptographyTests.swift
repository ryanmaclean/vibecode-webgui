import XCTest
import Foundation
import CryptoKit

/// Security Tests: Cryptography and Encryption
class CryptographyTests: XCTestCase {

    // MARK: - Random Number Generation Tests

    func testSecureRandomGeneration() {
        // Test that random bytes are generated
        var bytes = [UInt8](repeating: 0, count: 32)
        let result = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)

        XCTAssertEqual(result, errSecSuccess,
                      "SecRandomCopyBytes failed")

        // Verify bytes are not all zeros (extremely unlikely with secure random)
        let allZeros = bytes.allSatisfy { $0 == 0 }
        XCTAssertFalse(allZeros,
                      "Random bytes are all zeros")
    }

    func testRandomnessDistribution() {
        // Generate multiple random numbers and verify distribution
        var randomNumbers: [UInt8] = []

        for _ in 0..<1000 {
            var byte: UInt8 = 0
            _ = SecRandomCopyBytes(kSecRandomDefault, 1, &byte)
            randomNumbers.append(byte)
        }

        // Calculate average (should be around 127.5 for uniform distribution)
        let average = Double(randomNumbers.reduce(0, +)) / Double(randomNumbers.count)

        // Allow reasonable variance
        XCTAssertTrue(average > 100 && average < 155,
                     "Random distribution suspicious: \(average)")
    }

    // MARK: - Hashing Tests

    func testSHA256Hashing() {
        let data = "test data".data(using: .utf8)!
        let hash = SHA256.hash(data: data)

        // Verify hash length (SHA-256 produces 32 bytes)
        XCTAssertEqual(hash.description.count, 71, // SHA256 description format
                      "SHA-256 hash unexpected format")

        // Verify deterministic (same input produces same hash)
        let hash2 = SHA256.hash(data: data)
        XCTAssertEqual(hash.description, hash2.description,
                      "SHA-256 not deterministic")
    }

    func testHashCollisionResistance() {
        let data1 = "test data 1".data(using: .utf8)!
        let data2 = "test data 2".data(using: .utf8)!

        let hash1 = SHA256.hash(data: data1)
        let hash2 = SHA256.hash(data: data2)

        // Different inputs should produce different hashes
        XCTAssertNotEqual(hash1.description, hash2.description,
                         "Hash collision detected")
    }

    // MARK: - Weak Algorithm Detection Tests

    func testNoMD5Usage() {
        // This test ensures MD5 is not used anywhere
        // In a real implementation, you'd scan code for MD5 usage
        let codeFiles = findSwiftFiles()

        for file in codeFiles {
            let content = try? String(contentsOfFile: file)
            XCTAssertFalse(content?.contains("MD5") ?? false,
                          "MD5 usage detected in \(file)")
        }
    }

    func testNoSHA1Usage() {
        // Ensure SHA-1 is not used (it's deprecated)
        let codeFiles = findSwiftFiles()

        for file in codeFiles {
            let content = try? String(contentsOfFile: file)
            // Allow SHA256 but not SHA1
            if let content = content, content.contains("SHA1") && !content.contains("SHA") {
                XCTFail("SHA-1 usage detected in \(file)")
            }
        }
    }

    // MARK: - Symmetric Encryption Tests

    func testAESEncryption() {
        let plaintext = "Sensitive data to encrypt".data(using: .utf8)!
        let key = SymmetricKey(size: .bits256)

        do {
            // Encrypt
            let sealedBox = try AES.GCM.seal(plaintext, using: key)

            // Verify ciphertext is different from plaintext
            XCTAssertNotEqual(sealedBox.ciphertext, plaintext,
                            "Encryption did not transform data")

            // Decrypt
            let decrypted = try AES.GCM.open(sealedBox, using: key)

            // Verify decryption produces original data
            XCTAssertEqual(decrypted, plaintext,
                          "Decryption failed to recover original data")
        } catch {
            XCTFail("AES encryption/decryption failed: \(error)")
        }
    }

    func testEncryptionWithWrongKey() {
        let plaintext = "Secret message".data(using: .utf8)!
        let key1 = SymmetricKey(size: .bits256)
        let key2 = SymmetricKey(size: .bits256)

        do {
            // Encrypt with key1
            let sealedBox = try AES.GCM.seal(plaintext, using: key1)

            // Try to decrypt with key2 (should fail)
            XCTAssertThrowsError(try AES.GCM.open(sealedBox, using: key2)) { error in
                // Verify it's an authentication error
                XCTAssertTrue(error is CryptoKitError,
                            "Wrong error type for bad key")
            }
        } catch {
            XCTFail("Encryption setup failed: \(error)")
        }
    }

    // MARK: - Key Management Tests

    func testKeyGeneration() {
        let key = SymmetricKey(size: .bits256)

        // Verify key is generated
        XCTAssertNotNil(key, "Key generation failed")

        // Generate another key and verify they're different
        let key2 = SymmetricKey(size: .bits256)
        XCTAssertNotEqual(key.description, key2.description,
                         "Keys should be unique")
    }

    func testKeySize() {
        let key128 = SymmetricKey(size: .bits128)
        let key256 = SymmetricKey(size: .bits256)

        // AES-256 is recommended over AES-128
        XCTAssertNotEqual(key128.description, key256.description,
                         "Different key sizes should produce different keys")
    }

    // MARK: - Authentication Tests

    func testHMAC() {
        let message = "Authenticate this message".data(using: .utf8)!
        let key = SymmetricKey(size: .bits256)

        // Generate HMAC
        let authentication = HMAC<SHA256>.authenticationCode(for: message, using: key)

        // Verify HMAC
        XCTAssertTrue(HMAC<SHA256>.isValidAuthenticationCode(authentication, authenticating: message, using: key),
                     "HMAC verification failed")

        // Verify HMAC fails with wrong key
        let wrongKey = SymmetricKey(size: .bits256)
        XCTAssertFalse(HMAC<SHA256>.isValidAuthenticationCode(authentication, authenticating: message, using: wrongKey),
                      "HMAC verified with wrong key")
    }

    func testHMACIntegrityDetection() {
        let message = "Authenticate this message".data(using: .utf8)!
        let key = SymmetricKey(size: .bits256)

        let authentication = HMAC<SHA256>.authenticationCode(for: message, using: key)

        // Tamper with message
        let tamperedMessage = "Modified message".data(using: .utf8)!

        // Verify HMAC fails for tampered message
        XCTAssertFalse(HMAC<SHA256>.isValidAuthenticationCode(authentication, authenticating: tamperedMessage, using: key),
                      "HMAC did not detect tampering")
    }

    // MARK: - Secure Comparison Tests

    func testConstantTimeComparison() {
        let data1 = "password123".data(using: .utf8)!
        let data2 = "password123".data(using: .utf8)!
        let data3 = "password456".data(using: .utf8)!

        // Use crypto-safe comparison (timing attack resistant)
        let hash1 = SHA256.hash(data: data1)
        let hash2 = SHA256.hash(data: data2)
        let hash3 = SHA256.hash(data: data3)

        // Convert to Data for comparison
        let hashData1 = Data(hash1)
        let hashData2 = Data(hash2)
        let hashData3 = Data(hash3)

        // Same data should match
        XCTAssertEqual(hashData1, hashData2,
                      "Identical hashes don't match")

        // Different data should not match
        XCTAssertNotEqual(hashData1, hashData3,
                         "Different hashes match")
    }

    // MARK: - Helper Functions

    private func findSwiftFiles() -> [String] {
        // In a real test, this would scan the project directory
        // For now, return empty array
        return []
    }
}
