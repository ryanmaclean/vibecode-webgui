# Lima Launcher (Swift)

Swift-based helper for managing Lima VMs that host the code-server IDE or microVM experiments.

## Why
- Intel hosts still rely on Lima/HyperKit for fast dev environments.
- Coordinators (Tauri, CLI) can shell out to a consistent binary instead of bespoke bash scripts.

## Build & Run
```bash
cd swift/lima-launcher
swift build
swift run lima-launcher start --name ide-lima --config vm-assets/ide-lima.yaml
swift run lima-launcher status --name ide-lima
swift run lima-launcher forward --port 8080
```

All commands call `limactl` under the hood. Ensure Lima is installed (`brew install lima`).

## Commands
- `start` – `limactl start <name> --config <path>`
- `stop` – `limactl stop <name>`
- `status` – `limactl info <name>`
- `shell [cmd]` – open an interactive shell or run a single command inside the VM
- `forward --port 8080` – establish an SSH tunnel to expose code-server on localhost

## Next Steps
- Integrate with Tauri (invoke the binary before launching the browser)
- Add vfkit/Virtualization.framework parity for Apple Silicon (reuse `swift/vm-orchestration` APIs)
- Capture logs/metrics for microVM cold starts
```
