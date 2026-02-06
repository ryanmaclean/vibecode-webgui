#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Script to standardize error handling across vector database adapters
# This script updates all vector database adapters to use the new VectorDbErrorHandler class

# Initialize log aggregation
init_log_aggregation


# Get the directory of the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LIB_DIR="${PROJECT_ROOT}/src/lib/vector-db"

echo "Standardizing error handling in vector database adapters..."
echo "Working in directory: ${LIB_DIR}"

# Function to add error handler to adapter
migrate_adapter_to_new_error_handler() {
    local adapter_file=$1
    local provider_name=$2
    
    echo "Processing adapter: ${adapter_file}"
    
    # Check if the file exists
    if [ ! -f "${LIB_DIR}/${adapter_file}" ]; then
        echo "Error: File ${LIB_DIR}/${adapter_file} not found."
        return 1
    fi
    
    # Create a backup of the original file
    cp "${LIB_DIR}/${adapter_file}" "${LIB_DIR}/${adapter_file}.bak"
    echo "Created backup: ${adapter_file}.bak"
    
    # Update import statements
    sed -i 's/import { VectorDBErrorType, VectorDBError, handleVectorDBError } from .\/vector-db-error-handler/import { VectorDbErrorType, VectorDbError, VectorDbErrorHandler } from .\/vector-db-error-handler-new/g' "${LIB_DIR}/${adapter_file}"
    sed -i 's/import { VectorDBErrorType, handleVectorDBError } from .\/vector-db-error-handler/import { VectorDbErrorType, VectorDbErrorHandler } from .\/vector-db-error-handler-new/g' "${LIB_DIR}/${adapter_file}"
    sed -i 's/import { handleVectorDBError } from .\/vector-db-error-handler/import { VectorDbErrorHandler } from .\/vector-db-error-handler-new/g' "${LIB_DIR}/${adapter_file}"
    sed -i 's/import { VectorDBError, VectorDBErrorType } from .\/vector-db-error-handler/import { VectorDbError, VectorDbErrorType } from .\/vector-db-error-handler-new/g' "${LIB_DIR}/${adapter_file}"
    
    echo "Updated import statements in ${adapter_file}"
    
    # Check if the adapter already has an error handler property
    if grep -q "errorHandler:" "${LIB_DIR}/${adapter_file}"; then
        echo "Adapter ${adapter_file} already has an error handler property."
        
        # Update the error handler initialization in constructor
        if grep -q "new VectorDbErrorHandler" "${LIB_DIR}/${adapter_file}"; then
            echo "Error handler initialization already updated."
        else
            # Find the errorHandler initialization line
            error_handler_line=$(grep -n "this.errorHandler = " "${LIB_DIR}/${adapter_file}" | head -1 | cut -d: -f1)
            
            if [ -n "$error_handler_line" ]; then
                # Replace with new initialization
                sed -i "${error_handler_line}s/this.errorHandler = .*/this.errorHandler = new VectorDbErrorHandler('${provider_name}', this.config.enableLogging || false, this.config.enableMetrics || false);/" "${LIB_DIR}/${adapter_file}"
                echo "Updated error handler initialization in ${adapter_file}"
            fi
        fi
    else
        # Add error handler property to the class
        if grep -q "private " "${LIB_DIR}/${adapter_file}"; then
            # Find the last private property declaration
            last_private_line=$(grep -n "private " "${LIB_DIR}/${adapter_file}" | tail -1 | cut -d: -f1)
            
            # Add the error handler property after the last private property
            sed -i "${last_private_line}a \ \ private errorHandler: VectorDbErrorHandler;" "${LIB_DIR}/${adapter_file}"
            echo "Added error handler property to ${adapter_file}"
        else
            echo "Warning: Could not find private property line in ${adapter_file}"
        fi
        
        # Initialize the error handler in the constructor
        if grep -q "constructor" "${LIB_DIR}/${adapter_file}"; then
            # Find the super(config) line or constructor end in the constructor
            super_line=$(grep -n "super(config)" "${LIB_DIR}/${adapter_file}" | head -1 | cut -d: -f1)
            
            if [ -n "$super_line" ]; then
                # Add the error handler initialization after super(config)
                sed -i "${super_line}a \ \ \ \ this.errorHandler = new VectorDbErrorHandler('${provider_name}', this.config.enableLogging || false, this.config.enableMetrics || false);" "${LIB_DIR}/${adapter_file}"
                echo "Added error handler initialization to constructor in ${adapter_file}"
            else
                # Try to find the constructor end by looking for the last line with '}'
                constructor_end=$(grep -n "constructor" -A 20 "${LIB_DIR}/${adapter_file}" | grep -m 1 "}" | cut -d: -f1)
                
                if [ -n "$constructor_end" ]; then
                    # Add the error handler initialization before the constructor end
                    sed -i "$((constructor_end-1))a \ \ \ \ this.errorHandler = new VectorDbErrorHandler('${provider_name}', this.config.enableLogging || false, this.config.enableMetrics || false);" "${LIB_DIR}/${adapter_file}"
                    echo "Added error handler initialization to constructor end in ${adapter_file}"
                else
                    echo "Warning: Could not find constructor end in ${adapter_file}"
                fi
            fi
        else
            echo "Warning: Could not find constructor in ${adapter_file}"
        fi
    fi
    
    # Replace function-based error handling with class-based
    
    # Replace handleVectorDBError calls with this.errorHandler.handleError
    sed -i 's/handleVectorDBError(/this.errorHandler.handleError(/g' "${LIB_DIR}/${adapter_file}"
    
    # Replace VectorDBError with VectorDbError
    sed -i 's/VectorDBError/VectorDbError/g' "${LIB_DIR}/${adapter_file}"
    
    # Replace VectorDBErrorType with VectorDbErrorType
    sed -i 's/VectorDBErrorType/VectorDbErrorType/g' "${LIB_DIR}/${adapter_file}"
    
    # Replace direct throws with error handler
    # Find all lines that throw new Error
    throw_lines=$(grep -n "throw new Error" "${LIB_DIR}/${adapter_file}" | cut -d: -f1)
    
    if [ -n "$throw_lines" ]; then
        echo "Found direct throw statements in ${adapter_file}, converting to use error handler..."
        
        # Process each throw line
        for line in $throw_lines; do
            # Get the original throw line
            original_line=$(sed -n "${line}p" "${LIB_DIR}/${adapter_file}")
            
            # Extract the error message
            error_message=$(echo "$original_line" | sed -n "s/.*throw new Error(\(.*\));.*/\1/p")
            
            # Get the method name
            method_name=$(grep -B 10 -A 0 -n "$original_line" "${LIB_DIR}/${adapter_file}" | grep -E "async [a-zA-Z0-9]+\(" | tail -1 | sed -n "s/.*async \([a-zA-Z0-9]\+\)(.*/\1/p")
            
            if [ -z "$method_name" ]; then
                # Try without async
                method_name=$(grep -B 10 -A 0 -n "$original_line" "${LIB_DIR}/${adapter_file}" | grep -E "public [a-zA-Z0-9]+\(" | tail -1 | sed -n "s/.*public \([a-zA-Z0-9]\+\)(.*/\1/p")
            fi
            
            if [ -z "$method_name" ]; then
                # Try protected
                method_name=$(grep -B 10 -A 0 -n "$original_line" "${LIB_DIR}/${adapter_file}" | grep -E "protected [a-zA-Z0-9]+\(" | tail -1 | sed -n "s/.*protected \([a-zA-Z0-9]\+\)(.*/\1/p")
            fi
            
            if [ -z "$method_name" ]; then
                # Try private
                method_name=$(grep -B 10 -A 0 -n "$original_line" "${LIB_DIR}/${adapter_file}" | grep -E "private [a-zA-Z0-9]+\(" | tail -1 | sed -n "s/.*private \([a-zA-Z0-9]\+\)(.*/\1/p")
            fi
            
            if [ -z "$method_name" ]; then
                method_name="unknown"
            fi
            
            # Determine error type based on context
            error_type="VectorDbErrorType.UNKNOWN_ERROR"
            
            if [[ "$original_line" == *"initialize"* || "$original_line" == *"not initialized"* ]]; then
                error_type="VectorDbErrorType.INITIALIZATION"
            elif [[ "$original_line" == *"connect"* || "$original_line" == *"connection"* ]]; then
                error_type="VectorDbErrorType.CONNECTION"
            elif [[ "$original_line" == *"search"* ]]; then
                error_type="VectorDbErrorType.SEARCH"
            elif [[ "$method_name" == *"search"* ]]; then
                error_type="VectorDbErrorType.SEARCH"
            elif [[ "$method_name" == *"store"* || "$method_name" == *"create"* ]]; then
                error_type="VectorDbErrorType.VECTOR_OPERATION_FAILED"
            elif [[ "$method_name" == *"delete"* || "$method_name" == *"remove"* ]]; then
                error_type="VectorDbErrorType.VECTOR_OPERATION_FAILED"
            elif [[ "$original_line" == *"not implemented"* || "$original_line" == *"Not implemented"* ]]; then
                error_type="VectorDbErrorType.UNSUPPORTED_OPERATION"
            elif [[ "$original_line" == *"auth"* || "$original_line" == *"credential"* ]]; then
                error_type="VectorDbErrorType.AUTHENTICATION"
            elif [[ "$method_name" == *"ping"* ]]; then
                error_type="VectorDbErrorType.CONNECTION"
            elif [[ "$method_name" == *"query"* ]]; then
                error_type="VectorDbErrorType.QUERY_FAILED"
            fi
            
            # Determine if error is retryable
            retryable="false"
            if [[ "$error_type" == "VectorDbErrorType.CONNECTION" || "$error_type" == "VectorDbErrorType.TIMEOUT" ]]; then
                retryable="true"
            fi
            
            # Create the new line with error handler
            new_line="      throw this.errorHandler.handleError(new Error(${error_message}), '${method_name}', ${error_type}, ${retryable});"
            
            # Replace the line
            sed -i "${line}s|.*|${new_line}|" "${LIB_DIR}/${adapter_file}"
            echo "Replaced direct throw with error handler in line ${line}"
        done
    else
        echo "No direct throw statements found in ${adapter_file}"
    fi
    
    # Update try/catch blocks to use error handler
    # Find all catch blocks
    catch_blocks=$(grep -n "} catch (error) {" "${LIB_DIR}/${adapter_file}" | cut -d: -f1)
    
    if [ -n "$catch_blocks" ]; then
        echo "Found catch blocks in ${adapter_file}, updating error handling..."
        
        # Process each catch block
        for catch_line in $catch_blocks; do
            # Get the method name
            method_name=$(grep -B 50 -A 0 -n "} catch (error) {" "${LIB_DIR}/${adapter_file}" | grep -E "async [a-zA-Z0-9]+\(" | tail -1 | sed -n "s/.*async \([a-zA-Z0-9]\+\)(.*/\1/p")
            
            if [ -z "$method_name" ]; then
                # Try without async
                method_name=$(grep -B 50 -A 0 -n "} catch (error) {" "${LIB_DIR}/${adapter_file}" | grep -E "public [a-zA-Z0-9]+\(" | tail -1 | sed -n "s/.*public \([a-zA-Z0-9]\+\)(.*/\1/p")
            fi
            
            if [ -z "$method_name" ]; then
                # Try protected
                method_name=$(grep -B 50 -A 0 -n "} catch (error) {" "${LIB_DIR}/${adapter_file}" | grep -E "protected [a-zA-Z0-9]+\(" | tail -1 | sed -n "s/.*protected \([a-zA-Z0-9]\+\)(.*/\1/p")
            fi
            
            if [ -z "$method_name" ]; then
                # Try private
                method_name=$(grep -B 50 -A 0 -n "} catch (error) {" "${LIB_DIR}/${adapter_file}" | grep -E "private [a-zA-Z0-9]+\(" | tail -1 | sed -n "s/.*private \([a-zA-Z0-9]\+\)(.*/\1/p")
            fi
            
            if [ -z "$method_name" ]; then
                method_name="unknown"
            fi
            
            # Determine if there's a direct throw error in the catch block
            catch_block_start=$catch_line
            catch_block_end=$(grep -n "}" "${LIB_DIR}/${adapter_file}" | awk -v start="$catch_line" '$1 > start {print $1; exit}')
            
            # If we couldn't find the end, assume it's 10 lines down at most
            if [ -z "$catch_block_end" ]; then
                catch_block_end=$((catch_line + 10))
            fi
            
            # Look for direct throw error line in the catch block
            throw_line=$(sed -n "${catch_block_start},${catch_block_end}p" "${LIB_DIR}/${adapter_file}" | grep -n "throw error;" | cut -d: -f1)
            
            if [ -n "$throw_line" ]; then
                # Actual line number in the file
                throw_line_actual=$((catch_block_start + throw_line - 1))
                
                # Determine error type based on method name
                error_type="undefined"
                
                if [[ "$method_name" == *"initialize"* ]]; then
                    error_type="VectorDbErrorType.INITIALIZATION"
                elif [[ "$method_name" == *"connect"* ]]; then
                    error_type="VectorDbErrorType.CONNECTION"
                elif [[ "$method_name" == *"search"* ]]; then
                    error_type="VectorDbErrorType.SEARCH"
                elif [[ "$method_name" == *"store"* || "$method_name" == *"create"* ]]; then
                    error_type="VectorDbErrorType.VECTOR_OPERATION_FAILED"
                elif [[ "$method_name" == *"delete"* || "$method_name" == *"remove"* ]]; then
                    error_type="VectorDbErrorType.VECTOR_OPERATION_FAILED"
                elif [[ "$method_name" == *"ping"* ]]; then
                    error_type="VectorDbErrorType.CONNECTION"
                elif [[ "$method_name" == *"query"* ]]; then
                    error_type="VectorDbErrorType.QUERY_FAILED"
                fi
                
                # Create context based on method name
                context=""
                
                if [[ "$method_name" == *"search"* ]]; then
                    context=", { embeddingSize: embedding?.length || 0, options }"
                elif [[ "$method_name" == *"store"* ]]; then
                    context=", { fileId, chunkCount: chunks?.length || 0 }"
                elif [[ "$method_name" == *"delete"* ]]; then
                    context=", { fileId }"
                fi
                
                # Replace the throw error line with error handler
                if [ "$error_type" != "undefined" ]; then
                    sed -i "${throw_line_actual}s|throw error;|throw this.errorHandler.handleError(error, '${method_name}', ${error_type}, this.errorHandler.isNetworkError(error) || this.errorHandler.isTimeoutError(error)${context});|" "${LIB_DIR}/${adapter_file}"
                    echo "Updated throw error in catch block at line ${throw_line_actual}"
                else
                    sed -i "${throw_line_actual}s|throw error;|throw this.errorHandler.handleError(error, '${method_name}', undefined, this.errorHandler.isNetworkError(error) || this.errorHandler.isTimeoutError(error)${context});|" "${LIB_DIR}/${adapter_file}"
                    echo "Updated throw error in catch block at line ${throw_line_actual}"
                fi
            fi
        done
    else
        echo "No catch blocks found in ${adapter_file}"
    fi
    
    echo "Completed processing adapter: ${adapter_file}"
    echo
}

