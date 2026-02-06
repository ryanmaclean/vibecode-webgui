#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Standardize Vector Error Handling v2
# This script updates all vector database adapters to use the new standardized error handling system
# It includes thorough verification to ensure changes are valid and provides rollback capability

# Initialize log aggregation
init_log_aggregation


set -e

# Default configuration
DRY_RUN=false
VERBOSE=false
ROLLBACK=false
BACKUP_DIR=""
ADAPTERS_PROCESSED=0
ERRORS_FIXED=0

# Define base directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="${SCRIPT_DIR}/../src/lib/vector-db"
TEST_DIR="${SCRIPT_DIR}/../tests/unit"
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${SCRIPT_DIR}/../.backup/vector-db-migration_${BACKUP_TIMESTAMP}"

# Print script banner
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "             Vector Database Error Handling Migration Script v2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --rollback)
      ROLLBACK=true
      shift
      if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
        BACKUP_DIR="$1"
        shift
      fi
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --dry-run       Show what would be done without making changes"
      echo "  --verbose       Show detailed output during execution"
      echo "  --rollback [dir] Rollback changes from specified backup directory"
      echo "                  If no directory specified, shows available backups"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Functions

# Log message with timestamp
log() {
  local level="$1"
  local message="$2"
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  
  case $level in
    INFO)
      echo -e "[$timestamp] \033[0;32mINFO\033[0m: $message"
      ;;
    WARN)
      echo -e "[$timestamp] \033[0;33mWARN\033[0m: $message"
      ;;
    ERROR)
      echo -e "[$timestamp] \033[0;31mERROR\033[0m: $message"
      ;;
    DEBUG)
      if [[ "$VERBOSE" == true ]]; then
        echo -e "[$timestamp] \033[0;36mDEBUG\033[0m: $message"
      fi
      ;;
    *)
      echo -e "[$timestamp] $message"
      ;;
  esac
}

