import Foundation

/// Parser for Dockerfile format
public struct DockerfileParser {

    public init() {}

    public func parse(dockerfile: URL) throws -> [DockerfileInstruction] {
        let content = try String(contentsOf: dockerfile, encoding: .utf8)
        return try parse(content: content)
    }

    public func parse(content: String) throws -> [DockerfileInstruction] {
        var instructions: [DockerfileInstruction] = []
        var currentMultiline: String?

        for line in content.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Skip comments and empty lines
            if trimmed.isEmpty || trimmed.hasPrefix("#") {
                continue
            }

            // Handle multi-line continuations
            if let multiline = currentMultiline {
                if trimmed.hasSuffix("\\") {
                    currentMultiline = multiline + " " + String(trimmed.dropLast())
                } else {
                    currentMultiline = multiline + " " + trimmed
                    if let instruction = try parseInstruction(currentMultiline!) {
                        instructions.append(instruction)
                    }
                    currentMultiline = nil
                }
                continue
            }

            if trimmed.hasSuffix("\\") {
                currentMultiline = String(trimmed.dropLast())
                continue
            }

            if let instruction = try parseInstruction(trimmed) {
                instructions.append(instruction)
            }
        }

        return instructions
    }

    private func parseInstruction(_ line: String) throws -> DockerfileInstruction? {
        let components = line.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
        guard components.count >= 1 else {
            return nil
        }

        let instructionType = components[0].uppercased()
        let arguments = components.count > 1 ? parseArguments(String(components[1])) : []

        return DockerfileInstruction(
            type: instructionType,
            arguments: arguments,
            rawLine: line
        )
    }

    private func parseArguments(_ argString: String) -> [String] {
        var args: [String] = []
        var current = ""
        var inQuotes = false
        var escapeNext = false

        for char in argString {
            if escapeNext {
                current.append(char)
                escapeNext = false
                continue
            }

            if char == "\\" {
                escapeNext = true
                continue
            }

            if char == "\"" {
                inQuotes.toggle()
                continue
            }

            if char == " " && !inQuotes {
                if !current.isEmpty {
                    args.append(current)
                    current = ""
                }
                continue
            }

            current.append(char)
        }

        if !current.isEmpty {
            args.append(current)
        }

        return args
    }
}

public struct DockerfileInstruction: Codable {
    public let type: String
    public let arguments: [String]
    public let rawLine: String

    public init(type: String, arguments: [String], rawLine: String) {
        self.type = type
        self.arguments = arguments
        self.rawLine = rawLine
    }

    /// Generate cache key for this instruction
    public func cacheKey(context: BuildContext, platform: BuildPlatform) throws -> String {
        let base = "\(type)-\(arguments.joined(separator: "-"))-\(platform.rawValue)"

        // For COPY instructions, include file hashes
        if type == "COPY" || type == "ADD" {
            // Hash source files
            let sourceHash = try hashSourceFiles(context: context)
            return "\(base)-\(sourceHash)"
        }

        return String(base.hashValue)
    }

    private func hashSourceFiles(context: BuildContext) throws -> String {
        guard let source = arguments.first else {
            return ""
        }

        let sourcePath = context.url.appendingPathComponent(source)

        guard FileManager.default.fileExists(atPath: sourcePath.path) else {
            return ""
        }

        // Quick hash using file attributes
        let attributes = try FileManager.default.attributesOfItem(atPath: sourcePath.path)
        let size = attributes[.size] as? Int64 ?? 0
        let modDate = attributes[.modificationDate] as? Date ?? Date()

        return "\(size)-\(modDate.timeIntervalSince1970)"
    }
}

// OCI Image Manifest format
public struct OCIManifest: Codable {
    public let schemaVersion: Int
    public let mediaType: String
    public let config: OCIDescriptor
    public let layers: [OCIDescriptor]

    public init(schemaVersion: Int, mediaType: String, config: OCIDescriptor, layers: [OCIDescriptor]) {
        self.schemaVersion = schemaVersion
        self.mediaType = mediaType
        self.config = config
        self.layers = layers
    }
}

public struct OCIDescriptor: Codable {
    public let mediaType: String
    public let digest: String
    public let size: Int64

    public init(mediaType: String, digest: String, size: Int64) {
        self.mediaType = mediaType
        self.digest = digest
        self.size = size
    }
}
