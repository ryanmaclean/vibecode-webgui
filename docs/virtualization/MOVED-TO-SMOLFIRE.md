# VM and microVM content moved to smolfire

On 2026-10-24 the VM/microVM tooling in this repo moved to
[ryanmaclean/smolfire](https://github.com/ryanmaclean/smolfire), which owns microVM
boot/runtime and VM benchmarks. The files were copied byte-for-byte from
`129302a73be9719d213561116319d13ed679fd71`. History stays here, so `git log -- <old path>` still works.
The content is still MIT: smolfire keeps the notice in `LICENSES/vibecode-webgui-MIT.txt`.

Many older docs still name the old paths as plain text. Map them like this:

| Old path in vibecode-webgui | New location in smolfire |
|---|---|
| `scripts/vfkit/` | `imports/vibecode/scripts/vfkit/` |
| `scripts/benchmarks/` benches, launchers, comparisons (`*_bench.*`, `vscode_microvm.*`, `applevf*launcher*`, `compare*`, `docker*musl*`, `noisy*`, `openvscode*benchmark*`, `m*series*`, `test*musl*`, `test*neovim*`, `firecracker/`, `emit_to_datadog.py`) | `imports/vibecode/scripts/benchmarks/`. The shared `benchmark_utils.py` and `_dogstatsd.py` are copied there too, but stay here until the genoa builders leave |
| `scripts/benchmarks/` kernel/initramfs/rootfs builders and `kernel-configs/` | ryanmaclean/genoa (see that repo) |
| `tests/vm/`, `tests/vm-integration/`, `tests/acceptance/` | `imports/vibecode/tests/...` |
| `tests/unit/scripts/test_vfkit_*`, `benchmarks/`, `test_*fast_openvscode_vm*`, `test_ci_package_microvm.py` | `imports/vibecode/tests/unit/scripts/` |
| `experiments/microvm/`, `tools/nodejs-vm/` | `imports/vibecode/experiments/microvm/`, `imports/vibecode/tools/nodejs-vm/` |
| `infrastructure/qemu/`, `infrastructure/postgresql-9p-persistence/` | `imports/vibecode/infrastructure/...` |
| `platforms/docker/fast-openvscode-vm/`, `scripts/release/package-fast-openvscode-vm.sh`, `docs/virtualization/openvscode-microvm.md` | `imports/vibecode/...` (same relative path) |
| `.github/workflows/vm-integration-tests.yml` | `imports/vibecode/ci-reference/vm-integration-tests.yml` (it does not run there) |
| `swift/` | `experiments/apple-vz/swift/` |
| `platforms/macos/{apple-container,vz-swift,postgresql-vm,Sources,native-build,swift/vm-orchestration,swift/vm}` | `experiments/apple-vz/platforms/macos/...` |
| `tests/feature-audit/feature-1448-nat-networking.test.ts` + its doc | `experiments/apple-vz/feature-audit/` |

Removed without a copy: `fast-openvscode-vm/`. It held only a `.gitignore` and a public
self-signed dev certificate. `scripts/dev/start-openvscode-https.sh` creates a new one under
`fast-openvscode-vm/certs/` (now gitignored) when it is missing.

Still here: `config/vfkit/` (#2126), `platforms/macos/{VibeCodeSwift,VibeCode-VMs,homebrew-vibecode}`,
and `platforms/macos/{vm,vm-assets,swift/lima-launcher,AppleContainerRuntime}`, because
`src/lib/vm`, `src/lib/container`, the Tauri commands and the `lima:*` npm scripts point at them.

The release-assets workflow no longer builds initramfs images. Those builders belong to genoa.
`scripts/dev/start-ide-universal.sh` uses the vfkit microVM only when `VSCODE_MICROVM_SCRIPT`
points at a copy of `vscode_microvm.sh`. Otherwise it uses Lima or host mode.