# Create backup of files before modification
create_backup() {
  log "INFO" "Creating backup of vector database files in $BACKUP_DIR"
  
  if [[ "$DRY_RUN" == true ]]; then
    log "DEBUG" "Would create backup directory: $BACKUP_DIR"
    return 0
  fi
  
  # Create backup directory
  mkdir -p "$BACKUP_DIR"
  
  # Copy all vector database files to backup directory
  cp -r "$BASE_DIR"/* "$BACKUP_DIR/"
  
  log "INFO" "Backup created successfully at $BACKUP_DIR"
  
  # Create a metadata file with timestamp and version
  cat > "$BACKUP_DIR/backup-metadata.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "script_version": "2.0",
  "files_backed_up": $(find "$BACKUP_DIR" -type f | wc -l),
  "adapters": [
    "postgres-vector-database-adapter.ts",
    "redis-vector-database-adapter.ts",
    "cosmosdb-vector-database-adapter.ts",
    "sqlserver-vector-database-adapter.ts",
    "enhanced-vector-database-adapter.ts",
    "cognitive-search-vector-database-adapter.ts"
  ]
}
EOF
}

# Perform rollback from backup
perform_rollback() {
  local target_dir="$1"
  
  # If no target directory specified, list available backups
  if [[ -z "$target_dir" ]]; then
    list_backups
    return 0
  fi
  
  # Check if target directory exists
  if [[ ! -d "$target_dir" ]]; then
    log "ERROR" "Backup directory not found: $target_dir"
    return 1
  fi
  
  log "INFO" "Rolling back changes from backup: $target_dir"
  
  if [[ "$DRY_RUN" == true ]]; then
    log "DEBUG" "Would restore files from $target_dir to $BASE_DIR"
    return 0
  fi
  
  # Create a new backup of current state before rollback
  local rollback_backup="${SCRIPT_DIR}/../.backup/pre_rollback_${BACKUP_TIMESTAMP}"
  mkdir -p "$rollback_backup"
  cp -r "$BASE_DIR"/* "$rollback_backup/"
  log "INFO" "Created pre-rollback backup at $rollback_backup"
  
  # Restore files from backup
  cp -r "$target_dir"/* "$BASE_DIR/"
  
  log "INFO" "Rollback completed successfully"
  log "INFO" "Previous state backed up at $rollback_backup"
  
  return 0
}

# List available backups
list_backups() {
  local backup_base="${SCRIPT_DIR}/../.backup"
  
  if [[ ! -d "$backup_base" ]]; then
    log "INFO" "No backups found"
    return 0
  fi
  
  echo "Available backups:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  for backup in "$backup_base"/vector-db-migration_*; do
    if [[ -d "$backup" ]]; then
      local timestamp=$(basename "$backup" | sed 's/vector-db-migration_//')
      local formatted_date=$(date -r "$backup" "+%Y-%m-%d %H:%M:%S")
      local file_count=$(find "$backup" -type f | wc -l)
      
      echo -e "Path: \033[0;36m$backup\033[0m"
      echo "Created: $formatted_date"
      echo "Files: $file_count"
      
      # Show metadata if available
      if [[ -f "$backup/backup-metadata.json" ]]; then
        echo "Description: Pre-migration backup"
        echo "Version: $(grep -o '"script_version": "[^"]*"' "$backup/backup-metadata.json" | cut -d'"' -f4)"
      else
        echo "Description: Backup (no metadata)"
      fi
      echo "────────────────────────────────────────────────────────────────────────────────"
    fi
  done
}

# Verify files to ensure they're valid TypeScript after modifications
verify_typescript_files() {
  log "INFO" "Verifying TypeScript files..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log "DEBUG" "Would verify TypeScript files"
    return 0
  fi
  
  # Check if tsc is available
  if ! command -v npx &> /dev/null; then
    log "WARN" "npx not found, skipping TypeScript verification"
    return 0
  fi
  
  # Create temporary tsconfig for verification
  temp_tsconfig=$(mktemp)
  cat > "$temp_tsconfig" << EOF
{
  "compilerOptions": {
    "target": "es2016",
    "module": "commonjs",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "${BASE_DIR}/*.ts"
  ]
}
EOF
  
  # Run TypeScript compiler in noEmit mode to verify syntax
  if ! npx tsc --noEmit --project "$temp_tsconfig"; then
    log "ERROR" "TypeScript verification failed!"
    rm "$temp_tsconfig"
    return 1
  fi
  
  # Clean up
  rm "$temp_tsconfig"
  log "INFO" "TypeScript verification passed"
  return 0
}

# Run unit tests to verify functionality
run_unit_tests() {
  log "INFO" "Running vector database error handler unit tests..."
  
  if [[ "$DRY_RUN" == true ]]; then
    log "DEBUG" "Would run unit tests"
    return 0
  fi
  
  # Check if the test file exists
  if [[ ! -f "${TEST_DIR}/vector-db-error-handler.test.ts" ]]; then
    log "WARN" "Test file not found: ${TEST_DIR}/vector-db-error-handler.test.ts"
    log "WARN" "Skipping unit tests"
    return 0
  fi
  
  # Run the tests
  if ! npx jest "${TEST_DIR}/vector-db-error-handler.test.ts"; then
    log "ERROR" "Unit tests failed!"
    return 1
  fi
  
  log "INFO" "Unit tests passed successfully"
  return 0
}

# Update adapter imports
update_adapter_imports() {
  local file="$1"
  local file_basename=$(basename "$file")
  
  log "DEBUG" "Updating imports in $file_basename"
  
  if [[ "$DRY_RUN" == true ]]; then
    log "DEBUG" "Would update imports in $file_basename"
    return 0
  fi
  
  # Check if already using new error handler
  if grep -q "vector-db-error-handler-new" "$file"; then
    log "DEBUG" "File $file_basename already using new error handler"
    return 0
  fi
  
  # Add import if it doesn't exist
  if ! grep -q "VectorDbErrorHandler" "$file"; then
    # Find the last import line
    last_import_line=$(grep -n "import" "$file" | tail -1 | cut -d: -f1)
    
    # Add the error handler import after the last import
    awk -v n="$last_import_line" -v s="import { VectorDbError, VectorDbErrorType, VectorDbErrorHandler } from './vector-db-error-handler-new';" 'NR == n {print; print s} NR != n {print}' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    log "DEBUG" "Added error handler import to $file_basename"
  else
    # Update existing import to use new file
    sed -i '' "s/from '.\/vector-db-error-handler'/from '.\/vector-db-error-handler-new'/g" "$file"
    log "DEBUG" "Updated error handler import in $file_basename"
  fi
  
  return 0
}

# Add error handler property to adapter class
add_error_handler_property() {
  local file="$1"
  local file_basename=$(basename "$file")
  
  log "DEBUG" "Adding error handler property to $file_basename"
  
  if [[ "$DRY_RUN" == true ]]; then
    log "DEBUG" "Would add error handler property to $file_basename"
    return 0
  fi
  
  # Check if the error handler property already exists
  if grep -q "errorHandler:" "$file"; then
    log "DEBUG" "Error handler property already exists in $file_basename"
    return 0
  fi
  
  # Add error handler property to the class
  if grep -q "private " "$file"; then
    # Find the last private property declaration
    last_private_line=$(grep -n "private " "$file" | tail -1 | cut -d: -f1)
    
    # Add the error handler property after the last private property
    awk -v n="$last_private_line" -v s="  private errorHandler: VectorDbErrorHandler;" 'NR == n {print; print s} NR != n {print}' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    log "DEBUG" "Added error handler property to $file_basename"
  else
    log "WARN" "Could not find private property line in $file_basename"
  fi
  
  return 0
}

# Initialize error handler in constructor
initialize_error_handler() {
  local file="$1"
  local provider="$2"
  local file_basename=$(basename "$file")
  
  log "DEBUG" "Initializing error handler in constructor of $file_basename"
  
  if [[ "$DRY_RUN" == true ]]; then
    log "DEBUG" "Would initialize error handler in constructor of $file_basename"
    return 0
  fi
  
  # Check if the error handler is already initialized
  if grep -q "this.errorHandler = new VectorDbErrorHandler" "$file"; then
    log "DEBUG" "Error handler already initialized in $file_basename"
    return 0
  fi
  
  # Initialize the error handler in the constructor
  if grep -q "constructor" "$file"; then
    # Find the super(config) line in the constructor
    super_line=$(grep -n "super(config)" "$file" | head -1 | cut -d: -f1)
    
    if [[ -n "$super_line" ]]; then
      # Add the error handler initialization after super(config)
      awk -v n="$super_line" -v s="    this.errorHandler = new VectorDbErrorHandler('${provider}', this.config.enableLogging || false, this.config.enableMetrics || false);" 'NR == n {print; print s} NR != n {print}' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
      log "DEBUG" "Added error handler initialization to constructor in $file_basename"
    else
      log "WARN" "Could not find super(config) line in constructor in $file_basename"
    fi
  else
    log "WARN" "Could not find constructor in $file_basename"
  fi
  
  return 0
}

# Update error throwing to use error handler
update_error_throws() {
  local file="$1"
  local file_basename=$(basename "$file")
  
  log "DEBUG" "Updating error throws in $file_basename"
  
  if [[ "$DRY_RUN" == true ]]; then
    log "DEBUG" "Would update error throws in $file_basename"
    return 0
  fi
  
  # Find all lines that throw new Error
  local throw_lines=$(grep -n "throw new Error" "$file" | cut -d: -f1)
  local throw_count=0
  
  if [[ -z "$throw_lines" ]]; then
    log "DEBUG" "No direct throw statements found in $file_basename"
    return 0
  fi
  
  log "DEBUG" "Found $(echo "$throw_lines" | wc -w) throw statements in $file_basename"
  
  # Process each throw line
  for line in $throw_lines; do
    # Get the original throw line
    original_line=$(sed -n "${line}p" "$file")
    
    # Skip if already using error handler
    if [[ "$original_line" == *"errorHandler.handleError"* ]]; then
      continue
    fi
    
    # Extract the error message
    error_message=$(echo "$original_line" | sed -n "s/.*throw new Error(\(.*\));.*/\1/p")
    
    # Get the method name
    method_name=$(grep -B 10 -A 0 -n "$original_line" "$file" | grep -E "async [a-zA-Z0-9_]+\(" | tail -1 | sed -n "s/.*async \([a-zA-Z0-9_]\+\)(.*/\1/p")
    
    if [[ -z "$method_name" ]]; then
      # Try without async
      method_name=$(grep -B 10 -A 0 -n "$original_line" "$file" | grep -E "public [a-zA-Z0-9_]+\(" | tail -1 | sed -n "s/.*public \([a-zA-Z0-9_]\+\)(.*/\1/p")
    fi
    
    if [[ -z "$method_name" ]]; then
      # Try protected methods
      method_name=$(grep -B 10 -A 0 -n "$original_line" "$file" | grep -E "protected [a-zA-Z0-9_]+\(" | tail -1 | sed -n "s/.*protected \([a-zA-Z0-9_]\+\)(.*/\1/p")
    fi
    
    if [[ -z "$method_name" ]]; then
      # Try private methods
      method_name=$(grep -B 10 -A 0 -n "$original_line" "$file" | grep -E "private [a-zA-Z0-9_]+\(" | tail -1 | sed -n "s/.*private \([a-zA-Z0-9_]\+\)(.*/\1/p")
    fi
    
    if [[ -z "$method_name" ]]; then
      method_name="unknown"
    fi
    
    # Determine error type based on context
    error_type="VectorDbErrorType.UNKNOWN_ERROR"
    retryable="false"
    
    if [[ "$original_line" == *"initialize"* || "$original_line" == *"not initialized"* ]]; then
      error_type="VectorDbErrorType.INITIALIZATION"
      retryable="true"
    elif [[ "$original_line" == *"connect"* || "$original_line" == *"connection"* ]]; then
      error_type="VectorDbErrorType.CONNECTION"
      retryable="true"
    elif [[ "$original_line" == *"search"* ]]; then
      error_type="VectorDbErrorType.SEARCH"
    elif [[ "$method_name" == *"search"* ]]; then
      error_type="VectorDbErrorType.SEARCH"
    elif [[ "$method_name" == *"store"* || "$method_name" == *"add"* || "$method_name" == *"create"* ]]; then
      error_type="VectorDbErrorType.VECTOR_OPERATION_FAILED"
    elif [[ "$method_name" == *"delete"* || "$method_name" == *"remove"* ]]; then
      error_type="VectorDbErrorType.VECTOR_OPERATION_FAILED"
    elif [[ "$method_name" == *"update"* ]]; then
      error_type="VectorDbErrorType.VECTOR_OPERATION_FAILED"
    elif [[ "$original_line" == *"not implemented"* || "$original_line" == *"Not implemented"* ]]; then
      error_type="VectorDbErrorType.UNSUPPORTED_OPERATION"
    elif [[ "$original_line" == *"timeout"* || "$original_line" == *"timed out"* ]]; then
      error_type="VectorDbErrorType.TIMEOUT"
      retryable="true"
    elif [[ "$original_line" == *"auth"* || "$original_line" == *"permission"* || "$original_line" == *"credential"* ]]; then
      error_type="VectorDbErrorType.AUTHORIZATION_ERROR"
    fi
    
    # Get indentation from original line
    indentation=$(echo "$original_line" | sed 's/\(^ *\).*/\1/')
    
    # Create the new line with error handler
    new_line="${indentation}throw this.errorHandler.handleError(new Error(${error_message}), '${method_name}', ${error_type}, ${retryable});"
    
    # Replace the line
    sed -i '' "${line}s|.*|${new_line}|" "$file"
    log "DEBUG" "Replaced direct throw with error handler in line ${line}"
    throw_count=$((throw_count + 1))
  done
  
  log "INFO" "Updated $throw_count throw statements in $file_basename"
  ERRORS_FIXED=$((ERRORS_FIXED + throw_count))
  
  return 0
}

