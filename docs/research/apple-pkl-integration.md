# Apple Pkl Integration Research

> **Issue**: #1138 - Research: apple/pkl for config-as-code and tooling
> **Date**: 2026-02-04
> **Status**: Research Complete

## Executive Summary

This document evaluates Apple's Pkl (Programmable Configuration Language) for potential adoption in our configuration workflows. Pkl is a configuration-as-code language with rich validation, typed schemas, and code generation capabilities. After thorough analysis, we recommend **conditional adoption** for specific use cases, particularly for Tundra Dome CRD generation and schema validation.

---

## 1. Overview of Pkl

### What is Pkl?

Pkl (pronounced "Pickle") is a configuration-as-code language released by Apple on February 1, 2024, under the Apache-2.0 license. It combines the declarative nature of static data formats (JSON, YAML) with the expressivity and safety of a statically-typed programming language.

### Key Features

| Feature | Description |
|---------|-------------|
| **Typed Schemas** | Strong type system with classes, enums, and type constraints |
| **Validation** | Schema validation at evaluation time, catching errors before production |
| **Code Generation** | Generate type-safe code for Java, Kotlin, Swift, and Go |
| **Multi-format Output** | Emit JSON, YAML, XML, property files from single source |
| **Immutability** | Values cannot be changed after definition, preventing accidental modifications |
| **Programmability** | Conditions, loops, functions, and imports within configuration |
| **Sandboxing** | Security mechanisms for safe configuration evaluation |

### Language Characteristics

```pkl
// Example: Defining a typed configuration schema
class ServiceConfig {
  name: String
  replicas: Int(this >= 1)
  port: Int(this >= 1024 && this <= 65535)
  environment: "dev"|"staging"|"prod"
  resources: ResourceSpec?
}

class ResourceSpec {
  cpu: String
  memory: String
}

// Example instance
productionApi: ServiceConfig = new {
  name = "api-gateway"
  replicas = 3
  port = 8080
  environment = "prod"
  resources = new {
    cpu = "500m"
    memory = "256Mi"
  }
}
```

### How Apple Uses Pkl

Apple developed Pkl internally to manage complex configuration across their infrastructure and applications. Key use cases include:

- Kubernetes resource configuration
- Application settings management
- CI/CD pipeline configuration
- Multi-environment deployment configurations

---

## 2. Integration Opportunities

### 2.1 Tundra Dome Configuration (CRDs, Deployments)

**Current State**: Tundra Dome CRDs are defined in YAML with OpenAPI v3 schemas:
- `/infra/tundra-dome/crds/bead.yaml`
- `/infra/tundra-dome/crds/errand.yaml`
- `/infra/tundra-dome/crds/lane.yaml`
- `/infra/tundra-dome/crds/station.yaml`
- `/infra/tundra-dome/crds/playbook.yaml`
- `/infra/tundra-dome/crds/polecat.yaml`

**Pkl Opportunity**: Define CRDs with Pkl for:

```pkl
// tundra-dome/schemas/bead.pkl
amends "package://pkg.pkl-lang.org/pkl-k8s/k8s@1.0.0#/CustomResourceDefinition.pkl"

class BeadSpec {
  title: String
  description: String?
  source: "github"|"gitea"|"jira"|"manual"|"webhook"
  sourceId: String?
  sourceUrl: String?
  lane: "critical"|"standard"|"experimental" = "standard"
  assignedRole: "polecat"|"mayor"|"deacon"|"reaper"|"witness"|"overseer" = "polecat"
  assignedCrew: String?
  labels: Mapping<String, String>?
  parentBead: String?
  dueDate: String?  // ISO 8601
  maxAttempts: Int(this >= 1 && this <= 10) = 3
}

class BeadStatus {
  phase: "created"|"in-progress"|"completed"|"escalated"|"failed" = "created"
  attempts: Int = 0
  lastTransition: String?
  message: String?
  assignedPolecat: String?
  startedAt: String?
  completedAt: String?
  history: Listing<HistoryEntry>?
}
```

**Benefits**:
- Type safety for CRD definitions
- Validation constraints (e.g., `maxAttempts >= 1 && maxAttempts <= 10`)
- Generate Go types for controllers via pkl-go
- Single source of truth for CRD schema

**Kubernetes Integration**: Pkl provides official Kubernetes support through:
- `pkl-k8s`: Templates for Kubernetes resources
- `k8s.contrib.crd`: CRD generation utilities
- Command: `pkl eval package://pkg.pkl-lang.org/pkl-pantry/k8s.contrib.crd@1.0.0#/generate.pkl`

### 2.2 Settings Management (Replace JSON Configs)

**Current State**: Multiple JSON configuration files across the project:
- `/settings/tundra-defaults.json` - Tundra system defaults
- `/config/container-runtime.json` - Container runtime settings
- `/config/mcp.json` - MCP server configuration
- `/config/datadog/*.json` - Datadog dashboards and monitors

**Pkl Opportunity**: Migrate to typed Pkl configurations:

