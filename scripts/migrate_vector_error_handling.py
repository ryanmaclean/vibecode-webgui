#!/usr/bin/env python3
"""Script to standardize error handling across vector database adapters.

This script updates all vector database adapters to use the new VectorDbErrorHandler class.
"""
from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def log(msg: str) -> None:
    """Print a message."""
    print(msg)


def get_method_name_from_context(lines: list[str], line_idx: int) -> str:
    """Extract method name from surrounding context."""
    patterns = [
        r"async\s+([a-zA-Z0-9]+)\(",
        r"public\s+([a-zA-Z0-9]+)\(",
        r"protected\s+([a-zA-Z0-9]+)\(",
        r"private\s+([a-zA-Z0-9]+)\(",
    ]

    # Look backwards for method declaration
    for i in range(line_idx, max(0, line_idx - 50), -1):
        for pattern in patterns:
            match = re.search(pattern, lines[i])
            if match:
                return match.group(1)

    return "unknown"


def determine_error_type(original_line: str, method_name: str) -> str:
    """Determine error type based on context."""
    line_lower = original_line.lower()
    method_lower = method_name.lower()

    if "initialize" in line_lower or "not initialized" in line_lower:
        return "VectorDbErrorType.INITIALIZATION"
    if "connect" in line_lower or "connection" in line_lower:
        return "VectorDbErrorType.CONNECTION"
    if "search" in line_lower or "search" in method_lower:
        return "VectorDbErrorType.SEARCH"
    if any(x in method_lower for x in ["store", "create"]):
        return "VectorDbErrorType.VECTOR_OPERATION_FAILED"
    if any(x in method_lower for x in ["delete", "remove"]):
        return "VectorDbErrorType.VECTOR_OPERATION_FAILED"
    if "not implemented" in line_lower:
        return "VectorDbErrorType.UNSUPPORTED_OPERATION"
    if "auth" in line_lower or "credential" in line_lower:
        return "VectorDbErrorType.AUTHENTICATION"
    if "ping" in method_lower:
        return "VectorDbErrorType.CONNECTION"
    if "query" in method_lower:
        return "VectorDbErrorType.QUERY_FAILED"

    return "VectorDbErrorType.UNKNOWN_ERROR"


def is_retryable(error_type: str) -> str:
    """Determine if error is retryable."""
    if error_type in ["VectorDbErrorType.CONNECTION", "VectorDbErrorType.TIMEOUT"]:
        return "true"
    return "false"


