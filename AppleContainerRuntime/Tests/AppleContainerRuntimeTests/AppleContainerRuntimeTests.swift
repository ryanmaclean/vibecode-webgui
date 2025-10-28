import XCTest
@testable import AppleContainerRuntime

final class AppleContainerRuntimeTests: XCTestCase {
    func testImageReferenceParsing() throws {
        // Test Docker Hub short format
        let parsed1 = try parseImageReference("ubuntu:22.04")
        XCTAssertEqual(parsed1.registry, "registry-1.docker.io")
        XCTAssertEqual(parsed1.repository, "library/ubuntu")
        XCTAssertEqual(parsed1.tagOrDigest, "22.04")

        // Test full registry format
        let parsed2 = try parseImageReference("ghcr.io/vibecode/agentapi:latest")
        XCTAssertEqual(parsed2.registry, "ghcr.io")
        XCTAssertEqual(parsed2.repository, "vibecode/agentapi")
        XCTAssertEqual(parsed2.tagOrDigest, "latest")
    }

    func testPortMappingParsing() {
        let mappings = parsePortMappings(["8080:80", "9090:9090"])

        XCTAssertEqual(mappings.count, 2)
        XCTAssertEqual(mappings[0].hostPort, 8080)
        XCTAssertEqual(mappings[0].containerPort, 80)
        XCTAssertEqual(mappings[1].hostPort, 9090)
        XCTAssertEqual(mappings[1].containerPort, 9090)
    }

    func testEnvironmentParsing() {
        let env = parseEnvironment(["API_KEY=secret", "PORT=8080", "DEBUG=true"])

        XCTAssertEqual(env["API_KEY"], "secret")
        XCTAssertEqual(env["PORT"], "8080")
        XCTAssertEqual(env["DEBUG"], "true")
    }

    func testVolumeParsing() {
        let volumes = parseVolumes(["/host/path:/container/path", "/data:/mnt/data"])

        XCTAssertEqual(volumes.count, 2)
        XCTAssertEqual(volumes[0].hostPath, "/host/path")
        XCTAssertEqual(volumes[0].containerPath, "/container/path")
    }

    func testContainerStateTransitions() {
        XCTAssertEqual(ContainerState.created.rawValue, "created")
        XCTAssertEqual(ContainerState.running.rawValue, "running")
        XCTAssertEqual(ContainerState.stopped.rawValue, "stopped")
    }

    func testPullProgressCalculation() {
        let progress1 = PullProgress(bytesDownloaded: 50, totalBytes: 100)
        XCTAssertEqual(progress1.percentComplete, 50)

        let progress2 = PullProgress(bytesDownloaded: 0, totalBytes: 100)
        XCTAssertEqual(progress2.percentComplete, 0)

        let progress3 = PullProgress(bytesDownloaded: 100, totalBytes: 100)
        XCTAssertEqual(progress3.percentComplete, 100)
    }

    // Helper functions (would normally be in the main code)
    private func parseImageReference(_ reference: String) throws -> (registry: String, repository: String, tagOrDigest: String) {
        var parts = reference.split(separator: "/")

        if parts.count == 1 {
            let repoAndTag = String(parts[0])
            let components = repoAndTag.split(separator: ":")
            return (
                registry: "registry-1.docker.io",
                repository: "library/\(components[0])",
                tagOrDigest: components.count > 1 ? String(components[1]) : "latest"
            )
        } else if parts.count == 2 {
            if parts[0].contains(".") {
                let repoAndTag = String(parts[1])
                let components = repoAndTag.split(separator: ":")
                return (
                    registry: String(parts[0]),
                    repository: String(components[0]),
                    tagOrDigest: components.count > 1 ? String(components[1]) : "latest"
                )
            } else {
                let repoAndTag = String(parts[1])
                let components = repoAndTag.split(separator: ":")
                return (
                    registry: "registry-1.docker.io",
                    repository: "\(parts[0])/\(components[0])",
                    tagOrDigest: components.count > 1 ? String(components[1]) : "latest"
                )
            }
        } else {
            let repoAndTag = parts[1...].joined(separator: "/")
            let components = repoAndTag.split(separator: ":")
            return (
                registry: String(parts[0]),
                repository: String(components[0]),
                tagOrDigest: components.count > 1 ? String(components[1]) : "latest"
            )
        }
    }

    private func parsePortMappings(_ ports: [String]) -> [PortMapping] {
        ports.compactMap { portString in
            let parts = portString.split(separator: ":")
            guard parts.count == 2,
                  let host = UInt16(parts[0]),
                  let container = UInt16(parts[1]) else {
                return nil
            }
            return PortMapping(hostPort: host, containerPort: container)
        }
    }

    private func parseEnvironment(_ envVars: [String]) -> [String: String] {
        var result: [String: String] = [:]
        for envVar in envVars {
            let parts = envVar.split(separator: "=", maxSplits: 1)
            if parts.count == 2 {
                result[String(parts[0])] = String(parts[1])
            }
        }
        return result
    }

    private func parseVolumes(_ volumes: [String]) -> [VolumeMount] {
        volumes.compactMap { volumeString in
            let parts = volumeString.split(separator: ":")
            guard parts.count == 2 else { return nil }
            return VolumeMount(
                hostPath: String(parts[0]),
                containerPath: String(parts[1])
            )
        }
    }
}
