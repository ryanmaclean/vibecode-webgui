# Repository Guidelines

## Project Structure & Module Organization
- Next.js 15 code lives in `src`; routes sit in `src/app`, shared UI in `src/components`, utilities in `src/lib`.
- Backend helpers and automation live in `server`, `services`, `scripts`, and the supporting `packages/*` modules.
- Infrastructure resides in `k8s`, `helm`, `azure`, `tofu`; static content in `public`/`docs`; the `tests` tree mirrors product scopes (unit, integration, e2e, k8s, monitoring).

## Build, Test, and Development Commands
- `npm run setup` provisions local prerequisites via `scripts/setup-development.js`.
- `npm run dev` enables instrumentation; use `npm run dev:simple` to skip Datadog tracing.
- Run `npm run build && npm run start` for production bundles and verify `npm run lint`, `npm run type-check`, `npm run test:unit` before any PR.
- `npm run test:e2e` or `npm run test:production:smoke` covers Playwright suites; `npm run test:integration` exercises API and database paths.

## Coding Style & Naming Conventions
- Write in TypeScript; components follow PascalCase filenames, hooks start with `use`, and route folders stay kebab-case for Next routing.
- ESLint (`eslint.config.mjs`) dictates style; keep the prevailing two-space indentation, single quotes, and trailing commas.
- Store primitives in `src/components/ui`, feature modules alongside their assets, and Jest mocks in nearby `__mocks__` folders.

## Testing Guidelines
- Jest (`jest.config.js`) loads shared setup via `tests/setupTests.ts` and enforces 80% coverage across branches, functions, lines, and statements.
- Name specs `*.test.ts` or `.tsx` within the appropriate `tests/<scope>` folder and reuse fixtures from `tests/__mocks__`.
- Playwright cases live in `tests/e2e`; set `BASE_URL` for staging or production targets and archive artifacts in `playwright-report/`.

## Commit & Pull Request Guidelines
- Stick to Conventional Commits (`feat:`, `fix:`, `chore:`) and keep subjects imperative and scoped.
- PRs must summarise the change, reference related issues, flag risk or rollout notes, and list verification commands.
- Request review per `CONTRIBUTING.md`, attach screenshots or logs for UX/monitoring changes, and merge only after CI succeeds.

## Environment & Security Notes
- Copy `.env.local.example` to `.env.local`; keep secrets out of git and tailor extra `.env` files per environment.
- Datadog requires `DD_API_KEY` and `DD_SITE`; validate telemetry with the `npm run monitoring:*` scripts before shipping.
- Adjust Kubernetes or Terraform defaults in `k8s/` and `tofu/terraform.tfvars` rather than editing live manifests; document credential handling in the PR.

## Micro-VM Prototype Notes (2025-10-02)
- Working trees live in `fast-openvscode-vm/` (x86_64) and `fast-openvscode-vm-arm64/` (arm64); both stay ignored. Only docs and agent logs are checked in.
- Boot recipe, measurements, and follow-up work sit in `docs/virtualization/openvscode-microvm.md`, `wiki/FAST_OPENVSCODIUM_RELEASE_FLOW.md`, and `archive/agents/2025-10-02-openvscode-microvm.md`.
- HTTP proxy + readiness checks are baked into `rootfs/init` for both arches; `curl` against `/` or `/healthz` now returns 200 once the proxy spins up.
- `scripts/benchmarks/vscode_microvm.sh` handles lifecycle + latency sampling. Pass `MICROVM_ARCH=arm64` to exercise the new Debian-based guest (cold start ≈19.5 s via TCG on Intel; expect better on Apple Silicon once validated).
- Package releases with `scripts/release/package-fast-openvscode-vm.sh fast-openvscode-vm[-arm64]`; artifacts land in `dist/` alongside `.sha256` files.
- Keep upstream OpenVSCode tarballs out of git. Use `scripts/release/fetch-openvscode-server.sh` (or curl from the Gitpod releases) to refresh `downloads/` before rebuilding the initramfs.
- For Safari/iPad verification, run `npm run microvm:https` to proxy 3443→3600 with a local cert (mkcert/OpenSSL). Trust the cert before testing extensions.
- Consider snapshot/resume or pre-warmed guests for the “feels-native” experience after the cold-start handshake is reliable. Mobile note: Virtualization.framework remains macOS-only, so rely on remote browser sessions for iOS/iPadOS.

## MiniVim Kernel & vi Benchmarks (2025-10-02)

- Artifacts/scripts: `scripts/benchmarks/build-minivim-kernel.sh`, `scripts/benchmarks/kernel-configs/minivim-*.config`, output copied to `bench-images/minivim/` and mirrored under `artifacts/minivim/`.
- Latest run (`python3 scripts/benchmarks/vim_qemu_bench.py --runs 3`): BusyBox 4.38 s (MiniVim kernel), TinyCore 15.1 s, Yocto minimal 12.9 s, OpenWrt 18.8 s. Lima `vmType=vz`/`vmType=qemu` remain ≈2.0 s vs. 2.05 s native (`python3 scripts/benchmarks/vim_hypervisor_bench.py --runs 3`).
- Build ran inside a glibc Ubuntu 25.04 Lima VM; Lima/alpine remains musl-only, so CI should run the script on Debian/Ubuntu or GH Actions.
- Next agent: trim kernel config to hit ≤3 s boot-to-vi, then repeat for `arm64` (Apple virtualization) and `armv7` (Pi). Attach artifacts + benchmark deltas to issues #560 and #558 after each milestone.
