#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

find . -name "*.md" -maxdepth 1 -not -path "./README.md" -not -path "./CODE_OF_CONDUCT.md" -not -path "./SECURITY.md" -not -path "./CONTRIBUTING.md" -not -path "./LICENSE.md" | while read file; do
  filename=$(basename "$file")

# Initialize log aggregation
init_log_aggregation

  cp "$file" "archive/root-md-files/$filename"
done
