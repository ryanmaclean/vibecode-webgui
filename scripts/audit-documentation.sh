#!/bin/bash

# Documentation Audit Script
# Analyzes all markdown files in the repository for consolidation

echo "📋 Starting comprehensive documentation audit..."

# Create audit output directory
mkdir -p audit-results

# Find all markdown files
echo "🔍 Scanning for markdown files..."
find . -name "*.md" -o -name "*.mdx" | grep -v node_modules | grep -v .git | sort > audit-results/all-markdown-files.txt

TOTAL_FILES=$(wc -l < audit-results/all-markdown-files.txt)
echo "📊 Found $TOTAL_FILES markdown files"

# Categorize by directory
echo "📁 Categorizing by directory..."
cat audit-results/all-markdown-files.txt | sed 's|/[^/]*$||' | sort | uniq -c | sort -nr > audit-results/files-by-directory.txt

echo "📈 Top directories with markdown files:"
head -20 audit-results/files-by-directory.txt

# Analyze root-level files
echo "🔍 Root-level markdown files:"
ls -la *.md 2>/dev/null | tee audit-results/root-level-files.txt || echo "No root-level .md files"

# Analyze wiki directories
echo "📚 Wiki directory analysis:"
echo "Files in /wiki/:" > audit-results/wiki-analysis.txt
find wiki -name "*.md" 2>/dev/null | wc -l | xargs echo "Count:" >> audit-results/wiki-analysis.txt

echo "Files in /content/wiki/:" >> audit-results/wiki-analysis.txt
find content/wiki -name "*.md" -o -name "*.mdx" 2>/dev/null | wc -l | xargs echo "Count:" >> audit-results/wiki-analysis.txt

cat audit-results/wiki-analysis.txt

# Find duplicate content by title
echo "🔍 Analyzing potential duplicates..."
echo "Files with similar titles:" > audit-results/potential-duplicates.txt

# Extract titles and find patterns
grep -h "^# " $(cat audit-results/all-markdown-files.txt) | sort | uniq -c | sort -nr | head -20 >> audit-results/potential-duplicates.txt

# Analyze file sizes
echo "📏 Analyzing file sizes..."
while read -r file; do
    size=$(wc -c < "$file" 2>/dev/null || echo "0")
    echo "$size $file"
done < audit-results/all-markdown-files.txt | sort -nr > audit-results/files-by-size.txt

echo "📊 Largest markdown files:"
head -10 audit-results/files-by-size.txt

# Find empty or minimal files
echo "🗑️  Finding minimal/empty files..."
while read -r file; do
    lines=$(wc -l < "$file" 2>/dev/null || echo "0")
    if [ "$lines" -lt 10 ]; then
        echo "$lines $file"
    fi
done < audit-results/all-markdown-files.txt > audit-results/minimal-files.txt

echo "📋 Files with less than 10 lines ($(wc -l < audit-results/minimal-files.txt) total):"
head -20 audit-results/minimal-files.txt

# Analyze documentation categories
echo "🏷️  Categorizing by content type..."
echo "=== Documentation Categories ===" > audit-results/content-categories.txt

# Test documentation
grep -l -i "test\|spec\|jest\|playwright" $(cat audit-results/all-markdown-files.txt) | wc -l | xargs echo "Testing docs:" >> audit-results/content-categories.txt

# API documentation  
grep -l -i "api\|endpoint\|route" $(cat audit-results/all-markdown-files.txt) | wc -l | xargs echo "API docs:" >> audit-results/content-categories.txt

# Deployment/Infrastructure
grep -l -i "deploy\|k8s\|kubernetes\|docker\|helm" $(cat audit-results/all-markdown-files.txt) | wc -l | xargs echo "Infrastructure docs:" >> audit-results/content-categories.txt

# Architecture/Design
grep -l -i "architecture\|design\|diagram" $(cat audit-results/all-markdown-files.txt) | wc -l | xargs echo "Architecture docs:" >> audit-results/content-categories.txt

cat audit-results/content-categories.txt

# Generate consolidation recommendations
echo "💡 Generating consolidation recommendations..."
cat > audit-results/consolidation-plan.md << 'EOF'
# Documentation Consolidation Plan

## Current State Analysis
EOF

echo "- Total markdown files: $TOTAL_FILES" >> audit-results/consolidation-plan.md
echo "- Root-level files: $(ls *.md 2>/dev/null | wc -l)" >> audit-results/consolidation-plan.md
echo "- Wiki directory files: $(find wiki -name "*.md" 2>/dev/null | wc -l)" >> audit-results/consolidation-plan.md
echo "- Content/wiki files: $(find content/wiki -name "*.md" -o -name "*.mdx" 2>/dev/null | wc -l)" >> audit-results/consolidation-plan.md

cat >> audit-results/consolidation-plan.md << 'EOF'

## Recommended Actions

### Phase 1: Immediate Cleanup
1. **Root-level consolidation**: Move root .md files to docs/src/content/docs/
2. **Wiki merge**: Consolidate /wiki/ and /content/wiki/ directories
3. **Remove empty files**: Delete files with <10 lines of content
4. **Archive old files**: Move outdated documentation to archive/

### Phase 2: Content Organization
1. **Category-based structure**: Organize by testing, API, infrastructure, etc.
2. **Remove duplicates**: Merge similar content
3. **Update navigation**: Reflect new structure in Astro site
4. **Link validation**: Ensure all internal links work

### Phase 3: Maintenance
1. **Documentation standards**: Create contribution guidelines
2. **Automated checks**: Prevent future scatter
3. **Regular audits**: Monthly documentation health checks

## Priority Files for Review
EOF

echo "" >> audit-results/consolidation-plan.md
echo "### Large files (>10KB):" >> audit-results/consolidation-plan.md
head -10 audit-results/files-by-size.txt | while read -r size file; do
    kb=$((size / 1024))
    echo "- $file (${kb}KB)" >> audit-results/consolidation-plan.md
done

echo "" >> audit-results/consolidation-plan.md
echo "### Minimal files (<10 lines):" >> audit-results/consolidation-plan.md
head -10 audit-results/minimal-files.txt | while read -r lines file; do
    echo "- $file ($lines lines)" >> audit-results/consolidation-plan.md
done

echo ""
echo "✅ Documentation audit complete!"
echo ""
echo "📊 Summary:"
echo "  Total files: $TOTAL_FILES"
echo "  Root-level: $(ls *.md 2>/dev/null | wc -l)"
echo "  Minimal files: $(wc -l < audit-results/minimal-files.txt)"
echo ""
echo "📁 Results saved to audit-results/"
echo "  📋 consolidation-plan.md - Detailed recommendations"
echo "  📊 files-by-directory.txt - Directory breakdown"
echo "  🔍 potential-duplicates.txt - Duplicate analysis"
echo ""
echo "🚀 Next steps:"
echo "  1. Review audit-results/consolidation-plan.md"
echo "  2. Execute consolidation in phases"
echo "  3. Update Astro documentation site structure"
