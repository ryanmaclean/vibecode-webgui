## Active Tasks (2025-10-03)

- [ ] Restore HyperKit console visibility and collect BusyBox vi timings (Issue #575) — rerun with `-l com1,stdio`, hold the PTY open, add init logging, then refresh `hyperkit_busybox_vi_2025-10-02.json`.
- [ ] Complete MiniVim kernel refresh for arm64/armv7 (Issues #574, #576) and publish updated benchmark JSON once timings are captured.
- [ ] Publish the consolidated MiniVim multi-arch release bundle with checksums (Issue #577) after all kernels are rebuilt.
- [ ] Trim the MiniVim x86_64 config to reach ≤3 s boot-to-vi and update benchmarking artifacts (Issue #560).

## Recent History

- 2025-10-02: Logged Intel baseline (~20 min clean build) in `docs/virtualization/minivim-kernel.md`, filed Issues #573/#574 for the 6.17 refresh, and recorded HyperKit console regression (#575).
- 2025-10-02: Fixed BusyBox initrd logging, scripted HyperKit autopty capture, and staged benchmark JSON for reruns.
- 2025-10-02: Updated fast OpenVSCode microVM packaging and benchmarking scripts; arm64 bundle pending Apple Silicon validation (Issue #553).
