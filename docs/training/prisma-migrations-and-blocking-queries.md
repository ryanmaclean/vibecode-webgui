# Training Reference: Prisma Migrations & Blocking Query Snapshots

This guide accompanies the tabletop exercises from 24 September 2025. It references synthetic migrations and fake blocking sessions so teams can rehearse incident handling without touching production data.

## Prisma Migration Walkthroughs

| Timestamp (UTC) | Folder | Summary |
| --- | --- | --- |
| 2025-09-24 03:15 | `prisma/training-examples/20250924031500_add_favorite_flag` | Toggle a temporary `is_training_example` flag on `Workspace`. Demonstrates generating scripts with `prisma migrate diff` and rolling them back safely. |
| 2025-09-24 03:16 | `prisma/training-examples/20250924031600_create_audit_table` | Creates and drops a `training_session_audit` table so attendees can observe locking, auditing and clean-up steps. |

### Command Cheat Sheet

```bash
# Generate SQL without modifying any real database
npx prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script

# Apply to an isolated sandbox for demos
DATABASE_URL=postgresql://training:training@localhost:5432/training \
  npx prisma migrate deploy --schema schema.prisma
```

Each migration folder contains the raw SQL plus a README that documents the learning objectives. They **must not** be copied into `prisma/migrations/` unless converted into a real change request.

## Blocking Query Examples

See `datadog/training/blocking-query-snapshots-20250924.md` for the mock SQL used to trigger alerts.

- Staging scenario showcases a long-running `FOR UPDATE` lock.
- Production scenario mimics a read transaction blocking a deletion in `Project`.
- Development scenario demonstrates schema changes holding locks during a migration dry run.

All samples tag metrics with `training:20250924`, `operator:kim.smith`, or `operator:jessie` so they can be filtered out from real telemetry.

## Contacts for Follow-up

- Kim Smith — kim.smith@vibecode.com
- Jessie — jessie@vibecode.com

Reach out to them for future enablement sessions or to schedule refreshers.
