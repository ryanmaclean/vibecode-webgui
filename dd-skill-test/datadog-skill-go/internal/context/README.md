# Context Detector

Auto-discover service context from git repository metadata and environment variables. This makes Datadog observability configuration automatic without explicit service name configuration.

## Overview

The context detector analyzes your git repository to automatically determine:

- **Service Name**: Extracted from git remote URL or directory name
- **Repository**: Git remote URL
- **Current Branch**: Active git branch
- **Last Commit SHA**: Short SHA of the latest commit
- **Last Commit Time**: Timestamp of the latest commit
- **Environment**: Inferred from branch name or environment variables
- **Detection Method**: Strategy used for detection
- **Confidence**: Reliability score (0.0 to 1.0)

## Usage

```go
package main

import (
    "fmt"
    "log"

    "github.com/datadog/skill/internal/context"
)

func main() {
    // Detect context from current directory
    ctx, err := context.DetectContext(".")
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Service: %s\n", ctx.ServiceName)
    fmt.Printf("Environment: %s\n", ctx.Environment)
    fmt.Printf("Branch: %s\n", ctx.CurrentBranch)
    fmt.Printf("Commit: %s\n", ctx.LastCommitSHA)
}
```

## Detection Strategies

The detector uses multiple strategies in order of confidence:

### 1. Git Remote URL (90% confidence)

Extracts service name from git remote URL:

- `git@github.com:datadog/skill.git` → `skill`
- `https://github.com/datadog/dd-skill-test-go.git` → `dd-skill-test-go`

### 2. Directory Name (50% confidence)

Uses the directory name as a fallback, skipping generic names like:
- src, app, service, api, backend, frontend, web

## Environment Detection

Environment is inferred from branch name or environment variables:

### Environment Variables (highest priority)
- `DD_ENV`
- `ENVIRONMENT`

### Branch Name Mapping
- `main`, `master` → `production`
- `staging`, `stage` → `staging`
- `develop`, `dev` → `development`
- Other branches → `development`

## ServiceContext Structure

```go
type ServiceContext struct {
    ServiceName      string    // Detected service name
    Repository       string    // Git remote URL
    CurrentBranch    string    // Current git branch
    LastCommitSHA    string    // Short commit SHA (7 chars)
    LastCommitTime   time.Time // Commit timestamp
    Environment      string    // Inferred environment
    DetectionMethod  string    // Strategy used
    Confidence       float64   // 0.0 to 1.0
}
```

## Example Output

```json
{
  "ServiceName": "dd-skill-test-go",
  "Repository": "https://github.com/datadog/skill.git",
  "CurrentBranch": "main",
  "LastCommitSHA": "e127797",
  "LastCommitTime": "2026-01-20T09:45:04-08:00",
  "Environment": "production",
  "DetectionMethod": "git_remote",
  "Confidence": 0.9
}
```

## Running the Demo

```bash
# Detect context for current directory
go run cmd/demo/main.go

# Detect context for specific directory
go run cmd/demo/main.go /path/to/your/project
```

## Testing

Run the test suite:

```bash
go test ./internal/context/ -v
```

## Dependencies

- `github.com/go-git/go-git/v5` - Pure Go git implementation

## Implementation Details

### Helper Functions

- `getGitRemote(dir)` - Retrieves git remote URL using go-git
- `parseServiceFromRemote(url)` - Extracts service name from remote URL
- `getGitBranch(dir)` - Gets current git branch name
- `getLastCommit(dir)` - Retrieves last commit SHA and timestamp
- `inferEnvironment(branch)` - Maps branch name to environment
- `addGitMetadata(dir, ctx)` - Enhances context with git information

### Error Handling

- Non-existent directories return an error
- Missing git repository falls back to lower-confidence strategies
- Git operation failures are logged but don't prevent detection
- Returns error only if all detection strategies fail

## Integration with Datadog

This context detector is designed to automatically populate Datadog tags:

```go
ctx, _ := context.DetectContext(".")

// Use in Datadog tracer configuration
tracer.Start(
    tracer.WithService(ctx.ServiceName),
    tracer.WithEnv(ctx.Environment),
    tracer.WithGlobalTag("git.commit.sha", ctx.LastCommitSHA),
    tracer.WithGlobalTag("git.repository_url", ctx.Repository),
    tracer.WithGlobalTag("git.branch", ctx.CurrentBranch),
)
```
