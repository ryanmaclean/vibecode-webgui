#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Script to standardize error handling across vector database adapters
# This script updates all vector database adapters to use the VectorDbErrorHandler class

# Initialize log aggregation
init_log_aggregation


# Get the directory of the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/src/lib/vector-db"

echo "Standardizing error handling in vector database adapters..."
echo "Working in directory: ${LIB_DIR}"

# Function to add error handler to adapter
add_error_handler_to_adapter() {
    local adapter_file=$1
    local provider_name=$2
    
    echo "Processing adapter: ${adapter_file}"
    
    # Check if the file exists
    if [ ! -f "${LIB_DIR}/${adapter_file}" ]; then
        echo "Error: File ${LIB_DIR}/${adapter_file} not found."
        return 1
    fi
    
    # Check if the adapter already has an error handler
    if grep -q "errorHandler:" "${LIB_DIR}/${adapter_file}"; then
        echo "Adapter ${adapter_file} already has an error handler property."
    else
        # Add import if it doesn't exist
        if ! grep -q "VectorDbErrorHandler" "${LIB_DIR}/${adapter_file}"; then
            # Find the last import line
            last_import_line=$(grep -n "import" "${LIB_DIR}/${adapter_file}" | tail -1 | cut -d: -f1)
            
            # Add the error handler import after the last import
            sed -i "${last_import_line}a import { VectorDbErrorType, VectorDbErrorHandler } from './vector-db-error-handler';" "${LIB_DIR}/${adapter_file}"
            echo "Added error handler import to ${adapter_file}"
        fi
        
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
            # Find the super(config) line in the constructor
            super_line=$(grep -n "super(config)" "${LIB_DIR}/${adapter_file}" | head -1 | cut -d: -f1)
            
            if [ -n "$super_line" ]; then
                # Add the error handler initialization after super(config)
                sed -i "${super_line}a \ \ \ \ this.errorHandler = new VectorDbErrorHandler('${provider_name}', config.enableLogging, config.enableMetrics);" "${LIB_DIR}/${adapter_file}"
                echo "Added error handler initialization to constructor in ${adapter_file}"
            else
                echo "Warning: Could not find super(config) line in constructor in ${adapter_file}"
            fi
        else
            echo "Warning: Could not find constructor in ${adapter_file}"
        fi
    fi
    
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
            elif [[ "$method_name" == *"store"* ]]; then
                error_type="VectorDbErrorType.VECTOR_CREATION_FAILED"
            elif [[ "$method_name" == *"delete"* ]]; then
                error_type="VectorDbErrorType.VECTOR_DELETION_FAILED"
            elif [[ "$original_line" == *"not implemented"* || "$original_line" == *"Not implemented"* ]]; then
                error_type="VectorDbErrorType.UNSUPPORTED_OPERATION"
            fi
            
            # Create the new line with error handler
            new_line="      throw this.errorHandler.handleError(new Error(${error_message}), '${method_name}', ${error_type});"
            
            # Replace the line
            sed -i "${line}s|.*|${new_line}|" "${LIB_DIR}/${adapter_file}"
            echo "Replaced direct throw with error handler in line ${line}"
        done
    else
        echo "No direct throw statements found in ${adapter_file}"
    fi
    
    # Update the enhanced adapter to use the class-based approach
    if [ "$adapter_file" == "enhanced-vector-database-adapter.ts" ]; then
        echo "Updating enhanced adapter to use class-based error handling..."
        
        # Replace function-based handleVectorDBError with class-based approach
        sed -i 's/handleVectorDBError(/this.errorHandler.handleError(/g' "${LIB_DIR}/${adapter_file}"
        
        # Add error handler property and initialization
        if ! grep -q "errorHandler:" "${LIB_DIR}/${adapter_file}"; then
            # Find class declaration
            class_line=$(grep -n "export class EnhancedVectorDatabaseAdapter" "${LIB_DIR}/${adapter_file}" | cut -d: -f1)
            
            # Add error handler property
            sed -i "$((class_line+3))a \ \ private errorHandler: VectorDbErrorHandler;" "${LIB_DIR}/${adapter_file}"
            
            # Add initialization in constructor
            constructor_end=$(grep -n "this.adapterName" "${LIB_DIR}/${adapter_file}" | cut -d: -f1)
            sed -i "$((constructor_end+1))a \ \ \ \ this.errorHandler = new VectorDbErrorHandler(this.adapterName, config.enableLogging, config.enableMetrics);" "${LIB_DIR}/${adapter_file}"
            
            echo "Added error handler property and initialization to enhanced adapter"
        fi
        
        # Update import statement
        sed -i 's/import { VectorDBError, VectorDBErrorType, handleVectorDBError } from/import { VectorDbError, VectorDbErrorType, VectorDbErrorHandler } from/g' "${LIB_DIR}/${adapter_file}"
        
        echo "Enhanced adapter updated to use class-based error handling"
    fi
    
    echo "Completed processing adapter: ${adapter_file}"
    echo
}

# Update base-vector-database-adapter.ts to add error handler initialization
update_base_adapter() {
    echo "Updating base adapter with error handler initialization..."
    
    base_file="${LIB_DIR}/base-vector-database-adapter.ts"
    
    # Check if the file exists
    if [ ! -f "$base_file" ]; then
        echo "Error: Base adapter file ${base_file} not found."
        return 1
    fi
    
    # Add import if it doesn't exist
    if ! grep -q "VectorDbErrorHandler" "$base_file"; then
        # Find the last import line
        last_import_line=$(grep -n "import" "$base_file" | tail -1 | cut -d: -f1)
        
        # Add the error handler import after the last import
        sed -i "${last_import_line}a import { VectorDbErrorType, VectorDbErrorHandler } from './vector-db-error-handler';" "$base_file"
        echo "Added error handler import to base adapter"
    fi
    
    # Add error handler protected property to the class
    if ! grep -q "protected errorHandler:" "$base_file"; then
        # Find the last protected property declaration
        last_protected_line=$(grep -n "protected " "$base_file" | tail -1 | cut -d: -f1)
        
        # Add the error handler property after the last protected property
        sed -i "${last_protected_line}a \ \ protected errorHandler: VectorDbErrorHandler | null = null;" "$base_file"
        echo "Added error handler property to base adapter"
    fi
    
    echo "Base adapter updated with error handler initialization"
    echo
}

# Process each adapter
echo "Starting adapter processing..."

# Update base adapter first
update_base_adapter

# Process individual adapters
add_error_handler_to_adapter "postgres-vector-database-adapter.ts" "postgres"
add_error_handler_to_adapter "redis-vector-database-adapter.ts" "redis"
add_error_handler_to_adapter "enhanced-vector-database-adapter.ts" "enhanced"
add_error_handler_to_adapter "cosmosdb-vector-database-adapter.ts" "cosmosdb"
add_error_handler_to_adapter "sqlserver-vector-database-adapter.ts" "sqlserver"

echo "All adapters processed. Error handling standardization complete."