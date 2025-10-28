#!/bin/bash

# Comprehensive merge conflict resolution script
# Resolves conflicts in source files only (excludes .backup-conflicts files)

echo "🔧 COMPREHENSIVE MERGE CONFLICT RESOLUTION"
echo "========================================="

# Find source files with conflicts (exclude backup files)
source_conflicts=$(find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" -o -name "*.md" | grep -v "\.backup-conflicts" | xargs grep -l "<<<<<<< HEAD" 2>/dev/null)

if [ -z "$source_conflicts" ]; then
    echo "✅ No conflicts found in source files!"
    exit 0
fi

echo "📋 Found $(echo "$source_conflicts" | wc -l) source files with conflicts:"

# Process each file
echo "$source_conflicts" | while read file; do
    echo ""
    echo "🔄 Processing: $file"

    # Create backup before modifying
    cp "$file" "${file}.conflict-backup-$(date +%s)"

    # Count conflicts in this file
    conflict_count=$(grep -c "<<<<<<< HEAD" "$file" 2>/dev/null || echo "0")
    echo "  Found $conflict_count conflict(s)"

    # Use a more sophisticated approach to resolve conflicts
    # For most files, we'll keep the main branch content (after =======)
    awk '
    BEGIN { in_conflict = 0; kept_main = 0 }
    /^<<<<<<< HEAD/ {
        in_conflict = 1
        # Skip everything until =======
        next
    }
    /^=======/ {
        if (in_conflict) {
            in_conflict = 0
            kept_main = 1
            # Keep everything from here until >>>>>>>
            next
        }
    }
    /^>>>>>>> / {
        if (kept_main) {
            kept_main = 0
            next
        }
    }
    {
        if (!in_conflict || kept_main) {
            print
        }
    }
    ' "$file" > "${file}.tmp"

    # Replace original file
    mv "${file}.tmp" "$file"

    resolved_count=$(grep -c "<<<<<<< HEAD" "$file" 2>/dev/null || echo "0")
    if [ "$resolved_count" = "0" ]; then
        echo "  ✅ Resolved all conflicts in $file"
    else
        echo "  ⚠️  $resolved_count conflicts remain in $file"
    fi
done

echo ""
echo "🎉 CONFLICT RESOLUTION COMPLETE"
echo ""
echo "📋 SUMMARY:"
echo "  - Processed $(echo "$source_conflicts" | wc -l) source files"
echo "  - Created .conflict-backup-* backups for each file"
echo "  - Used main branch content for conflict resolution"
echo ""
echo "🔍 NEXT STEPS:"
echo "  1. Review resolved files for correctness"
echo "  2. Test platform functionality"
echo "  3. Commit changes if everything works"
echo "  4. Clean up .conflict-backup-* files if desired"
