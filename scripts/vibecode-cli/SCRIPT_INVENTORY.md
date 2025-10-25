# VibeCode CLI - Complete Script Inventory

This document maps all 126+ scripts to their menu locations.

## Deployment Scripts (78 total)

### Kind/Kubernetes Operations (10 scripts)
- `kind-create-cluster.sh` - Menu: Deploy > 1
- `deploy-vibecode.sh` - Menu: Deploy > 2
- `kind-status.sh` - Menu: Deploy > 3
- `kind-cleanup.sh` - Menu: Deploy > 4
- `kind-full-automation.sh` - Menu: Deploy > 5
- `kind-deploy-services.sh` - Menu: Deploy > 6
- `kind-health-check.sh` - Menu: Deploy > 7
- `kind-env-check.sh` - (used internally)
- `kind-setup.sh` - (used internally)
- `kind-export-postgres-url.sh` - (used internally)

### Docker Operations (5 scripts)
- `build-production.sh` - Menu: Deploy > 11
- `build-and-push-codeserver.sh` - Menu: Deploy > 12
- `docker-build-optimized.sh` - Menu: Deploy > 13
- `start-dev.sh` - Menu: Deploy > 14 > 1
- `start-docker.sh` - Menu: Deploy > 14 > 2
- `docker-doctor.sh` - Menu: Deploy > 15
- `docker-fix-simple.sh` - (utility)
- `docker-test-optimizations.sh` - (utility)

### Production (AKS) Deployment (5 scripts)
- `deploy-production.sh` - Menu: Deploy > 21
- `aks-bootstrap.sh` - Menu: Deploy > 22
- `aks-app-deploy.sh` - Menu: Deploy > 23
- `create-aks-cluster.sh` - Menu: Deploy > 24
- `azure-deployment-validation.sh` - Menu: Deploy > 25
- `aks-datadog-setup.sh` - (used internally)
- `aks-postgresql-setup.sh` - (used internally)

### Monitoring & Observability (6 scripts)
- `deploy-monitoring.sh` - Menu: Deploy > 31
- `kind-datadog-core.sh` - Menu: Deploy > 32
- `setup-aks-datadog-monitoring.sh` - Menu: Deploy > 33
- `deploy-datadog-dbm.sh` - Menu: Deploy > 34
- `deploy-dbm-apm-all.sh` - Menu: Deploy > 35
- `deploy-with-error-tracking.sh` - Menu: Deploy > 36
- `deploy-dbm-apm-azure.sh` - (variant)
- `deploy-dbm-apm-kind.sh` - (variant)
- `deploy-kind-postgres-monitoring.sh` - (variant)

### Complete Platform Deployments (4 scripts)
- `deploy-complete-platform.sh` - Menu: Deploy > 41
- `deploy-kind-with-monitoring.sh` - Menu: Deploy > 42
- `deploy-comparison-environments.sh` - Menu: Deploy > 43
- `deploy-simple-local.sh` - Menu: Deploy > 44
- `deploy-existing-cluster.sh` - (variant)

### Additional Deployments (5 scripts)
- `deploy-authelia.sh` - Menu: Deploy > 51
- `deploy-agentapi.sh` - Menu: Deploy > 52
- `deploy-ingress-controller.sh` - Menu: Deploy > 53
- `deploy-database-migrations.sh` - Menu: Deploy > 54
- `deploy-docs-next.sh` - Menu: Deploy > 55

### Setup Scripts (24 scripts - supporting)
- `setup-kind-cluster.sh`
- `setup-vibecode-cluster.sh`
- `setup-secrets.sh`
- `setup-azure-openai-monitoring.sh`
- `setup-azure-openai.sh`
- `setup-azure-resources.sh`
- `setup-azure-search.sh`
- `setup-full-automation.sh`
- `setup-k8s-db-scaling.sh`
- `setup-local-dev-with-monitoring.sh`
- `setup-openai-key.sh`
- `setup-test-env.sh`
- `setup-aks-datadog-monitoring.sh`
- `setup-backup-strategy.sh`
- `setup-branch-protection.sh`
- `setup-database.sh`
- `setup-datadog-cnm.sh`
- `setup-mcp-tracing.sh`
- `setup-postgres-datadog-monitoring.sh`
- `setup-production-monitoring.sh`
- `setup-rag-db.sh`
- `setup-real-testing.sh`
- `setup-test-dependencies.sh`
- `setup-tailwind-mode.sh`

### Build Scripts (14 additional)
- `build-and-test-code-server.sh`
- `build-apple-runtime.sh`
- `build-code-server.sh`
- `build-codeserver-local.sh`
- `build-codeserver-multiarch.sh`
- `build-multiarch.sh`
- `build-profiles.sh`
- `push-multiarch-codeserver.sh`
- And more...

## VM Management Scripts (48+ total)

### vfkit Core Setup (4 scripts)
- `01-setup-vfkit.sh` - Menu: VM > 11
- `install-alpine-vm.sh` - Menu: VM > 12
- `install-ai-tools-vfkit.sh` - Menu: VM > 13
- `install-vscode-server.sh` - Menu: VM > 14
- `install.sh` - (installer)

### vfkit Quick Actions (4 mapped)
- `05-launch-vibecode-vm.sh` - Menu: VM > 1
- `04-launch-alpine-vm.sh` - Menu: VM > 2
- VM Status - Menu: VM > 3 (built-in function)
- Stop All VMs - Menu: VM > 4 (built-in function)

