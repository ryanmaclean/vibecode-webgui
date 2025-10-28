#!/bin/bash

# Replace @ts-ignore with @ts-expect-error in all TypeScript files
find src/ -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/@ts-ignore/@ts-expect-error/g'

echo "Replaced all @ts-ignore with @ts-expect-error"