# Update adapter imports to use vector-db-error-handler-new
update_adapter_imports() {
    local adapter_file=$1
    
    echo "Updating imports in: ${adapter_file}"
    
    # Check if the file exists
    if [ ! -f "${LIB_DIR}/${adapter_file}" ]; then
        echo "Error: File ${LIB_DIR}/${adapter_file} not found."
        return 1
    fi
    
    # Update import statements
    sed -i 's/from ".\/vector-db-error-handler"/from ".\/vector-db-error-handler-new"/g' "${LIB_DIR}/${adapter_file}"
    
    # For base-vector-database-adapter.ts, which might be imported by other files
    if [ "$adapter_file" == "base-vector-database-adapter.ts" ]; then
        # First, check if it's exporting any error types
        if grep -q "export { VectorDBErrorType, VectorDBError }" "${LIB_DIR}/${adapter_file}"; then
            # Update the export statement
            sed -i 's/export { VectorDBErrorType, VectorDBError }/export { VectorDbErrorType, VectorDbError }/g' "${LIB_DIR}/${adapter_file}"
            echo "Updated error type exports in base adapter"
        fi
    fi
    
    echo "Completed updating imports in: ${adapter_file}"
    echo
}

# Copy new error handler files if they don't exist yet
copy_new_error_handler_files() {
    # Check if files already exist
    if [ ! -f "${LIB_DIR}/vector-db-error-handler-new.ts" ]; then
        echo "Error: ${LIB_DIR}/vector-db-error-handler-new.ts not found. Cannot continue without new error handler."
        exit 1
    fi
    
    if [ ! -f "${LIB_DIR}/vector-retry-handler-new.ts" ]; then
        echo "Error: ${LIB_DIR}/vector-retry-handler-new.ts not found. Cannot continue without new retry handler."
        exit 1
    fi
    
    echo "New error handler files exist. Proceeding with migration."
}

