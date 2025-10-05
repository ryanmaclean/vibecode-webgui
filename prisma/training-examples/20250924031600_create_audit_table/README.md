# Prisma Training Migration: Session Audit Table

This example was produced with:

```bash
# Create a scripted migration that can be inspected without applying
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel schema.prisma \
  --script > prisma/training-examples/20250924031600_create_audit_table/migration.sql
```

During the workshop we applied the script to a disposable database so trainees could observe:

1. The migration being applied.
2. Blocking locks clearing after the table was dropped.
3. Datadog DBM capturing the (fake) blocking/blocked sessions fed through the training scripts in `datadog/training/blocking-query-snapshots-20250924.md`.
