# Prisma Training Migration: Add Favorite Flag

These commands were captured during an enablement session to illustrate how `prisma migrate diff` can be used to prototype schema changes before they are committed.

```bash
# Generate a throwaway script without touching the database
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel schema.prisma \
  --script \
  --exit-code

# Apply to a scratch database (optional)
DATABASE_URL=postgresql://training:training@localhost:5432/training \
  npx prisma migrate deploy --schema schema.prisma
```

The resulting SQL toggles a temporary `is_training_example` column on the `Workspace` table so trainees can practice generating, applying, and rolling back migrations without altering production schema.
