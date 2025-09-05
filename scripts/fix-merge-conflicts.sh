#!/bin/bash

# Fix merge conflicts by taking HEAD version
for file in $(grep -rn "<<<<<<< HEAD" src/ --include="*.ts" --include="*.tsx" | cut -d: -f1 | sort -u); do
    echo "Fixing merge conflicts in $file"
    
    # Remove merge conflict markers and take HEAD version
    sed -i '' -e '/<<<<<<< HEAD/,/=======/{/=======/d;}' -e '/>>>>>>> origin\/feature\/general-improvements-fixed/d' "$file"
done

echo "Merge conflicts resolved"