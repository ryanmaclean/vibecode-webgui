#if canImport(XCTest)
import XCTest
@testable import VibeCodeCore

final class IDEProcessManagerTests: XCTestCase {
    func testBuildLaunch_VibeCode_CommandIncludesServeWeb() {
        let mgr = IDEProcessManager()
        mgr.preferences.ddTraceEnabled = false
        let bin = URL(fileURLWithPath: "/opt/homebrew/bin/vibecode")
        let (args, env) = mgr.buildLaunch(
            binary: bin,
            port: 8080,
            userDataDir: "/tmp/user-data",
            extensionsDir: "/tmp/extensions",
            workspace: "/tmp/ws"
        )
        XCTAssertEqual(args.first, "serve-web")
        XCTAssertTrue(args.contains("--host"))
        XCTAssertTrue(args.contains("127.0.0.1"))
        XCTAssertTrue(args.contains("--port"))
        XCTAssertTrue(args.contains("8080"))
        XCTAssertTrue(args.contains("--user-data-dir"))
        XCTAssertTrue(args.contains("/tmp/user-data"))
        XCTAssertTrue(args.contains("--extensions-dir"))
        XCTAssertTrue(args.contains("/tmp/extensions"))
        XCTAssertTrue(args.contains("/tmp/ws"))
        XCTAssertNil(env["DD_TRACE_ENABLED"])
        XCTAssertEqual(env["DD_SERVICE"], "vibecode")
        XCTAssertEqual(env["DD_ENV"], "vibecode")
    }

    func testBuildLaunch_OpenVSCode_NoTrace() {
        let mgr = IDEProcessManager()
        mgr.preferences.ddTraceEnabled = false
        let bin = URL(fileURLWithPath: "/opt/homebrew/bin/openvscode-server")
        let (args, env) = mgr.buildLaunch(binary: bin,
                                          port: 8080,
                                          userDataDir: "/tmp/user-data",
                                          extensionsDir: "/tmp/extensions",
                                          workspace: "/tmp/ws")
        // Args include host/port and directories
        XCTAssertTrue(args.contains("--host"))
        XCTAssertTrue(args.contains("127.0.0.1"))
        XCTAssertTrue(args.contains("--port"))
        XCTAssertTrue(args.contains("8080"))
        XCTAssertTrue(args.contains("--user-data-dir"))
        XCTAssertTrue(args.contains("/tmp/user-data"))
        XCTAssertTrue(args.contains("--extensions-dir"))
        XCTAssertTrue(args.contains("/tmp/extensions"))
        // Workspace is appended after --
        XCTAssertTrue(args.contains("/tmp/ws"))
        // dd-trace disabled by default
        XCTAssertNil(env["DD_TRACE_ENABLED"])
        XCTAssertFalse((env["NODE_OPTIONS"] ?? "").contains("dd-trace/init"))
        XCTAssertEqual(env["DD_SERVICE"], "vibecode")
        XCTAssertEqual(env["DD_ENV"], "vibecode")
    }

    func testBuildLaunch_OpenVSCode_WithTrace() {
        let mgr = IDEProcessManager()
        mgr.preferences.ddTraceEnabled = true
        let bin = URL(fileURLWithPath: "/opt/homebrew/bin/openvscode-server")
        let (_, env) = mgr.buildLaunch(binary: bin,
                                       port: 8080,
                                       userDataDir: "/tmp/user-data",
                                       extensionsDir: "/tmp/extensions",
                                       workspace: nil)
        XCTAssertEqual(env["DD_TRACE_ENABLED"], "true")
        XCTAssertTrue((env["NODE_OPTIONS"] ?? "").contains("dd-trace/init"))
    }

    func testBuildLaunch_CodeServer() {
        let mgr = IDEProcessManager()
        mgr.preferences.ddTraceEnabled = false
        let bin = URL(fileURLWithPath: "/opt/homebrew/bin/code-server")
        let (args, _) = mgr.buildLaunch(binary: bin,
                                        port: 9090,
                                        userDataDir: "/tmp/u",
                                        extensionsDir: "/tmp/e",
                                        workspace: "/tmp/w")
        // code-server uses --bind-addr host:port
        XCTAssertTrue(args.contains("--bind-addr"))
        XCTAssertTrue(args.contains("127.0.0.1:9090"))
        XCTAssertTrue(args.contains("/tmp/w"))
    }
}
#endif
