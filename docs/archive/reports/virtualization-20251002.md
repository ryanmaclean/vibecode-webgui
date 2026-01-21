# Lima vs Colima IDE Benchmarks (2025-10-02)

## Summary
- Lima (QEMU on Intel) is effectively on par with native Vim startup (~2.08 s vs 2.03 s).
- Colima + code-server (Docker) reaches HTTP-ready state in ~1.11 s after `docker run`.
- DNS benchmarks show Quad9 (9.9.9.9) fastest in our environment; 1.1.1.1 had a 199 ms cold hit.

## Artifacts
- `dist/ide-benchmarks-20251002T225923Z.tar.gz` (config + JSON results)
- `/tmp/vim-lima.json` (native vs Lima timing)
- `/tmp/vim-bench.json` (legacy QEMU timings, if present)

## Follow-ups (GitHub)
1. **New Issue:** “Intel Lima IDE baseline” – attach `vim-lima.json`, note ~2.08 s startup, recommend Quad9 DNS.
2. **New Issue:** “Colima code-server launch profile” – reference 1.11 s container startup, outline steps to ship preconfigured container image.
3. **Update Issue #552/#553:** mention that DNS failures were the main blocker for the Aegis QEMU build; propose moving to Lima/Colima on Intel.
4. **Release Asset:** upload `dist/ide-benchmarks-20251002T225923Z.tar.gz` alongside fast-openvscode artifacts for visibility.
5. **New Issues (Flux → 6.17 refresh):** Issues #573 (“MiniVim kernel refresh – x86_64 6.17.x”) and #574 (“MiniVim kernel refresh – arm64 6.17.x”) link back to `docs/virtualization/minivim-kernel.md`; both capture the ≈20 min Intel baseline and call out faster hardware for follow-on runs. Issue #576 covers the armv7 variant and #577 tracks the release bundle.

## Reproduction
```bash
limactl create --name ide-lima vm-assets/ide-lima.yaml
limactl start ide-lima
scripts/benchmarks/vim_hypervisor_bench.py --runs 3 --output new-lima.json
colima start --cpu 2 --memory 4 --disk 20
docker run -d -p 127.0.0.1:24444:8080 codercom/code-server:latest --auth none --disable-telemetry
```

Switch DNS to `9.9.9.9` via QEMU/Lima configuration for consistent results.