# Process vector-database-factory.ts to update imports
update_factory_file() {
    echo "Updating vector database factory file..."
    
    factory_file="${LIB_DIR}/vector-database-factory.ts"
    
    # Check if the file exists
    if [ ! -f "$factory_file" ]; then
        echo "Error: Vector database factory file ${factory_file} not found."
        return 1
    fi
    
    # Create a backup
    cp "$factory_file" "${factory_file}.bak"
    
    # Update import statements
    sed -i 's/from ".\/vector-db-error-handler"/from ".\/vector-db-error-handler-new"/g' "$factory_file"
    sed -i 's/VectorDBErrorType/VectorDbErrorType/g' "$factory_file"
    sed -i 's/VectorDBError/VectorDbError/g' "$factory_file"
    
    echo "Vector database factory file updated"
    echo
}

# Final steps - replace original files with new versions
finalize_migration() {
    echo "Finalizing migration..."
    
    # Rename new error handler files to replace old ones
    if [ -f "${LIB_DIR}/vector-db-error-handler.ts" ] && [ -f "${LIB_DIR}/vector-db-error-handler-new.ts" ]; then
        mv "${LIB_DIR}/vector-db-error-handler.ts" "${LIB_DIR}/vector-db-error-handler.old.ts"
        mv "${LIB_DIR}/vector-db-error-handler-new.ts" "${LIB_DIR}/vector-db-error-handler.ts"
        echo "Replaced vector-db-error-handler.ts with new version"
    else
        echo "Warning: Could not replace vector-db-error-handler.ts"
    fi
    
    # Rename new retry handler file to replace old one
    if [ -f "${LIB_DIR}/vector-retry-handler.ts" ] && [ -f "${LIB_DIR}/vector-retry-handler-new.ts" ]; then
        mv "${LIB_DIR}/vector-retry-handler.ts" "${LIB_DIR}/vector-retry-handler.old.ts"
        mv "${LIB_DIR}/vector-retry-handler-new.ts" "${LIB_DIR}/vector-retry-handler.ts"
        echo "Replaced vector-retry-handler.ts with new version"
    else
        echo "Warning: Could not replace vector-retry-handler.ts"
    fi
    
    # Update imports in all adapter files to point back to the original filenames
    for adapter_file in "${LIB_DIR}"/*-adapter*.ts; do
        basename_file=$(basename "$adapter_file")
        sed -i 's/from ".\/vector-db-error-handler-new"/from ".\/vector-db-error-handler"/g' "$adapter_file"
        sed -i 's/from ".\/vector-retry-handler-new"/from ".\/vector-retry-handler"/g' "$adapter_file"
        echo "Updated imports in ${basename_file}"
    done
    
    echo "Migration finalized"
}

# Main execution
echo "Starting standardized error handling migration..."

# First, make sure the new error handler files exist
copy_new_error_handler_files

# Update imports in key files
update_factory_file
update_adapter_imports "base-vector-database-adapter.ts"

# Process all adapter files
echo "Processing adapter files..."
migrate_adapter_to_new_error_handler "postgres-vector-database-adapter.ts" "postgres"
migrate_adapter_to_new_error_handler "redis-vector-database-adapter.ts" "redis"
migrate_adapter_to_new_error_handler "enhanced-vector-database-adapter.ts" "enhanced"
migrate_adapter_to_new_error_handler "cosmosdb-vector-database-adapter.ts" "cosmosdb"
migrate_adapter_to_new_error_handler "sqlserver-vector-database-adapter.ts" "sqlserver"

# After all adapters are processed, finalize the migration
finalize_migration

echo "Error handling standardization migration complete."
echo 
echo "Note: You may need to manually review and fix any complex error handling patterns"
echo "that were not automatically converted by this script."