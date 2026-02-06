#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Replace @ts-ignore with @ts-expect-error in all TypeScript files

# Initialize log aggregation
init_log_aggregation

find src/ -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/@ts-ignore/@ts-expect-error/g'

echo "Replaced all @ts-ignore with @ts-expect-error"