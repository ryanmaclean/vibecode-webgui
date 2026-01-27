## Shell Script Inventory (sh2py prep)

- **Count:** 97 `.sh` entrypoints in `scripts/vfkit/` (≈19K LoC)
- **Categories:** build (14), create (14), test (7), install (5), launch (5), start (5), vm-workflow (3), plus mixed utility (40)
- **Key Dependencies:**
  - `vfkit` binary at `src-tauri/resources/vfkit-aarch64-apple-darwin`
  - YAML VM specs under `config/vfkit` (consumed by `vm-manager.sh` + builders)
  - Runtime dirs inside `~/.vfkit` and `~/.vibecode` (logs, disks, EFI stores)
  - Toolchain: `curl`, `wget`, `hdiutil`, `tar`, `xz`, `docker`, `brew`, `qemu-img`, `nc`, `jq`, etc.
- **Common Patterns:**
  - Strict mode headers: `set -euo pipefail`, `trap`-based cleanup, `mktemp` scratch dirs
  - Colorized logging helpers (`log_info`, `log_success`, etc.) repeated across most scripts
  - Reusable operations (download Alpine assets, decompress kernels, configure cloud-init data)
  - Filesystem orchestration around `~/.vfkit/vms/<vm>/<kernel|rootfs|efi|logs>`
  - Wrappers such as `start-*.sh` delegating into `vm-manager.sh`.

### Manifest snapshot

See `scripts/vfkit/sh_manifest.json` (auto-generated) for per-script metadata:

```json
{
  "name": "vm-manager.sh",
  "lines": 681,
  "category": "vm",
  "uses_vm_manager": false,
  "has_function_defs": true,
  "uses_vfkit_cli": true,
  "mentions_rootfs": true,
  "mentions_kernel": true
}
```

### Shared behaviour implications

1. **Central orchestrator** – `vm-manager.sh` defines VM metadata, logging, PID/log file handling, dependency ordering, health/monitor operations. Converting it first (into a reusable Python module/CLI) will unblock many smaller wrappers (`start-*.sh`, `stop-all-vms.sh`, health checks, tests).
2. **Builder/test workflows** – Scripts that build kernels/rootfs/test harnesses follow repeated sequences (download → unpack → configure → vfkit launch). Extracting these steps into composable Python helpers (e.g., filesystem staging, HTTP downloads with progress, virtualization helpers) will minimize duplicated logic.
3. **User interaction + observability** – Many scripts print banners, status tables, or interactive instructions. Python versions should keep the UX (colors, banners) while adding structured logging/tracing hooks (ddtrace, structured JSON) where possible.
4. **External binaries** – Instead of inlined shell pipelines, Python replacements can:
   - Use `subprocess.run([...], check=True)` within a thin `run_cmd` helper for human-readable errors.
   - Replace simple shell plumbing (e.g., file copies, environment discovery) with Python `pathlib`, `shutil`, `plistlib`, etc.
   - Gate optional dependencies (Docker, brew) with explicit checks + actionable error messages.

These observations feed the `vfkit_py` scaffolding: core utilities (color logging, command runner, download helpers), VM spec loader, and typed workflows for build/test/launch operations. Individual script ports can be thin adapters on top of those primitives, keeping the requested 1:1 mapping while consolidating complex behaviour in testable modules.

### Python scaffolding layout

```
scripts/
├── vfkit/              # Entry-point scripts + docs (legacy location)
└── vfkit_py/           # New reusable modules
    ├── __init__.py
    ├── log.py          # Colorized log helpers
    ├── paths.py        # Project + runtime path discovery
    ├── runner.py       # subprocess helpers
    └── vm_manager.py   # (in progress) Python rewrite of vm-manager.sh
```

All future conversions import from `scripts.vfkit_py` rather than duplicating shell idioms. Each `.py` entrypoint (e.g., `start-nodejs-dev.py`) will:

1. add the repo root to `sys.path` when run directly so imports resolve;
2. delegate real work to a function in `vfkit_py`;
3. keep an `if __name__ == "__main__": main()` guard for familiarity.

### Current progress (session: 2026-01-27)

- ✅ Converted `vm-manager.sh` → `scripts/vfkit/vm-manager.py` backed by `vfkit_py.vm_manager` + unit tests (`tests/vfkit/test_vm_manager.py`).
- ✅ Added Python wrappers for `start-nodejs-dev`, `start-postgresql`, `start-valkey`, `start-all-vms`, `stop-all-vms`, and `vm-health-check` (`tests/vfkit/test_vm_wrappers.py`).
- ✅ Generated `scripts/vfkit/sh_manifest.json` for tracking and `runner_helper.py` bootstrap to keep wrappers thin.
- ⏭️ Remaining workload: 90 shell scripts (builders, installers, test harnesses). Group them into:
  - *VM builders* (01–14, build-*, create-*) – need reusable download/build helpers.
  - *Service workflows* (install-*, setup-*, verify-*) – need typed command recipe layer.
  - *Performance/test harnesses* (test-*, benchmark-*, performance-*) – convert to Python test runners.
- ✳️ Next actions: implement download/fs utilities in `vfkit_py`, convert one builder (e.g., `create-working-vm.sh`) to validate approach, then open beads for the remaining groups.