```pkl
// settings/tundra-defaults.pkl
module tundra.defaults

nat64 {
  deployMode: "per_rig"|"shared" = "per_rig"
  binaryPath = "plugins/tundra-nat64/bin/tundra-nat64"
  tags = List("service:nat64", "component:tundra-nat64")
}

sessions {
  primaryMux: "tmux"|"zellij" = "tmux"
  optionalMux: "tmux"|"zellij"|null = "zellij"
  policy = "tmux for automation + reconciler; zellij allowed for human operators."
}

openclaw {
  routing {
    critical = "mayor"
    escalation = "deacon"
    default = "deacon"
  }
}

// Output to JSON
output {
  renderer = new JsonRenderer {}
}
```

**Migration Priority**:
1. **High**: `tundra-defaults.json` - Core system configuration
2. **Medium**: `container-runtime.json` - Schema validation benefits
3. **Low**: Datadog configs - Complex but less frequently modified

### 2.3 CI/CD Pipeline Configuration

**Current State**: GitHub Actions workflows in YAML:
- `.github/workflows/*.yml`
- `.github/workflows/disabled-expensive/*.yml`

**Pkl Opportunity**: Limited. GitHub Actions requires YAML directly and does not support Pkl preprocessing in the action runner. However, Pkl could:

- Generate workflow files during development
- Validate workflow configurations before commit
- Create reusable workflow templates

```pkl
// .github/pkl/workflow-template.pkl
class Job {
  runsOn: "ubuntu-latest"|"macos-latest"|"self-hosted"
  steps: Listing<Step>
  needs: Listing<String>?
  if_: String?
}

class Step {
  name: String
  uses: String?
  run: String?
  with: Mapping<String, String>?
}
```

**Recommendation**: Lower priority for CI/CD; keep native YAML for GitHub Actions compatibility.

---

## 3. Implementation Considerations

### 3.1 CLI Installation and Usage

#### Installation Methods

**Homebrew (Recommended for macOS/Linux)**:
```bash
brew install pkl
brew install pkl-lsp  # For IDE support
```

**Manual Installation (macOS Apple Silicon)**:
```bash
curl -L -o pkl 'https://github.com/apple/pkl/releases/download/0.30.2/pkl-macos-aarch64'
chmod +x pkl
sudo mv pkl /usr/local/bin/
```

**Manual Installation (Linux amd64)**:
```bash
curl -L -o pkl 'https://github.com/apple/pkl/releases/download/0.30.2/pkl-linux-amd64'
chmod +x pkl
sudo mv pkl /usr/local/bin/
```

#### Common CLI Commands

```bash
# Evaluate Pkl module and output JSON
pkl eval config.pkl -f json

# Evaluate and write to file
pkl eval config.pkl -o config.json

# Format Pkl files
pkl format *.pkl

# Run tests
pkl test test/*.pkl

# Start REPL for interactive development
pkl repl

# Generate code for target language
pkl-gen-go --output ./generated schema.pkl
```

### 3.2 Code Generation for TypeScript/Swift

#### Officially Supported Languages

| Language | Package | Status |
|----------|---------|--------|
| Java | pkl-codegen-java | Stable |
| Kotlin | pkl-codegen-kotlin | Stable |
| Swift | pkl-swift | Stable |
| Go | pkl-go / pkl-gen-go | Stable |
| **TypeScript** | Not available | Community requested |

#### TypeScript Gap Analysis

**Current Situation**: TypeScript/JavaScript code generation is **not officially supported**. This is a significant gap given our codebase uses TypeScript extensively.

**Workarounds**:
1. **JSON Schema Generation**: Generate JSON Schema from Pkl, then use `json-schema-to-typescript`
2. **Custom Generator**: Build a Pkl-to-TypeScript generator (community effort exists)
3. **Runtime Validation**: Use Pkl CLI to validate, import JSON output in TypeScript

**Swift Code Generation** (for future iOS/macOS tooling):
```bash
# Install pkl-gen-swift
brew install pkl-gen-swift

# Generate Swift types
pkl-gen-swift --output ./Sources/Config schema.pkl
```

### 3.3 IDE Support

#### VS Code Extension

- **Extension**: `pkl-vscode` (Official Apple extension)
- **Features**: Syntax highlighting, code completion, hover documentation, go-to-definition
- **Requirement**: Java 22+ for Language Server (temporary; native binary planned)
- **Installation**: VS Code Marketplace or `ext install pkl.pkl-vscode`

**Configuration** (`.vscode/settings.json`):
```json
{
  "pkl.lsp.java.path": "/opt/homebrew/opt/openjdk@22/bin/java",
  "pkl.format.onSave": true
}
```

#### IntelliJ Plugin

- **Plugin**: `pkl-intellij` (Official Apple plugin)
- **Compatibility**: IntelliJ 2023.1+, Pkl 0.25.0+
- **Features**: Most comprehensive IDE support due to JVM ecosystem alignment
- **Installation**: JetBrains Plugin Marketplace

#### Neovim Support

- **Plugin**: `pkl-neovim`
- **Tree-sitter**: Available for syntax highlighting
- **LSP**: Works with pkl-lsp via nvim-lspconfig

---

## 4. Recommendation

