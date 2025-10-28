import XCTest
@testable import LimaLauncherCore

final class LimaLauncherTests: XCTestCase {
  func testOptionsInit() {
    let opts = LimaOptions(name: "demo", configPath: "vm-assets/ide-lima.yaml")
    XCTAssertEqual(opts.name, "demo")
    XCTAssertEqual(opts.configPath, "vm-assets/ide-lima.yaml")
  }
}
