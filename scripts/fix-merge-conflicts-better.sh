#!/bin/bash

# Fix merge conflicts by manually resolving each file

for file in $files_with_conflicts; do
    echo "Fixing merge conflicts in $file"
    
    # Use git checkout to take our version (HEAD)
    git checkout --ours "$file" 2>/dev/null || echo "Could not use git checkout, trying manual fix"
    
    # If git checkout didn't work, manually remove markers
        # Create a temporary file without merge markers
        temp_file=$(mktemp)
        
        awk '
        !skip { print }
        ' "$file" > "$temp_file"
        
        mv "$temp_file" "$file"
        echo "  Manually fixed merge conflicts"
    fi
done

echo "All merge conflicts resolved"