# Update catch blocks to use error handler
update_catch_blocks() {
  local file="$1"
  local file_basename=$(basename "$file")
  
  log "DEBUG" "Updating catch blocks in $file_basename"
  
  if [[ "$DRY_RUN" == true ]]; then
    log "DEBUG" "Would update catch blocks in $file_basename"
    return 0
  fi
  
  # Find all catch blocks
  local catch_lines=$(grep -n "} catch (error" "$file" | cut -d: -f1)
  local catch_count=0
  
  if [[ -z "$catch_lines" ]]; then
    log "DEBUG" "No catch blocks found in $file_basename"
    return 0
  fi
  
  log "DEBUG" "Found $(echo "$catch_lines" | wc -w) catch blocks in $file_basename"
  
  # Process each catch block
  for line in $catch_lines; do
    # Skip if already processed
    local next_line=$((line + 1))
    local next_content=$(sed -n "${next_line}p" "$file")
    
    if [[ "$next_content" == *"errorHandler.handleError"* ]]; then
      continue
    fi
    
    # Check for direct throw of the error
    if [[ "$next_content" == *"throw error"* ]]; then
      # Get the method name
      local block_start=$(grep -B 20 -n "} catch (error" "$file" | grep -E "(public|private|protected|async) [a-zA-Z0-9_]+\(" | tail -1 | cut -d: -f1)
      local method_line=$(sed -n "${block_start}p" "$file")
      local method_name=$(echo "$method_line" | sed -n "s/.*\(public\|private\|protected\|async\) \([a-zA-Z0-9_]\+\)(.*/\2/p")
      
      if [[ -z "$method_name" ]]; then
        method_name="unknown"
      fi
      
      # Determine error type based on method name
      local error_type="VectorDbErrorType.UNKNOWN_ERROR"
      local retryable="this.errorHandler.isNetworkError(error) || this.errorHandler.isTimeoutError(error)"
      
      if [[ "$method_name" == *"initialize"* ]]; then
        error_type="VectorDbErrorType.INITIALIZATION"
      elif [[ "$method_name" == *"connect"* ]]; then
        error_type="VectorDbErrorType.CONNECTION"
      elif [[ "$method_name" == *"search"* ]]; then
        error_type="VectorDbErrorType.SEARCH"
      elif [[ "$method_name" == *"store"* || "$method_name" == *"add"* || "$method_name" == *"create"* ]]; then
        error_type="VectorDbErrorType.VECTOR_OPERATION_FAILED"
      elif [[ "$method_name" == *"delete"* || "$method_name" == *"remove"* ]]; then
        error_type="VectorDbErrorType.VECTOR_OPERATION_FAILED"
      elif [[ "$method_name" == *"update"* ]]; then
        error_type="VectorDbErrorType.VECTOR_OPERATION_FAILED"
      fi
      
      # Get indentation from catch line
      local indentation=$(echo "$next_content" | sed 's/\(^ *\).*/\1/')
      
      # Check if we need to add instance of check
      local instance_check=""
      if grep -q "VectorDbError" "$file"; then
        instance_check="if (!(error instanceof VectorDbError)) {\n${indentation}  "
        instance_check_close="\n${indentation}}"
      fi
      
      # Create the new line with error handler
      local new_line="${indentation}${instance_check}throw this.errorHandler.handleError(\n${indentation}  error,\n${indentation}  '${method_name}',\n${indentation}  ${error_type},\n${indentation}  ${retryable}\n${indentation});${instance_check_close}"
      
      # Replace the line
      sed -i '' "${next_line}s|.*|${new_line}|" "$file"
      log "DEBUG" "Enhanced catch block at line ${line}"
      catch_count=$((catch_count + 1))
    fi
  done
  
  log "INFO" "Updated $catch_count catch blocks in $file_basename"
  
  return 0
}

