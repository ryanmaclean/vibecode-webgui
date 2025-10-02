#!/usr/bin/env bash
# Changelog Helper Script
# Generates formatted changelog entries from git commits
# Usage: ./scripts/changelog-helper.sh [previous_tag] [current_tag]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not a git repository"
    exit 1
fi

# Get tags
PREVIOUS_TAG="${1:-}"
CURRENT_TAG="${2:-HEAD}"

# Auto-detect tags if not provided
if [ -z "$PREVIOUS_TAG" ]; then
    PREVIOUS_TAG=$(git tag --sort=-version:refname | head -n1)
    if [ -z "$PREVIOUS_TAG" ]; then
        print_warning "No previous tag found, using initial commit"
        PREVIOUS_TAG=$(git rev-list --max-parents=0 HEAD)
    else
        print_success "Auto-detected previous tag: $PREVIOUS_TAG"
    fi
fi

if [ "$CURRENT_TAG" = "HEAD" ]; then
    print_warning "Using HEAD as current version (unreleased)"
fi

print_header "Generating Changelog"
echo "From: $PREVIOUS_TAG"
echo "To:   $CURRENT_TAG"
echo ""

# Get commit range
COMMITS=$(git log "${PREVIOUS_TAG}..${CURRENT_TAG}" --pretty=format:"%H|||%s|||%b|||%an" --no-merges 2>/dev/null || true)

if [ -z "$COMMITS" ]; then
    print_error "No commits found between $PREVIOUS_TAG and $CURRENT_TAG"
    exit 1
fi

# Initialize category arrays
declare -A categories
declare -A category_headers
declare -A category_commits

# Define categories and headers
category_headers["feat"]="### Added"
category_headers["fix"]="### Fixed"
category_headers["security"]="### Security"
category_headers["perf"]="### Performance"
category_headers["refactor"]="### Changed"
category_headers["docs"]="### Documentation"
category_headers["test"]="### Tests"
category_headers["ci"]="### CI/CD"
category_headers["workflow"]="### Workflow"
category_headers["chore"]="### Maintenance"
category_headers["style"]="### Style"
category_headers["deprecate"]="### Deprecated"
category_headers["remove"]="### Removed"
category_headers["other"]="### Other Changes"

# Parse commits
declare -i total_commits=0
declare -i conventional_commits=0
declare -i breaking_changes=0

while IFS='|||' read -r hash subject body author; do
    if [ -z "$hash" ]; then continue; fi

    ((total_commits++))

    short_hash="${hash:0:7}"

    # Check for breaking change
    is_breaking=false
    if [[ "$subject" == *"!"* ]] || [[ "$body" == *"BREAKING CHANGE"* ]]; then
        is_breaking=true
        ((breaking_changes++))
    fi

    # Extract conventional commit type and scope
    if [[ $subject =~ ^([a-z]+)(\(.+\))?(!)?:\ (.+)$ ]]; then
        type="${BASH_REMATCH[1]}"
        scope="${BASH_REMATCH[2]}"
        breaking="${BASH_REMATCH[3]}"
        desc="${BASH_REMATCH[4]}"

        ((conventional_commits++))

        # Remove parentheses from scope
        scope="${scope#(}"
        scope="${scope%)}"

        # Format entry
        if [ "$is_breaking" = true ]; then
            entry="- **BREAKING**: "
        else
            entry="- "
        fi

        if [ -n "$scope" ]; then
            entry+="**${scope}**: ${desc} (\`${short_hash}\`)"
        else
            entry+="${desc} (\`${short_hash}\`)"
        fi

        # Categorize
        if [ -n "${category_headers[$type]:-}" ]; then
            category_commits["$type"]+="${entry}"$'\n'
        else
            category_commits["other"]+="${entry}"$'\n'
        fi
    else
        # Non-conventional commit
        entry="- ${subject} (\`${short_hash}\`)"
        category_commits["other"]+="${entry}"$'\n'
    fi
done <<< "$COMMITS"

# Get unique contributors
contributors=$(git log "${PREVIOUS_TAG}..${CURRENT_TAG}" --format='%an' --no-merges | sort -u | wc -l)

# Generate changelog output
print_header "Changelog Entry"

# Determine version
if [ "$CURRENT_TAG" = "HEAD" ]; then
    version="Unreleased"
    date_str=""
else
    version="${CURRENT_TAG#v}"  # Remove 'v' prefix if present
    date_str=" - $(date +%Y-%m-%d)"
fi

echo ""
echo "## [${version}]${date_str}"
echo ""

# Output categories in order
category_order=(feat fix security perf refactor docs deprecate remove test ci workflow chore style other)

for cat in "${category_order[@]}"; do
    if [ -n "${category_commits[$cat]:-}" ]; then
        echo "${category_headers[$cat]}"
        echo ""
        echo -e "${category_commits[$cat]}"
    fi
done

# Print statistics
print_header "Statistics"
echo ""
echo "Total commits:         $total_commits"
echo "Conventional commits:  $conventional_commits"
echo "Breaking changes:      $breaking_changes"
echo "Contributors:          $contributors"
echo ""

# Calculate conventional commit percentage
if [ $total_commits -gt 0 ]; then
    conventional_percent=$((conventional_commits * 100 / total_commits))

    if [ $conventional_percent -lt 50 ]; then
        print_warning "Only ${conventional_percent}% of commits follow conventional format"
        echo "   Consider adopting conventional commits for better changelog automation"
    elif [ $conventional_percent -lt 80 ]; then
        print_success "${conventional_percent}% conventional commits (good progress!)"
    else
        print_success "${conventional_percent}% conventional commits (excellent!)"
    fi
fi

# List contributors
print_header "Contributors"
echo ""
git log "${PREVIOUS_TAG}..${CURRENT_TAG}" --format='%an' --no-merges | sort -u | sed 's/^/  - /'
echo ""

# Check for breaking changes
if [ $breaking_changes -gt 0 ]; then
    print_warning "This release contains $breaking_changes breaking change(s)"
    echo "   Ensure migration guide is included in changelog"
    echo ""
fi

# Usage tips
print_header "Next Steps"
echo ""
echo "1. Copy the changelog entry above"
echo "2. Open CHANGELOG.md and add it under appropriate version"
echo "3. Review and refine descriptions for clarity"
echo "4. Add any additional context or migration notes"
echo "5. Commit with: git commit -m 'docs: update CHANGELOG.md for ${version}'"
echo ""

# Save to file option
if [ -t 1 ]; then  # Check if stdout is a terminal
    read -p "Save to file? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        output_file="changelog-${version}-$(date +%Y%m%d-%H%M%S).md"

        {
            echo "## [${version}]${date_str}"
            echo ""
            for cat in "${category_order[@]}"; do
                if [ -n "${category_commits[$cat]:-}" ]; then
                    echo "${category_headers[$cat]}"
                    echo ""
                    echo -e "${category_commits[$cat]}"
                fi
            done
        } > "$output_file"

        print_success "Saved to: $output_file"
    fi
fi

print_success "Changelog generation complete!"
