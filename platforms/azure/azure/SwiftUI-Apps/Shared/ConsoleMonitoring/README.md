# Console Monitoring Components

**Purpose:** VM console output monitoring and parsing
**Status:** Phase 1 - Core Infrastructure

---

## Overview

Console monitoring is built into BaseVMManager. This directory is reserved for:

- Advanced console parsers
- Pattern matching utilities
- Log aggregation
- Custom console handlers

---

## Current Implementation

BaseVMManager provides automatic console monitoring:

```swift
// Automatic in BaseVMManager
@Published public var consoleOutput: String
```

---

## Custom Console Patterns

Override `checkServerReady()` in your VM manager:

```swift
override func checkServerReady(consoleOutput: String) -> String? {
    if consoleOutput.contains("My custom server ready message") {
        return "http://localhost:8080"
    }
    return nil
}
```

---

## Future Components

- ConsoleParser protocol
- PatternMatcher utility
- LogAggregator for multi-VM scenarios
- Custom console output handlers

---

## Reference

See [Core/README.md](../Core/README.md) for BaseVMManager console monitoring details.
