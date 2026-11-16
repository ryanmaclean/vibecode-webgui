# Agent 3 - Development & Testing Menus - Script Mapping

**Branch:** `feat/vibecode-cli-dev-test-menus`
**PR:** https://github.com/ryanmaclean/vibecode-webgui/pull/667
**Total Scripts Mapped:** 95

## Development Menu Scripts (34 total)

### Build Operations (10 scripts)

#### Production Builds
1. `/Users/studio/Documents/vibecode-webgui/scripts/build-production.sh`
2. `/Users/studio/Documents/vibecode-webgui/scripts/build-and-push-codeserver.sh`
3. `/Users/studio/Documents/vibecode-webgui/scripts/build-multiarch.sh`

#### Development Builds
4. `/Users/studio/Documents/vibecode-webgui/scripts/build-codeserver-local.sh`
5. `/Users/studio/Documents/vibecode-webgui/scripts/build-and-test-code-server.sh`
6. `/Users/studio/Documents/vibecode-webgui/scripts/build-apple-runtime.sh`

#### Specialized Builds
7. `/Users/studio/Documents/vibecode-webgui/scripts/build-codeserver-multiarch.sh`
8. `/Users/studio/Documents/vibecode-webgui/scripts/build-fast-openvscode-vm-with-ai-tools.sh`
9. `/Users/studio/Documents/vibecode-webgui/scripts/build-complete-wiki.sh`
10. `/Users/studio/Documents/vibecode-webgui/scripts/build-profiles.sh`

### Development Tools (11 scripts)

#### TypeScript & Test Fixes
11. `/Users/studio/Documents/vibecode-webgui/scripts/fix-typescript-baseline.sh`
12. `/Users/studio/Documents/vibecode-webgui/scripts/fix-all-tests.sh`
13. `/Users/studio/Documents/vibecode-webgui/scripts/fix-test-syntax.sh`
14. `/Users/studio/Documents/vibecode-webgui/scripts/fix-ts-ignore.sh`

#### Component Fixes
15. `/Users/studio/Documents/vibecode-webgui/scripts/fix-logger-circular-dependency.sh`
16. `/Users/studio/Documents/vibecode-webgui/scripts/fix-cognitive-search-adapter.sh`
17. `/Users/studio/Documents/vibecode-webgui/scripts/fix-database-connections.sh`
18. `/Users/studio/Documents/vibecode-webgui/scripts/fix-network-policy.sh`

#### Merge & Conflict Resolution
19. `/Users/studio/Documents/vibecode-webgui/scripts/fix-merge-conflicts.sh`
20. `/Users/studio/Documents/vibecode-webgui/scripts/fix-merge-conflicts-better.sh`

#### General Tools
21. `/Users/studio/Documents/vibecode-webgui/scripts/dev-tools.sh`

### Code Quality & Auditing (9 scripts)

#### License & Compliance
22. `/Users/studio/Documents/vibecode-webgui/scripts/check-licenses.sh`
23. `/Users/studio/Documents/vibecode-webgui/scripts/verify-extension-licenses.sh`
24. `/Users/studio/Documents/vibecode-webgui/scripts/verify-gpl-free.sh`

#### Security & Auditing
25. `/Users/studio/Documents/vibecode-webgui/scripts/security-audit.sh`
26. `/Users/studio/Documents/vibecode-webgui/scripts/component-status-audit.sh`
27. `/Users/studio/Documents/vibecode-webgui/scripts/audit-documentation.sh`

#### Verification
28. `/Users/studio/Documents/vibecode-webgui/scripts/verify-setup.sh`
29. `/Users/studio/Documents/vibecode-webgui/scripts/verify-onboarding.sh`
30. `/Users/studio/Documents/vibecode-webgui/scripts/verify-env-consolidation.sh`

### Clean & Maintenance (4 scripts)

31. `/Users/studio/Documents/vibecode-webgui/scripts/kind-cleanup.sh`
32. `/Users/studio/Documents/vibecode-webgui/scripts/cleanup-local-env.sh`
33. `/Users/studio/Documents/vibecode-webgui/scripts/safe-root-cleanup.sh`
34. `/Users/studio/Documents/vibecode-webgui/scripts/check-resource-deletion.sh`

---

## Testing & Validation Menu Scripts (61 total)

### Unit & Component Tests (20 scripts)