### Alpine-based VMs (5 scripts)
- `02-download-alpine-kernel.sh` - Menu: VM > 21
- `03-create-alpine-rootfs.sh` - Menu: VM > 22
- `04-launch-alpine-vm.sh` - Menu: VM > 23
- `create-optimized-alpine-vm.sh` - Menu: VM > 24
- `10-upgrade-to-alpine-3.22.sh` - Menu: VM > 25
- `create-minimal-alpine-vm.sh` - (variant)
- `create-simple-alpine-vm.sh` - (variant)
- `create-working-alpine-vm.sh` - (variant)

### Specialized VMs (6+ scripts)
- `09-launch-node24-vm.sh` - Menu: VM > 31
- `13-launch-vscode-server-vm.sh` - Menu: VM > 32
- `create-busybox-vm.sh` - Menu: VM > 33
- `create-minimal-alpine-vm.sh` - Menu: VM > 34
- `create-ultra-minimal-vm.sh` - Menu: VM > 35
- `14-create-fun-demo-rootfs.sh` - Menu: VM > 36
- `08-create-node24-rootfs.sh` - (supporting)
- `12-create-vscode-server-rootfs.sh` - (supporting)
- `create-simple-busybox-vm.sh` - (variant)
- `create-working-busybox-vm.sh` - (variant)
- `create-practical-busybox-vm.sh` - (variant)
- `create-minimal-busybox-vm.sh` - (variant)

### Advanced VM Operations (5+ scripts)
- `build-ai-tools-vm-complete.sh` - Menu: VM > 41
- `07-create-persistent-vm.sh` - Menu: VM > 42
- `create-preinstalled-vm.sh` - Menu: VM > 43
- `11-build-minimal-kernel-docker.sh` - Menu: VM > 44
- `build-busybox-node-docker.sh` - Menu: VM > 45
- `build-ai-tools-vm.sh` - (variant)
- `prove-ai-tools-work.sh` - (testing)

### Performance & Benchmarks (12+ scripts)
- `basic-performance-test.sh` - Menu: VM > 51
- `comprehensive-performance-test.sh` - Menu: VM > 52
- `compare-boot-times.sh` - Menu: VM > 53
- `benchmarks/m-series-performance-test.sh` - Menu: VM > 54
- `continuous-performance-monitor.sh` - Menu: VM > 55
- `benchmark-validation.sh` - Menu: VM > 56
- Benchmarks submenu - Menu: VM > 57
- `benchmarks/boot_latency_bench.py` - Menu: VM > 57 > 1
- `benchmarks/firecracker_bench.py` - Menu: VM > 57 > 2
- `benchmarks/build-minivim-kernel-6.17.sh` - Menu: VM > 57 > 3
- `benchmarks/build-neovim-initramfs.sh` - Menu: VM > 57 > 4
- `benchmarks/openvscode-benchmark.sh` - Menu: VM > 57 > 5
- `benchmarks/docker-musl-vs-glibc.sh` - Menu: VM > 57 > 6
- `benchmarks/noisy-neighbor-experiment.sh` - Menu: VM > 57 > 7
- `benchmarks/emit_to_datadog.py` - Menu: VM > 57 > 8
- `detailed-performance-test.sh` - (detailed)
- `final-performance-test.sh` - (final)

### Lima Operations (3 scripts)
- `lima-build.sh` - Menu: VM > 61
- `lima-kernel-build.sh` - Menu: VM > 62
- `automate-lima-vibecode.sh` - Menu: VM > 63

### Kernel & Build Tools (4+ scripts)
- `11-build-minimal-kernel.sh` - Menu: VM > 71
- `analyze-kernel-optimization.sh` - Menu: VM > 72
- `benchmarks/build-and-validate-arm64-6.17.sh` - Menu: VM > 73
- `benchmarks/build-armv7-6.17-complete.sh` - Menu: VM > 74
- `benchmarks/build-minivim-kernel.sh` - (variant)
- `benchmarks/build-minivim-kernel-docker.sh` - (docker variant)
- `complete-alpine-kernel-build.sh` - (complete)
- `prepare-alpine-kernel-build.sh` - (prep)

### Comparisons & Analysis (3+ scripts)
- `compare-busybox-alpine.sh` - Menu: VM > 81
- `benchmarks/compare-vscode-builds.sh` - Menu: VM > 82
- `detailed-performance-test.sh` - Menu: VM > 83

### Additional Benchmark Scripts (8+)
- `benchmarks/_dogstatsd.py`
- `benchmarks/build-busybox-musl.sh`
- `benchmarks/build-neovim-avante-initramfs.sh`
- `benchmarks/build-neovim-initramfs-macos.sh`
- `benchmarks/firecracker` (binary)
- `benchmarks/kernel-configs/` (configs)
- And more...

## Total Script Count

- **Deployment Scripts**: 78+
- **VM Management Scripts**: 48+
- **Benchmark Scripts**: 20+
- **Total Consolidated**: 146+ scripts

## Menu Coverage

### Deployment Menu
- 50+ scripts directly accessible
- 28+ supporting/internal scripts
- 6 major categories
- 4 levels deep (including submenus)

### VM Menu  
- 35+ scripts directly accessible
- 13+ supporting/internal scripts
- 9 major categories
- 4 levels deep (including benchmarks submenu)

## Future Additions

Categories to be added:
- Development Tools
- Testing & Validation
- Database Operations
- Security & Monitoring
- Documentation Tools
- Build & CI/CD

Estimated additional scripts: 50+

## Notes

1. Some scripts are used internally by other scripts
2. Variants provide different configurations of base functionality
3. Supporting scripts enable main scripts but aren't directly called
4. All scripts maintain their original functionality
5. Menu provides organized access without modifying scripts
