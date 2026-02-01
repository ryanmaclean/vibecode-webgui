# Feature Audit 1444: vibecode-pgvector (20GB)

**Source Release:** VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
**Issue:** https://github.com/ryanmaclean/vibecode-webgui/issues/1444
**Status:** Confirmed in repo (config present)

## Summary
PostgreSQL 16 + pgvector VM with 20GB root disk.

## Evidence
- `config/lima/postgresql-pgvector-vm.yaml` defines `disk: "20GiB"` and provisions pgvector.

## Notes / Missing Info
- Additional disks (pgdata, pgbackup) are larger than 20GB; clarify whether release note refers to root disk or total storage.

## Follow-ups
- [ ] Confirm published VM image sizing vs release note.
