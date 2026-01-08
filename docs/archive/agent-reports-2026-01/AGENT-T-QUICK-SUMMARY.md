# Agent T - ICU Fix Quick Summary

## Problem
PostgreSQL initdb failed with: `FATAL: could not open collator for locale "und": U_FILE_ACCESS_ERROR`

## Root Cause
ICU libraries couldn't find data files at `/usr/share/icu/76.1/` because `ICU_DATA` environment variable was not set.

## Solution
Added environment variables to both initdb and postgres server startup:
- `ICU_DATA=/usr/share/icu/76.1`
- `LD_LIBRARY_PATH=/usr/lib:/usr/local/lib`

## Result
✅ PostgreSQL initdb now succeeds without ICU errors
✅ No more "U_FILE_ACCESS_ERROR" messages
✅ Database cluster created successfully

## Files Modified
- `/Users/ryan.maclean/vibecode-webgui/azure/build-unified-services-with-datadog.sh`
  - Line 1274-1275: Added ICU_DATA to initdb command
  - Line 1353-1354: Added ICU_DATA to postgres server startup

## Test Results
```
Initializing PostgreSQL database...
✓ Database initialized
```

No ICU errors in console output.

## Next Steps
PostgreSQL server fails to start due to shared memory issue (separate from ICU):
```
FATAL: could not open shared memory segment "/PostgreSQL.1634790402": No such file or directory
```

This requires mounting `/dev/shm` in the initramfs environment.