def migrate_adapter_to_new_error_handler(
    lib_dir: Path,
    adapter_file: str,
    provider_name: str,
) -> bool:
    """Migrate an adapter to use the new error handler."""
    log(f"Processing adapter: {adapter_file}")

    file_path = lib_dir / adapter_file
    if not file_path.exists():
        log(f"Error: File {file_path} not found.")
        return False

    # Create backup
    backup_path = lib_dir / f"{adapter_file}.bak"
    shutil.copy(file_path, backup_path)
    log(f"Created backup: {adapter_file}.bak")

    content = file_path.read_text()

    # Update import statements
    import_replacements = [
        (
            r"import \{ VectorDBErrorType, VectorDBError, handleVectorDBError \} from ['\"]\.\/vector-db-error-handler['\"]",
            "import { VectorDbErrorType, VectorDbError, VectorDbErrorHandler } from './vector-db-error-handler-new'",
        ),
        (
            r"import \{ VectorDBErrorType, handleVectorDBError \} from ['\"]\.\/vector-db-error-handler['\"]",
            "import { VectorDbErrorType, VectorDbErrorHandler } from './vector-db-error-handler-new'",
        ),
        (
            r"import \{ handleVectorDBError \} from ['\"]\.\/vector-db-error-handler['\"]",
            "import { VectorDbErrorHandler } from './vector-db-error-handler-new'",
        ),
        (
            r"import \{ VectorDBError, VectorDBErrorType \} from ['\"]\.\/vector-db-error-handler['\"]",
            "import { VectorDbError, VectorDbErrorType } from './vector-db-error-handler-new'",
        ),
    ]

    for pattern, replacement in import_replacements:
        content = re.sub(pattern, replacement, content)

    log(f"Updated import statements in {adapter_file}")

    # Check if adapter already has error handler property
    if "errorHandler:" in content:
        log(f"Adapter {adapter_file} already has an error handler property.")

        if "new VectorDbErrorHandler" not in content:
            # Update the error handler initialization
            content = re.sub(
                r"this\.errorHandler = .*?;",
                f"this.errorHandler = new VectorDbErrorHandler('{provider_name}', "
                f"this.config.enableLogging || false, this.config.enableMetrics || false);",
                content,
            )
            log(f"Updated error handler initialization in {adapter_file}")
    else:
        # Add error handler property after last private property
        private_match = list(re.finditer(r"private \w+", content))
        if private_match:
            last_match = private_match[-1]
            insert_pos = content.find(";", last_match.end()) + 1
            content = (
                content[:insert_pos]
                + "\n  private errorHandler: VectorDbErrorHandler;"
                + content[insert_pos:]
            )
            log(f"Added error handler property to {adapter_file}")

        # Add initialization in constructor after super(config)
        super_match = re.search(r"super\(config\);", content)
        if super_match:
            insert_pos = super_match.end()
            init_line = (
                f"\n    this.errorHandler = new VectorDbErrorHandler('{provider_name}', "
                f"this.config.enableLogging || false, this.config.enableMetrics || false);"
            )
            content = content[:insert_pos] + init_line + content[insert_pos:]
            log(f"Added error handler initialization to constructor in {adapter_file}")

    # Replace function-based error handling with class-based
    content = content.replace("handleVectorDBError(", "this.errorHandler.handleError(")
    content = content.replace("VectorDBError", "VectorDbError")
    content = content.replace("VectorDBErrorType", "VectorDbErrorType")

    # Process direct throw statements
    lines = content.split("\n")
    new_lines = []

    for i, line in enumerate(lines):
        if "throw new Error(" in line and "this.errorHandler" not in line:
            method_name = get_method_name_from_context(lines, i)
            error_type = determine_error_type(line, method_name)
            retryable = is_retryable(error_type)

            # Extract error message
            match = re.search(r"throw new Error\((.*?)\);", line)
            if match:
                error_message = match.group(1)
                indent = len(line) - len(line.lstrip())
                new_line = (
                    " " * indent
                    + f"throw this.errorHandler.handleError(new Error({error_message}), "
                    + f"'{method_name}', {error_type}, {retryable});"
                )
                new_lines.append(new_line)
                log(f"Replaced direct throw with error handler in line {i + 1}")
                continue

        new_lines.append(line)

    content = "\n".join(new_lines)

    # Process catch blocks with "throw error;"
    lines = content.split("\n")
    new_lines = []

    for i, line in enumerate(lines):
        if "throw error;" in line and "this.errorHandler" not in line:
            method_name = get_method_name_from_context(lines, i)
            error_type = determine_error_type("", method_name)

            # Determine context based on method name
            context = ""
            if "search" in method_name.lower():
                context = ", { embeddingSize: embedding?.length || 0, options }"
            elif "store" in method_name.lower():
                context = ", { fileId, chunkCount: chunks?.length || 0 }"
            elif "delete" in method_name.lower():
                context = ", { fileId }"

            indent = len(line) - len(line.lstrip())
            if error_type != "VectorDbErrorType.UNKNOWN_ERROR":
                new_line = (
                    " " * indent
                    + f"throw this.errorHandler.handleError(error, '{method_name}', {error_type}, "
                    + f"this.errorHandler.isNetworkError(error) || this.errorHandler.isTimeoutError(error){context});"
                )
            else:
                new_line = (
                    " " * indent
                    + f"throw this.errorHandler.handleError(error, '{method_name}', undefined, "
                    + f"this.errorHandler.isNetworkError(error) || this.errorHandler.isTimeoutError(error){context});"
                )
            new_lines.append(new_line)
            log(f"Updated throw error in catch block at line {i + 1}")
            continue

        new_lines.append(line)

    content = "\n".join(new_lines)
    file_path.write_text(content)

    log(f"Completed processing adapter: {adapter_file}")
    log("")
    return True


def update_adapter_imports(lib_dir: Path, adapter_file: str) -> bool:
    """Update imports in adapter file."""
    log(f"Updating imports in: {adapter_file}")

    file_path = lib_dir / adapter_file
    if not file_path.exists():
        log(f"Error: File {file_path} not found.")
        return False

    content = file_path.read_text()

    # Update import statements
    content = content.replace(
        'from "./vector-db-error-handler"',
        'from "./vector-db-error-handler-new"',
    )

    # For base adapter, update exports
    if adapter_file == "base-vector-database-adapter.ts":
        content = content.replace(
            "export { VectorDBErrorType, VectorDBError }",
            "export { VectorDbErrorType, VectorDbError }",
        )
        log("Updated error type exports in base adapter")

    file_path.write_text(content)
    log(f"Completed updating imports in: {adapter_file}")
    log("")
    return True