# Process an adapter file
process_adapter() {
  local file="$1"
  local provider="$2"
  local file_basename=$(basename "$file")
  
  log "INFO" "Processing adapter: $file_basename"
  
  if [[ ! -f "$file" ]]; then
    log "ERROR" "File not found: $file"
    return 1
  fi
  
  # Perform the updates
  update_adapter_imports "$file"
  add_error_handler_property "$file"
  initialize_error_handler "$file" "$provider"
  update_error_throws "$file"
  update_catch_blocks "$file"
  
  log "INFO" "Completed processing adapter: $file_basename"
  ADAPTERS_PROCESSED=$((ADAPTERS_PROCESSED + 1))
  
  return 0
}

# Main execution logic

# Handle rollback if requested
if [[ "$ROLLBACK" == true ]]; then
  perform_rollback "$BACKUP_DIR"
  exit $?
fi

# Create backup before making changes
if [[ "$DRY_RUN" == false ]]; then
  create_backup
fi

# Print configuration
log "INFO" "Starting error handling migration with configuration:"
log "INFO" "- Base directory: $BASE_DIR"
log "INFO" "- Backup directory: $BACKUP_DIR"
log "INFO" "- Dry run: $DRY_RUN"
log "INFO" "- Verbose: $VERBOSE"
echo ""

