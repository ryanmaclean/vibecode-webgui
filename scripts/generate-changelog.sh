#!/usr/bin/env bash
#
# Changelog Generation Script
# Generates changelog from conventional commits using git-cliff
#
# Usage:
#   ./scripts/generate-changelog.sh [OPTIONS]
#
# Options:
#   --from TAG        Starting tag/commit (default: last tag)
#   --to TAG          Ending tag/commit (default: HEAD)
#   --tag VERSION     Tag for the release (default: detect from commits)
#   --output FILE     Output file (default: CHANGELOG.md)
#   --preview         Preview changelog without updating file
#   --help            Show this help message
#

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
FROM_TAG=""
TO_TAG="HEAD"
OUTPUT_FILE="CHANGELOG.md"
PREVIEW_MODE=false
VERSION_TAG=""

# Print colored message
log() {
  echo -e "${GREEN}==>${NC} $*"
}

warn() {
  echo -e "${YELLOW}Warning:${NC} $*"
}

error() {
  echo -e "${RED}Error:${NC} $*" >&2
  exit 1
}

# Check if git-cliff is installed
check_dependencies() {
  if ! command -v git-cliff &> /dev/null; then
    error "git-cliff is not installed. Install with: cargo install git-cliff
Or use GitHub releases: https://github.com/orhun/git-cliff/releases"
  fi

  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not a git repository"
  fi
}

# Get the last tag
get_last_tag() {
  git describe --tags --abbrev=0 2>/dev/null || echo ""
}

# Detect next version from commits
detect_next_version() {
  local last_tag="$1"
  local current_version="${last_tag#v}"

  if [ -z "$current_version" ]; then
    echo "v0.1.0"
    return
  fi

  # Parse version components
  IFS='.' read -r major minor patch <<< "$current_version"

  # Check for breaking changes
  if git log "${last_tag}..HEAD" --format=%B | grep -qE "^(feat|fix|perf|refactor).*!:|BREAKING CHANGE:"; then
    major=$((major + 1))
    minor=0
    patch=0
  # Check for features
  elif git log "${last_tag}..HEAD" --format=%B | grep -qE "^feat"; then
    minor=$((minor + 1))
    patch=0
  # Otherwise it's a patch
  else
    patch=$((patch + 1))
  fi

  echo "v${major}.${minor}.${patch}"
}

# Parse command line arguments
parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --from)
        FROM_TAG="$2"
        shift 2
        ;;
      --to)
        TO_TAG="$2"
        shift 2
        ;;
      --tag)
        VERSION_TAG="$2"
        shift 2
        ;;
      --output)
        OUTPUT_FILE="$2"
        shift 2
        ;;
      --preview)
        PREVIEW_MODE=true
        shift
        ;;
      --help)
        grep '^#' "$0" | sed 's/^# //'
        exit 0
        ;;
      *)
        error "Unknown option: $1. Use --help for usage information."
        ;;
    esac
  done
}

# Generate changelog
generate_changelog() {
  local temp_file="CHANGELOG_NEW.md"
  local range=""

  # Determine version range
  if [ -z "$FROM_TAG" ]; then
    FROM_TAG=$(get_last_tag)
    if [ -z "$FROM_TAG" ]; then
      log "No previous tag found. Generating changelog from all commits."
    else
      log "Using last tag as starting point: $FROM_TAG"
    fi
  fi

  # Detect version if not provided
  if [ -z "$VERSION_TAG" ] && [ "$TO_TAG" == "HEAD" ]; then
    VERSION_TAG=$(detect_next_version "$FROM_TAG")
    log "Detected next version: $VERSION_TAG"
  elif [ -z "$VERSION_TAG" ]; then
    VERSION_TAG="$TO_TAG"
  fi

  # Build git-cliff command
  local cliff_cmd="git-cliff"

  if [ -n "$FROM_TAG" ] && [ "$FROM_TAG" != "$TO_TAG" ]; then
    range="${FROM_TAG}..${TO_TAG}"
    cliff_cmd="$cliff_cmd $range"
  fi

  if [ "$VERSION_TAG" != "HEAD" ]; then
    cliff_cmd="$cliff_cmd --tag $VERSION_TAG"
  fi

  cliff_cmd="$cliff_cmd --output $temp_file"

  # Generate changelog
  log "Generating changelog..."
  log "Command: $cliff_cmd"

  eval "$cliff_cmd" || error "Failed to generate changelog"

  # Check if changelog was generated
  if [ ! -f "$temp_file" ]; then
    error "Changelog file was not created"
  fi

  # Preview or update
  if [ "$PREVIEW_MODE" = true ]; then
    log "Changelog preview:"
    echo ""
    cat "$temp_file"
    rm "$temp_file"
  else
    # Merge with existing changelog
    if [ -f "$OUTPUT_FILE" ]; then
      log "Merging with existing changelog..."

      # Extract header from existing file
      HEADER=$(awk '/^## \[/{exit} {print}' "$OUTPUT_FILE")

      # Combine: new content + existing releases
      {
        echo "$HEADER"
        tail -n +3 "$temp_file"  # Skip header from new file
        awk '/^## \[/{p=1} p' "$OUTPUT_FILE"  # Existing releases
      } > "${OUTPUT_FILE}.tmp"

      mv "${OUTPUT_FILE}.tmp" "$OUTPUT_FILE"
      rm "$temp_file"
    else
      mv "$temp_file" "$OUTPUT_FILE"
    fi

    log "Changelog updated: $OUTPUT_FILE"

    # Show summary
    echo ""
    log "Recent changes:"
    head -n 50 "$OUTPUT_FILE"
  fi
}

# Validate conventional commits
validate_commits() {
  log "Validating commit messages..."

  local invalid_commits=0
  local range="${FROM_TAG:-$(git rev-list --max-parents=0 HEAD)}..${TO_TAG}"

  while IFS= read -r commit; do
    local message=$(git log --format=%s -n 1 "$commit")

    if ! echo "$message" | grep -qE "^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert|security)(\(.*\))?!?:"; then
      warn "Non-conventional commit: $commit - $message"
      invalid_commits=$((invalid_commits + 1))
    fi
  done < <(git rev-list "$range")

  if [ $invalid_commits -gt 0 ]; then
    warn "Found $invalid_commits non-conventional commits"
    echo "See docs/CHANGELOG_GUIDE.md for commit message format"
  else
    log "All commits follow conventional format"
  fi
}

# Main execution
main() {
  parse_args "$@"
  check_dependencies

  log "Changelog Generator for VibeCode WebGUI"
  echo ""

  validate_commits
  generate_changelog

  if [ "$PREVIEW_MODE" = false ]; then
    echo ""
    log "Next steps:"
    echo "  1. Review the changelog: $OUTPUT_FILE"
    echo "  2. Commit changes: git add $OUTPUT_FILE && git commit -m 'docs: update changelog'"
    echo "  3. Create release: git tag $VERSION_TAG && git push origin $VERSION_TAG"
  fi
}

main "$@"