#### All Tests
35. `/Users/studio/Documents/vibecode-webgui/scripts/run-all-tests.sh`
36. `/Users/studio/Documents/vibecode-webgui/scripts/run-tests.sh`
37. `/Users/studio/Documents/vibecode-webgui/scripts/test-all-components.sh`

#### Component-Specific Tests
38. `/Users/studio/Documents/vibecode-webgui/scripts/test-cnm-integration.sh`
39. `/Users/studio/Documents/vibecode-webgui/scripts/test-litellm-integration.sh`
40. `/Users/studio/Documents/vibecode-webgui/scripts/test-code-server-editors.sh`
41. `/Users/studio/Documents/vibecode-webgui/scripts/run-agentapi-tests.sh`

#### Database Tests
42. `/Users/studio/Documents/vibecode-webgui/scripts/test-dbm-setup.sh`
43. `/Users/studio/Documents/vibecode-webgui/scripts/test-database-scaling.sh`
44. `/Users/studio/Documents/vibecode-webgui/scripts/test-vector-db-migration.sh`
45. `/Users/studio/Documents/vibecode-webgui/scripts/test-vector-migration-dev.sh`
46. `/Users/studio/Documents/vibecode-webgui/scripts/test-vector-migration-edge-cases.sh`
47. `/Users/studio/Documents/vibecode-webgui/scripts/test-vector-migration-large-dataset.sh`
48. `/Users/studio/Documents/vibecode-webgui/scripts/test-vector-migration-rollback.sh`
49. `/Users/studio/Documents/vibecode-webgui/scripts/test-vector-error-handling.sh`
50. `/Users/studio/Documents/vibecode-webgui/scripts/test-vector-migration-utility.sh`

#### Monitoring & Observability
51. `/Users/studio/Documents/vibecode-webgui/scripts/test-monitoring.sh`
52. `/Users/studio/Documents/vibecode-webgui/scripts/test-health-endpoints.sh`
53. `/Users/studio/Documents/vibecode-webgui/scripts/test-datadog-musl-build.sh`
54. `/Users/studio/Documents/vibecode-webgui/scripts/run-dbm-scenarios.sh`

### Integration Tests (14 scripts)

#### Kubernetes Integration
55. `/Users/studio/Documents/vibecode-webgui/scripts/test-k8s-complete.sh`
56. `/Users/studio/Documents/vibecode-webgui/scripts/test-k8s-core-functionality.sh`
57. `/Users/studio/Documents/vibecode-webgui/scripts/test-k8s-health-probes.sh`
58. `/Users/studio/Documents/vibecode-webgui/scripts/test-kind-deployment.sh`
59. `/Users/studio/Documents/vibecode-webgui/scripts/test-code-server-kind.sh`

#### Deployment Integration
60. `/Users/studio/Documents/vibecode-webgui/scripts/test-complete-deployment.sh`
61. `/Users/studio/Documents/vibecode-webgui/scripts/test-without-docker.sh`
62. `/Users/studio/Documents/vibecode-webgui/scripts/test-docs-deployment.sh`
63. `/Users/studio/Documents/vibecode-webgui/scripts/test-docs.sh`

#### Automation Integration
64. `/Users/studio/Documents/vibecode-webgui/scripts/test-full-automation.sh`
65. `/Users/studio/Documents/vibecode-webgui/scripts/test-gitops-automation.sh`
66. `/Users/studio/Documents/vibecode-webgui/scripts/test-authelia-automation.sh`

#### Optimization Tests
67. `/Users/studio/Documents/vibecode-webgui/scripts/test-optimizations-simple.sh`
68. `/Users/studio/Documents/vibecode-webgui/scripts/test-experiments-validation.sh`

### E2E & Accessibility Tests (2 scripts)

69. `/Users/studio/Documents/vibecode-webgui/scripts/run-accessibility-tests.sh`
70. `/Users/studio/Documents/vibecode-webgui/scripts/run_perf_tests.sh`

### Validation & Verification (22 scripts)

#### Setup & Configuration Validation
71. `/Users/studio/Documents/vibecode-webgui/scripts/validate-complete-setup.sh`
72. `/Users/studio/Documents/vibecode-webgui/scripts/validate-helm.sh`
73. `/Users/studio/Documents/vibecode-webgui/scripts/validate-gitops-setup.sh`
74. `/Users/studio/Documents/vibecode-webgui/scripts/validate-env-config.sh`
75. `/Users/studio/Documents/vibecode-webgui/scripts/validate-database-config.sh`