### Decision: Conditional Adoption

**Recommendation**: Adopt Pkl for **specific, high-value use cases** rather than wholesale migration.

### Adoption Tiers

#### Tier 1: Adopt Now (High Value, Low Risk)

| Use Case | Rationale |
|----------|-----------|
| Tundra Dome CRD schemas | Strong typing, validation, Go codegen for controllers |
| Container runtime configuration | Schema validation, multi-environment support |
| New Kubernetes manifests | Official k8s package support |

#### Tier 2: Evaluate Further (Medium Value, Medium Risk)

| Use Case | Rationale |
|----------|-----------|
| Datadog dashboard/monitor configs | Complex JSON structures benefit from validation |
| Lima/vfkit VM configurations | Reduce YAML duplication across environments |

#### Tier 3: Do Not Adopt (Low Value or Blocked)

| Use Case | Rationale |
|----------|-----------|
| GitHub Actions workflows | GitHub requires native YAML |
| TypeScript application configs | No official codegen; use JSON Schema instead |
| Existing stable JSON configs | Migration cost outweighs benefits |

### Migration Path

#### Phase 1: Foundation (Weeks 1-2)
1. Install Pkl CLI and IDE extensions on developer machines
2. Add `pkl` to project dependencies (Homebrew in CI)
3. Create `pkl/` directory structure for schemas

#### Phase 2: Tundra Dome Migration (Weeks 3-4)
1. Define Pkl schemas for all CRD types
2. Generate YAML from Pkl for existing CRDs
3. Set up pkl-gen-go for controller type generation
4. Update CI to validate Pkl and regenerate on change

#### Phase 3: Settings Migration (Weeks 5-6)
1. Convert `tundra-defaults.json` to Pkl
2. Implement JSON output for backward compatibility
3. Update consuming code to read from generated JSON

#### Phase 4: Documentation and Training (Week 7)
1. Document Pkl patterns and conventions
2. Create onboarding guide for team
3. Establish code review guidelines for Pkl

### Alternatives Considered

| Alternative | Pros | Cons | Decision |
|-------------|------|------|----------|
| **CUE** | Strong type system, constraint validation, Google heritage | Performance issues at scale, limited IDE support | Consider for pure validation |
| **KCL** | CNCF project, Kubernetes-native, better performance | Less mature ecosystem, different paradigm | Watch for future evaluation |
| **Dhall** | Fully functional, type-safe | Steep learning curve, awkward syntax | Not recommended |
| **Jsonnet** | Mature, widely used | Weaker type system than Pkl | Pkl preferred |
| **Stay with YAML/JSON** | No migration cost, team familiarity | No validation, duplication, manual errors | Status quo fallback |

### Risk Mitigation

1. **TypeScript Gap**: Use JSON Schema bridge until official support
2. **Java Dependency for LSP**: Temporary; native binary planned
3. **Learning Curve**: Pkl syntax similar to Swift/Kotlin; manageable
4. **Vendor Lock-in**: Apache-2.0 license; active open-source community

---

## 5. References

- [Pkl Official Documentation](https://pkl-lang.org/)
- [Pkl GitHub Repository](https://github.com/apple/pkl)
- [Pkl VS Code Extension](https://github.com/apple/pkl-vscode)
- [Pkl IntelliJ Plugin](https://github.com/apple/pkl-intellij)
- [Pkl Language Server](https://github.com/apple/pkl-lsp)
- [Pkl Kubernetes Examples](https://github.com/apple/pkl-k8s-examples)
- [Pkl Go Bindings](https://pkl-lang.org/go/current/codegen.html)
- [Pkl Swift Bindings](https://github.com/apple/pkl-swift)
- [Pkl vs KCL Comparison](https://www.kcl-lang.io/blog/2024-03-22-pkl-kcl-comparison)
- [Configuration Languages Overview (KCL)](https://www.kcl-lang.io/blog/2022-declarative-config-overview)
- [InfoQ: Apple Open Sources Pkl](https://www.infoq.com/news/2024/02/apple-pkl-configuration-lang/)

---

## Appendix A: Example Pkl Structure for Tundra Dome

```
pkl/
  schemas/
    tundra/
      bead.pkl           # Bead CRD schema
      errand.pkl         # Errand CRD schema
      lane.pkl           # Lane CRD schema
      station.pkl        # Station CRD schema
      playbook.pkl       # Playbook CRD schema
      polecat.pkl        # Polecat CRD schema
    settings/
      defaults.pkl       # System defaults schema
      container.pkl      # Container runtime schema
  generated/
    crds/                # Generated YAML CRDs
    go/                  # Generated Go types
  PklProject             # Project configuration
```

## Appendix B: Sample PklProject File

```pkl
// PklProject
amends "pkl:Project"

package {
  name = "tundra-dome-config"
  version = "1.0.0"
  baseUri = "package://pkg.tundra.dome/config"
  packageZipUrl = "https://github.com/example/tundra-dome-config/releases/download/\(version)/config.zip"
}

dependencies {
  ["k8s"] = import("package://pkg.pkl-lang.org/pkl-k8s/k8s@1.0.0")
}
```
