#!/bin/bash
find . -name "*.md" -maxdepth 1 -not -path "./README.md" -not -path "./CODE_OF_CONDUCT.md" -not -path "./SECURITY.md" -not -path "./CONTRIBUTING.md" -not -path "./LICENSE.md" | while read file; do
  filename=$(basename "$file")
  cp "$file" "archive/root-md-files/$filename"
done