# Process each adapter
log "INFO" "Processing adapters..."

# Process the base adapter first
log "INFO" "Processing base adapter..."
if [[ "$DRY_RUN" == false ]]; then
  update_adapter_imports "${BASE_DIR}/base-vector-database-adapter.ts"
fi

# Process all adapters
process_adapter "${BASE_DIR}/postgres-vector-database-adapter.ts" "postgres"
process_adapter "${BASE_DIR}/redis-vector-database-adapter.ts" "redis" 
process_adapter "${BASE_DIR}/cosmosdb-vector-database-adapter.ts" "cosmosdb"
process_adapter "${BASE_DIR}/sqlserver-vector-database-adapter.ts" "sqlserver"
process_adapter "${BASE_DIR}/enhanced-vector-database-adapter.ts" "enhanced"
process_adapter "${BASE_DIR}/cognitive-search-vector-database-adapter.ts" "cognitive-search"

# Verify changes
if [[ "$DRY_RUN" == false ]]; then
  verify_typescript_files
  # run_unit_tests (uncomment when tests are ready)
fi

# Print summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                         Migration Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  log "INFO" "DRY RUN - No changes were made"
else
  log "INFO" "Migration completed successfully"
fi

log "INFO" "Adapters processed: $ADAPTERS_PROCESSED"
log "INFO" "Error patterns fixed: $ERRORS_FIXED"

if [[ "$DRY_RUN" == false ]]; then
  log "INFO" "Backup created at: $BACKUP_DIR"
  log "INFO" "To rollback changes, run: $0 --rollback $BACKUP_DIR"
fi

echo ""
log "INFO" "Next steps:"
echo "  1. Run unit tests: npm test -- -t 'Vector Database Error Handler'"
echo "  2. Verify adapter functionality in development environment"
echo "  3. Follow the phased rollout plan for production deployment"
echo ""

exit 0