#### Deployment Validation
76. `/Users/studio/Documents/vibecode-webgui/scripts/validate-deployment-readiness.sh`
77. `/Users/studio/Documents/vibecode-webgui/scripts/validate-deployment-workflows.sh`
78. `/Users/studio/Documents/vibecode-webgui/scripts/validate-web-testing-workflows.sh`

#### Container & Docker Validation
79. `/Users/studio/Documents/vibecode-webgui/scripts/validate-arm64-dockerfile.sh`
80. `/Users/studio/Documents/vibecode-webgui/scripts/validate-container-optimizations.sh`
81. `/Users/studio/Documents/vibecode-webgui/scripts/validate-dockerfile-optimization.sh`

#### Monitoring & Health Validation
82. `/Users/studio/Documents/vibecode-webgui/scripts/validate-healthchecks.sh`
83. `/Users/studio/Documents/vibecode-webgui/scripts/validate-postgres-monitoring.sh`
84. `/Users/studio/Documents/vibecode-webgui/scripts/validate-dbm-apm-connection.sh`

#### System Verification
85. `/Users/studio/Documents/vibecode-webgui/scripts/verify-setup.sh` (duplicate from dev menu)
86. `/Users/studio/Documents/vibecode-webgui/scripts/verify-onboarding.sh` (duplicate from dev menu)
87. `/Users/studio/Documents/vibecode-webgui/scripts/verify-env-consolidation.sh` (duplicate from dev menu)
88. `/Users/studio/Documents/vibecode-webgui/scripts/verify-datadog-dbm.sh`
89. `/Users/studio/Documents/vibecode-webgui/scripts/verify-dns-ssl.sh`
90. `/Users/studio/Documents/vibecode-webgui/scripts/verify-docker-go-fix.sh`
91. `/Users/studio/Documents/vibecode-webgui/scripts/verify-goose.sh`
92. `/Users/studio/Documents/vibecode-webgui/scripts/verify-llm-observability.sh`

### Comprehensive Test Suites (3 scripts)

93. `/Users/studio/Documents/vibecode-webgui/scripts/comprehensive-k8s-tests.sh`
94. `/Users/studio/Documents/vibecode-webgui/scripts/comprehensive-kind-testing.sh`
95. `/Users/studio/Documents/vibecode-webgui/scripts/comprehensive-validation.sh`

---

## Implementation Files

### Created Files
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/vibecode-cli-main.sh` - Main CLI entry point
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/dev-menu.sh` - Development menu (500+ lines)
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/test-menu.sh` - Testing menu (700+ lines)
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/README.md` - Comprehensive documentation

### Additional Files (from existing structure)
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/common.sh` - Shared utilities
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/menu-database.sh` - Database menu (placeholder)
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/menu-deployment.sh` - Deployment menu (placeholder)
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/menu-development.sh` - Development menu (placeholder)
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/menu-monitoring.sh` - Monitoring menu (placeholder)
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/menu-security.sh` - Security menu (placeholder)
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/menu-testing.sh` - Testing menu (placeholder)
- `/Users/studio/Documents/vibecode-webgui/scripts/vibecode-cli-lib/menu-vm.sh` - VM menu (placeholder)

---

## Usage

### Interactive Mode
```bash
./bin/vibecode-cli
```

### Direct Menu Access
```bash
# Development menu
./bin/vibecode-cli dev

# Testing menu
./bin/vibecode-cli test
```

### Help
```bash
./bin/vibecode-cli --help
```

---

## Summary Statistics

| Category | Scripts |
|----------|---------|
| **Development Menu** | **34** |
| - Build Operations | 10 |
| - Development Tools | 11 |
| - Code Quality | 9 |
| - Clean & Maintenance | 4 |
| **Testing Menu** | **61** |
| - Unit & Component Tests | 20 |
| - Integration Tests | 14 |
| - E2E & Accessibility | 2 |
| - Validation & Verification | 22 |
| - Comprehensive Suites | 3 |
| **TOTAL UNIQUE SCRIPTS** | **95** |

Note: 3 scripts (verify-setup.sh, verify-onboarding.sh, verify-env-consolidation.sh) appear in both menus for developer convenience.

---

## Integration with Other Agents

The main CLI menu includes placeholders for menus being developed by:
- **Agent 1**: Deployment & Infrastructure, VM Operations
- **Agent 2**: Security & Database

These will integrate seamlessly with the existing architecture.
