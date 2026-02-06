#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e

# Add frontmatter to markdown files that need it

# Initialize log aggregation
init_log_aggregation

echo "🔧 Adding frontmatter to markdown files"

DOCS_DIR="/Users/ryan.maclean/vibecode-webgui/docs/src/content/docs"

cd "$DOCS_DIR"

for file in *.md; do
    if [ -f "$file" ]; then
        # Check if file already has frontmatter
        if ! head -n 1 "$file" | grep -q "^---"; then
            # Extract title from filename or first heading
            title=$(echo "$file" | sed 's/\.md$//' | sed 's/_/ /g' | sed 's/-/ /g')
            
            # Create temporary file with frontmatter
            temp_file=$(mktemp)
            
            echo "---" > "$temp_file"
            echo "title: $title" >> "$temp_file"
            echo "description: $title documentation" >> "$temp_file"
            echo "---" >> "$temp_file"
            echo "" >> "$temp_file"
            cat "$file" >> "$temp_file"
            
            # Replace original file
            mv "$temp_file" "$file"
            echo "✅ Added frontmatter to $file"
        else
            echo "✅ $file already has frontmatter"
        fi
    fi
done

echo "🎯 Frontmatter added to all markdown files"