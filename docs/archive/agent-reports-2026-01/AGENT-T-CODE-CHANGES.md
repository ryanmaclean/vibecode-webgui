# Agent T - Code Changes Detail

## File: /Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh

### Change 1: PostgreSQL Database Initialization (Line 1274-1275)

**Location:** Inside initramfs init script, database initialization block

**Before:**
```bash
if su postgres -c "/usr/libexec/postgresql16/initdb -U postgres -D /var/lib/postgresql/data --auth=trust --locale=C --encoding=SQL_ASCII --no-locale --locale-provider=libc" > /tmp/postgresql-init.log 2>&1; then
```

**After:**
```bash
# AGENT T FIX: Set ICU_DATA environment variable to help ICU libraries find data files
if su postgres -c "ICU_DATA=/usr/share/icu/76.1 LD_LIBRARY_PATH=/usr/lib:/usr/local/lib /usr/libexec/postgresql16/initdb -U postgres -D /var/lib/postgresql/data --auth=trust --locale=C --encoding=SQL_ASCII --no-locale --locale-provider=libc" > /tmp/postgresql-init.log 2>&1; then
```

**Purpose:**
- Ensures ICU libraries can find data files during database cluster initialization
- Prevents U_FILE_ACCESS_ERROR when initdb attempts to use ICU collation

---

### Change 2: PostgreSQL Server Runtime (Line 1353-1354)

**Location:** Parallel service startup section

**Before:**
```bash
if [ "$FAST_BUILD" = false ] && [ -f /usr/libexec/postgresql16/postgres ] && [ -f /var/lib/postgresql/data/PG_VERSION ]; then
    su postgres -c "/usr/libexec/postgresql16/postgres -D /var/lib/postgresql/data" > /tmp/postgresql.log 2>&1 &
    POSTGRES_PID=$!
    echo "  - PostgreSQL server launched (PID: $POSTGRES_PID)"
fi
```

**After:**
```bash
if [ "$FAST_BUILD" = false ] && [ -f /usr/libexec/postgresql16/postgres ] && [ -f /var/lib/postgresql/data/PG_VERSION ]; then
    # AGENT T FIX: Set ICU_DATA environment variable for runtime ICU support
    su postgres -c "ICU_DATA=/usr/share/icu/76.1 LD_LIBRARY_PATH=/usr/lib:/usr/local/lib /usr/libexec/postgresql16/postgres -D /var/lib/postgresql/data" > /tmp/postgresql.log 2>&1 &
    POSTGRES_PID=$!
    echo "  - PostgreSQL server launched (PID: $POSTGRES_PID)"
fi
```

**Purpose:**
- Ensures ICU libraries remain accessible during server runtime
- Supports any ICU-dependent operations (collation, locale handling, etc.)

---

## Environment Variables Added

### ICU_DATA=/usr/share/icu/76.1
- **Purpose:** Tell ICU libraries where to find Unicode data files
- **Target File:** icudt76l.dat (30MB Unicode data)
- **Impact:** Resolves U_FILE_ACCESS_ERROR

### LD_LIBRARY_PATH=/usr/lib:/usr/local/lib
- **Purpose:** Ensure dynamic linker finds ICU shared libraries
- **Libraries:** libicudata.so.76, libicui18n.so.76, libicuuc.so.76
- **Impact:** Prevents library loading failures

---

## Technical Implementation Notes

### Why Use Environment Variables?
1. **Portability:** Works in any shell environment (bash, sh, busybox)
2. **Scope Control:** Variables only apply to the specific process
3. **No Side Effects:** Doesn't affect other services
4. **Standard Practice:** This is the official ICU configuration method

### Why Inside su Command?
```bash
su postgres -c "ENV=value command"
```
This ensures:
- Environment variables are set in the postgres user's context
- Variables persist for the entire command execution
- No global environment pollution

### Alternative Approaches Considered

**Option 1: Export globally**
```bash
export ICU_DATA=/usr/share/icu/76.1
```
❌ Rejected: Would affect all processes, not just PostgreSQL

**Option 2: Create config file**
```bash
echo "ICU_DATA=/usr/share/icu/76.1" > /etc/environment
```
❌ Rejected: Adds complexity, requires parsing

**Option 3: Compile-time default**
❌ Rejected: Would require recompiling PostgreSQL/ICU

**Chosen: Inline environment variables**
✅ Simple, explicit, maintainable, standard practice

---

## Verification Commands

### Check ICU data is present
```bash
ls -lh /usr/share/icu/76.1/icudt76l.dat
# Expected: -rw-r--r-- 1 root root 30M icudt76l.dat
```

### Check ICU libraries
```bash
ls -l /usr/lib/libicu*.so.76
# Expected: 3 libraries (data, i18n, uc)
```

### Test PostgreSQL initialization
```bash
ICU_DATA=/usr/share/icu/76.1 initdb -D /tmp/test
# Expected: Success (no U_FILE_ACCESS_ERROR)
```

---

## Rollback Procedure

If this fix causes issues, revert by:

1. Remove environment variables from line 1275:
```bash
if su postgres -c "/usr/libexec/postgresql16/initdb -U postgres -D /var/lib/postgresql/data --auth=trust --locale=C --encoding=SQL_ASCII --no-locale --locale-provider=libc" > /tmp/postgresql-init.log 2>&1; then
```

2. Remove environment variables from line 1354:
```bash
su postgres -c "/usr/libexec/postgresql16/postgres -D /var/lib/postgresql/data" > /tmp/postgresql.log 2>&1 &
```

3. Rebuild initramfs:
```bash
./build-unified-services-with-datadog.sh
```

---

## Build Impact

- **Build Time:** No change (~26 seconds)
- **Initramfs Size:** No change (96M)
- **File Count:** No change (environment variables are inline)
- **Dependencies:** No new dependencies

---

## Success Criteria

✅ initdb completes without errors
✅ No "U_FILE_ACCESS_ERROR" in logs
✅ No "could not open collator" errors
✅ Database directory structure created
✅ PG_VERSION file exists
✅ PostgreSQL can use ICU collation (if needed)

All criteria met in testing on 2026-01-05.
