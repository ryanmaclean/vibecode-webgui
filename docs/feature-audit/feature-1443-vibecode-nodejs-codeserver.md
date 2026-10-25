# Feature Audit 1443: vibecode-nodejs-codeserver (50GB)

**Source Release:** VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
**Issue:** https://github.com/ryanmaclean/vibecode-webgui/issues/1443
**Status:** Partially confirmed (config present; disk size needs verification)

## Summary
Node.js + code-server VM image.

## Evidence
- `config/cloud-init/codeserver-user-data.yaml` provisions Node.js and installs code-server.
- `scripts/vm-manifest.example.json` references `vibecode-nodejs-codeserver.img` and EFI NVRAM entries.

## Notes / Missing Info
- Release note lists 50GB, but `scripts/rebuild-all-vms-with-services.sh` uses `20G` for `vibecode-nodejs-codeserver`. Confirm actual image size and update docs or scripts.

## Follow-ups
- [ ] Confirm VM image disk size in build pipeline/output artifacts.
