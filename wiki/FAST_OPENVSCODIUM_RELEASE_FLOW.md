# Fast OpenVSCodium Release Flow (October 2025)

This page summarises the updated tooling for producing and verifying the `fast-openvscode-vm` artifacts now that we’re tracking OpenVSCodium-specific work in milestone **OpenVSCodium v0.2.0** (#561–#565).

## 1. Fetch the editor payload

```bash
# defaults to the latest Gitpod tarball for now
scripts/release/fetch-openvscode-server.sh
# override if you need a specific tag
OPENVSCODE_VERSION=openvscode-server-v1.105.1 scripts/release/fetch-openvscode-server.sh
```

- Downloads land in `fast-openvscode-vm/downloads/` with a matching `.sha256` file.
- The helper understands both Gitpod tags and the future OpenVSCodium naming expected from #561.

## 2. Package the microVM bundle

```bash
scripts/release/package-fast-openvscode-vm.sh
ls dist/fast-openvscode-vm-*.tar.gz{,.sha256}
```

- The script now falls back to `shasum` when `sha256sum` is unavailable (macOS hosts).
- The checksum output can be copied directly into GitHub Releases, CI logs, or attestations (#565).

## 3. Verify locally before publishing

```bash
shasum -a 256 -c dist/fast-openvscode-vm-<timestamp>.tar.gz.sha256
```

After verification, upload the archive + checksum to the release matching milestone **OpenVSCodium v0.2.0**. Add SBOM/attestation artifacts once #565 lands.

## 4. Benchmarks & metadata

- Store raw benchmark samples under `performance-results/fast-openvscode/` as JSON (see #563).
- Keep docs (`docs/virtualization/openvscode-microvm.md` and README) aligned with the version recorded by the packaging job (future `dist/metadata.json` from #562).

## 5. Platform notes

- Apple Silicon support is tracked in #564; the same flow will publish an arm64 tarball once ready.
- There is **no** path to run these VMs natively on iPhone or iPad. Virtualization.framework is macOS-only, so mobile devices must access the IDE via browser.
- Safari requires a **secure context** for most extensions. Always serve the editor over HTTPS/WSS (even in local dev) or extensions that rely on service workers, IndexedDB, or clipboard APIs will fail. Add mkcert/self-signed TLS to local setups before testing WebKit behaviour.
- Use `npm run microvm:https` to launch a local HTTPS proxy (`https://127.0.0.1:3443` → `http://127.0.0.1:3600`). Trust the generated certificate so iPad/Safari treat the workspace as secure.

## 6. Issue tracker map

| Issue | Description |
| --- | --- |
| #561 | Build & publish OpenVSCodium-branded server bundles |
| #562 | Automate version detection in packaging scripts |
| #563 | Benchmark Gitpod vs. OpenVSCodium builds |
| #564 | Ship & validate arm64 artifacts |
| #565 | Add SBOM + cosign attestations |

Keep this page updated as the milestone progresses.
