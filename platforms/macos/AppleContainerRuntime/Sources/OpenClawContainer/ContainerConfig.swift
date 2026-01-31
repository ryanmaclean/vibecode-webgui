//
// Apple Container Configuration for OpenClaw
// Lightweight alternative to VM
//

import Foundation

@available(macOS 14.0, *)
struct ContainerConfig {
    
    static func createOpenClawContainer() -> ContainerDefinition {
        return ContainerDefinition(
            name: "openclaw-container",
            image: "openclaw:latest",
            resources: ContainerResources(
                cpu: 1,
                memory: "512MB",
                disk: "2GB"
            ),
            ports: [
                ContainerPort(containerPort: 18789, hostPort: 18789)
            ],
            environment: [
                "DD_SERVICE=openclaw",
                "DD_ENV=container"
            ]
        )
    }
}

struct ContainerDefinition {
    let name: String
    let image: String
    let resources: ContainerResources
    let ports: [ContainerPort]
    let environment: [String: String]
}

struct ContainerResources {
    let cpu: Int
    let memory: String
    let disk: String
}

struct ContainerPort {
    let containerPort: Int
    let hostPort: Int
}