def copy_new_error_handler_files(lib_dir: Path) -> bool:
    """Verify new error handler files exist."""
    error_handler = lib_dir / "vector-db-error-handler-new.ts"
    retry_handler = lib_dir / "vector-retry-handler-new.ts"

    if not error_handler.exists():
        log(f"Error: {error_handler} not found. Cannot continue without new error handler.")
        return False

    if not retry_handler.exists():
        log(f"Error: {retry_handler} not found. Cannot continue without new retry handler.")
        return False

    log("New error handler files exist. Proceeding with migration.")
    return True


def update_factory_file(lib_dir: Path) -> bool:
    """Update vector database factory file."""
    log("Updating vector database factory file...")

    factory_file = lib_dir / "vector-database-factory.ts"
    if not factory_file.exists():
        log(f"Error: Vector database factory file {factory_file} not found.")
        return False

    # Create backup
    shutil.copy(factory_file, lib_dir / "vector-database-factory.ts.bak")

    content = factory_file.read_text()
    content = content.replace(
        'from "./vector-db-error-handler"',
        'from "./vector-db-error-handler-new"',
    )
    content = content.replace("VectorDBErrorType", "VectorDbErrorType")
    content = content.replace("VectorDBError", "VectorDbError")

    factory_file.write_text(content)
    log("Vector database factory file updated")
    log("")
    return True


def finalize_migration(lib_dir: Path) -> None:
    """Finalize migration by replacing original files."""
    log("Finalizing migration...")

    # Replace error handler files
    old_error = lib_dir / "vector-db-error-handler.ts"
    new_error = lib_dir / "vector-db-error-handler-new.ts"

    if old_error.exists() and new_error.exists():
        old_error.rename(lib_dir / "vector-db-error-handler.old.ts")
        new_error.rename(old_error)
        log("Replaced vector-db-error-handler.ts with new version")
    else:
        log("Warning: Could not replace vector-db-error-handler.ts")

    # Replace retry handler files
    old_retry = lib_dir / "vector-retry-handler.ts"
    new_retry = lib_dir / "vector-retry-handler-new.ts"

    if old_retry.exists() and new_retry.exists():
        old_retry.rename(lib_dir / "vector-retry-handler.old.ts")
        new_retry.rename(old_retry)
        log("Replaced vector-retry-handler.ts with new version")
    else:
        log("Warning: Could not replace vector-retry-handler.ts")

    # Update imports in all adapter files
    for adapter_file in lib_dir.glob("*-adapter*.ts"):
        content = adapter_file.read_text()
        content = content.replace(
            'from "./vector-db-error-handler-new"',
            'from "./vector-db-error-handler"',
        )
        content = content.replace(
            'from "./vector-retry-handler-new"',
            'from "./vector-retry-handler"',
        )
        adapter_file.write_text(content)
        log(f"Updated imports in {adapter_file.name}")

    log("Migration finalized")


def main() -> int:
    """Main entry point."""
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent
    lib_dir = project_root / "src" / "lib" / "vector-db"

    log("Standardizing error handling in vector database adapters...")
    log(f"Working in directory: {lib_dir}")

    log("Starting standardized error handling migration...")

    # Verify new error handler files exist
    if not copy_new_error_handler_files(lib_dir):
        return 1

    # Update imports in key files
    update_factory_file(lib_dir)
    update_adapter_imports(lib_dir, "base-vector-database-adapter.ts")

    # Process all adapter files
    log("Processing adapter files...")
    adapters = [
        ("postgres-vector-database-adapter.ts", "postgres"),
        ("redis-vector-database-adapter.ts", "redis"),
        ("enhanced-vector-database-adapter.ts", "enhanced"),
        ("cosmosdb-vector-database-adapter.ts", "cosmosdb"),
        ("sqlserver-vector-database-adapter.ts", "sqlserver"),
    ]

    for adapter_file, provider_name in adapters:
        migrate_adapter_to_new_error_handler(lib_dir, adapter_file, provider_name)

    # Finalize migration
    finalize_migration(lib_dir)

    log("Error handling standardization migration complete.")
    log("")
    log("Note: You may need to manually review and fix any complex error handling patterns")
    log("that were not automatically converted by this script.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
