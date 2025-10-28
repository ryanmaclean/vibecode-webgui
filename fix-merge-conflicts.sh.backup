#!/bin/bash

# Fix all git merge conflicts automatically
# This script removes merge conflict markers and keeps the main branch content

set -euo pipefail

echo "🔧 Fixing git merge conflicts..."

# Find all files with merge conflict markers
files_with_conflicts=$(grep -r "<<<<<<< HEAD" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build -l || true)

if [ -z "$files_with_conflicts" ]; then
    echo "✅ No merge conflicts found!"
    exit 0
fi

echo "📋 Found conflicts in $(echo "$files_with_conflicts" | wc -l) files:"
echo "$files_with_conflicts"
echo ""

conflict_count=0
fixed_count=0

for file in $files_with_conflicts; do
    if [ -f "$file" ]; then
        echo "🔧 Fixing: $file"
        conflict_count=$((conflict_count + 1))
        
        # Create temporary file
        temp_file=$(mktemp)
        
        # Remove merge conflict markers and keep main branch content
        # This removes everything between <<<<<<< HEAD and ======= (HEAD content)
        # And keeps everything between ======= and >>>>>>> main (main branch content)
        awk '
        /^<<<<<<< HEAD/ { in_head=1; next }
        /^=======/ { in_head=0; in_main=1; next }
        /^>>>>>>> main/ { in_main=0; next }
        /^>>>>>>> .*/ { in_main=0; next }
        !in_head { print }
        ' "$file" > "$temp_file"
        
        # Replace original file with cleaned version
        mv "$temp_file" "$file"
        
        echo "  ✅ Fixed merge conflicts in $file"
        fixed_count=$((fixed_count + 1))
    fi
done

echo ""
echo "🎉 Merge conflict resolution complete!"
echo "  📊 Files processed: $conflict_count"
echo "  ✅ Files fixed: $fixed_count"
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff"
echo "2. Run tests to ensure everything works"
echo "3. Commit the fixes: git add . && git commit -m 'Fix merge conflicts'"
