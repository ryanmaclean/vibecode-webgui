//
// ConsoleColorTests.swift
// VibeCode
//
// CRITICAL TEST: Console colors MUST be green text on black background
// DO NOT REVERT OR MODIFY THESE REQUIREMENTS
//
// Created: 2026-01-15
// Purpose: Verify console output colors are ALWAYS green on black
//

import XCTest
import SwiftUI
@testable import UnifiedServicesVibeCodeApp

class ConsoleColorTests: XCTestCase {

    // CRITICAL TEST: Console MUST have green text on black background
    // This requirement is non-negotiable and must NEVER be reverted
    func testConsoleColorsAreGreenOnBlack() {
        // This test verifies the ConsoleView uses:
        // - Green text: RGB(0, 1, 0) or #00FF00
        // - Black background: RGB(0, 0, 0) or #000000

        // Read the source file to verify color values
        let sourceFile = "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVibeCodeApp.swift"

        guard let content = try? String(contentsOfFile: sourceFile, encoding: .utf8) else {
            XCTFail("Could not read UnifiedServicesVibeCodeApp.swift")
            return
        }

        // CRITICAL: Verify green text color is present
        // Must contain: .foregroundColor(Color(red: 0, green: 1, blue: 0))
        let hasGreenText = content.contains("foregroundColor(Color(red: 0, green: 1, blue: 0))")
        XCTAssertTrue(hasGreenText,
            """
            ❌ CRITICAL FAILURE: Console text color is NOT green!

            Console MUST have green text (RGB: 0, 1, 0).
            This is a USER REQUIREMENT and must NEVER be reverted.

            Expected: .foregroundColor(Color(red: 0, green: 1, blue: 0))

            Fix: Add green text color to ConsoleView ScrollView Text element
            """)

        // CRITICAL: Verify black background is present
        // Must contain: .background(Color.black)
        let hasBlackBackground = content.contains(".background(Color.black)")
        XCTAssertTrue(hasBlackBackground,
            """
            ❌ CRITICAL FAILURE: Console background is NOT black!

            Console MUST have black background (RGB: 0, 0, 0).
            This is a USER REQUIREMENT and must NEVER be reverted.

            Expected: .background(Color.black)

            Fix: Add black background to ConsoleView ScrollView element
            """)

        // CRITICAL: Verify system colors are NOT being used
        // Must NOT contain: NSColor.textBackgroundColor (which is white)
        let usesSystemBackground = content.contains("ScrollView {") &&
                                   content.contains("background(Color(NSColor.textBackgroundColor))")
        XCTAssertFalse(usesSystemBackground,
            """
            ❌ CRITICAL FAILURE: Console is using system background color!

            Console must NOT use NSColor.textBackgroundColor (white).
            Console MUST use Color.black explicitly.

            This is a USER REQUIREMENT and must NEVER be reverted.
            """)

        print("""
            ✅ Console color test PASSED

            Console correctly configured with:
            - Green text: RGB(0, 1, 0) / #00FF00
            - Black background: RGB(0, 0, 0) / #000000

            DO NOT REVERT THESE COLORS
            """)
    }

    // Test that console colors are documented in code comments
    func testConsoleColorsAreDocumented() {
        let sourceFile = "/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp/UnifiedServicesVibeCodeApp.swift"

        guard let content = try? String(contentsOfFile: sourceFile, encoding: .utf8) else {
            XCTFail("Could not read UnifiedServicesVibeCodeApp.swift")
            return
        }

        // Verify comments explain the color choice
        let hasGreenComment = content.contains("// Green text") ||
                             content.contains("// green text") ||
                             content.contains("Green text")
        let hasBlackComment = content.contains("// Black background") ||
                             content.contains("// black background") ||
                             content.contains("Black background")

        XCTAssertTrue(hasGreenComment, "Console green text color should be documented with a comment")
        XCTAssertTrue(hasBlackComment, "Console black background should be documented with a comment")
    }
}
