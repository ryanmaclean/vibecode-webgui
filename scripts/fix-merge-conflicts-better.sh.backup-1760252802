#!/bin/bash

# Fix merge conflicts by manually resolving each file
files_with_conflicts=$(grep -rn "<<<<<<< HEAD" src/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort -u)

for file in $files_with_conflicts; do
    echo "Fixing merge conflicts in $file"
    
    # Use git checkout to take our version (HEAD)
    git checkout --ours "$file" 2>/dev/null || echo "Could not use git checkout, trying manual fix"
    
    # If git checkout didn't work, manually remove markers
    if grep -q "<<<<<<< HEAD" "$file"; then
        # Create a temporary file without merge markers
        temp_file=$(mktemp)
        
        # Remove all lines between <<<<<<< HEAD and ======= (inclusive)
        # Also remove lines with >>>>>>> origin/...
        awk '
        /^<<<<<<< HEAD$/ { skip=1; next }
        /^=======$/ && skip { skip=0; next }
        /^>>>>>>> / { next }
        !skip { print }
        ' "$file" > "$temp_file"
        
        mv "$temp_file" "$file"
        echo "  Manually fixed merge conflicts"
    fi
done

echo "All merge conflicts resolved"