# Feature Audit 1449: Datadog Integration (SSH, cloud-init, Lima)

**Source Release:** VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
**Issue:** https://github.com/ryanmaclean/vibecode-webgui/issues/1449
**Status:** Partially confirmed (Datadog config + Lima install script)

## Summary
Optional metrics and APM integration for VMs/services.

## Evidence
- `scripts/start-lima-vms-with-datadog.sh` installs Datadog agent inside Lima VMs.
- `infrastructure/datadog/vibecode-valkey.datadog.yaml` provides service config.

## Notes / Missing Info
- Issue calls out 3 methods (SSH, cloud-init, Lima). Only Lima script verified here.
- Identify SSH/cloud-init specific scripts or docs and confirm behavior.

## Follow-ups
- [ ] Locate SSH-based Datadog install flow.
- [ ] Locate cloud-init Datadog setup flow.
