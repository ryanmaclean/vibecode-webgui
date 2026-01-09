# Agent M: Exact Changes Required (Copy-Paste Ready)

## File: build-unified-services-with-datadog.sh

### Change 1: Binary Download Location (Lines 244-250)

**Current Code**:
```bash
                local pg_bin_dir=$(dirname "$pg_path")
                mkdir -p "$pg_dir/usr/bin"

                # Copy main binaries
                cp "$pg_path" "$pg_dir/usr/bin/"
                [ -f "$pg_bin_dir/initdb" ] && cp "$pg_bin_dir/initdb" "$pg_dir/usr/bin/" || true
                [ -f "$pg_bin_dir/psql" ] && cp "$pg_bin_dir/psql" "$pg_dir/usr/bin/" || true
                [ -f "$pg_bin_dir/pg_ctl" ] && cp "$pg_bin_dir/pg_ctl" "$pg_dir/usr/bin/" || true
```

**Replace With**:
```bash
                local pg_bin_dir=$(dirname "$pg_path")
                mkdir -p "$pg_dir/usr/libexec/postgresql16"

                # Copy main binaries - preserve libexec structure for initdb
                cp "$pg_path" "$pg_dir/usr/libexec/postgresql16/"
                [ -f "$pg_bin_dir/initdb" ] && cp "$pg_bin_dir/initdb" "$pg_dir/usr/libexec/postgresql16/" || true
                [ -f "$pg_bin_dir/psql" ] && cp "$pg_bin_dir/psql" "$pg_dir/usr/libexec/postgresql16/" || true
                [ -f "$pg_bin_dir/pg_ctl" ] && cp "$pg_bin_dir/pg_ctl" "$pg_dir/usr/libexec/postgresql16/" || true
```

### Change 2: Copy to Initramfs (Lines 798-801)

**Current Code**:
```bash
        cp "$downloads/postgresql/usr/bin/postgres" "$initramfs/usr/bin/"
        cp "$downloads/postgresql/usr/bin/initdb" "$initramfs/usr/bin/" 2>/dev/null || true
        cp "$downloads/postgresql/usr/bin/psql" "$initramfs/usr/bin/" 2>/dev/null || true
        chmod +x "$initramfs/usr/bin/postgres" "$initramfs/usr/bin/initdb" 2>/dev/null || true
```

**Replace With**:
```bash
        mkdir -p "$initramfs/usr/libexec/postgresql16"
        cp "$downloads/postgresql/usr/libexec/postgresql16/postgres" "$initramfs/usr/libexec/postgresql16/"
        cp "$downloads/postgresql/usr/libexec/postgresql16/initdb" "$initramfs/usr/libexec/postgresql16/" 2>/dev/null || true
        cp "$downloads/postgresql/usr/libexec/postgresql16/psql" "$initramfs/usr/libexec/postgresql16/" 2>/dev/null || true
        chmod +x "$initramfs/usr/libexec/postgresql16/postgres" "$initramfs/usr/libexec/postgresql16/initdb" 2>/dev/null || true
```

### Change 3: Init Script - initdb Path (Line 1245)

**Current Code**:
```bash
            /usr/bin/initdb -U postgres -D /var/lib/postgresql/data --auth=trust --no-locale --encoding=UTF8) > /tmp/postgresql-init.log 2>&1; then
```

**Replace With**:
```bash
            /usr/libexec/postgresql16/initdb -U postgres -D /var/lib/postgresql/data --auth=trust --no-locale --encoding=UTF8) > /tmp/postgresql-init.log 2>&1; then
```

### Change 4: Init Script - postgres Path (Lines 1317-1318)

**Current Code**:
```bash
if [ "$FAST_BUILD" = false ] && [ -f /usr/bin/postgres ] && [ -f /var/lib/postgresql/data/PG_VERSION ]; then
    su postgres -c "/usr/bin/postgres -D /var/lib/postgresql/data" > /tmp/postgresql.log 2>&1 &
```

**Replace With**:
```bash
if [ "$FAST_BUILD" = false ] && [ -f /usr/libexec/postgresql16/postgres ] && [ -f /var/lib/postgresql/data/PG_VERSION ]; then
    su postgres -c "/usr/libexec/postgresql16/postgres -D /var/lib/postgresql/data" > /tmp/postgresql.log 2>&1 &
```

## Summary of Changes

| Line(s) | Section | Change |
|---------|---------|--------|
| 244-250 | Download stage | Change `usr/bin` to `usr/libexec/postgresql16` |
| 798-801 | Initramfs copy | Change `usr/bin` to `usr/libexec/postgresql16` |
| 1245 | Init script (initdb) | Change `/usr/bin/initdb` to `/usr/libexec/postgresql16/initdb` |
| 1317-1318 | Init script (postgres) | Change `/usr/bin/postgres` to `/usr/libexec/postgresql16/postgres` |

## Verification Command

After making changes, rebuild and verify:

```bash
cd /Users/ryan.maclean/vibecode-webgui/azure
./build-unified-services-with-datadog.sh

# Quick verification
mkdir /tmp/verify && cd /tmp/verify
gunzip -c /Users/ryan.maclean/vibecode-webgui/azure/unified-services-static.cpio.gz | cpio -idm
ls -la usr/libexec/postgresql16/postgres usr/libexec/postgresql16/initdb
```

Expected output:
```
-rwxr-xr-x 1 user staff 9154288 Jan  5 XX:XX usr/libexec/postgresql16/postgres
-rwxr-xr-x 1 user staff  199696 Jan  5 XX:XX usr/libexec/postgresql16/initdb
```

---

**Total Changes**: 4 locations in 1 file
**Impact**: PostgreSQL only
**Risk**: Low (path change only)
