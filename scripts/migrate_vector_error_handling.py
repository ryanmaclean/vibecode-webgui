#!/usr/bin/env python3
"""Migrate vector database adapters to standardized error handling.

This script updates all vector database adapters to use the new VectorDbErrorHandler class.
"""

from __future__ import annotations

import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class MigrationConfig:
    """Migration configuration."""

    script_dir: Path
    project_root: Path
    lib_dir: Path

    @classmethod
    def from_script_location(cls) -> "MigrationConfig":
        """Create config based on script location."""
        script_dir = Path(__file__).parent.resolve()
        project_root = script_dir.parent
        lib_dir = project_root / "src" / "lib" / "vector-db"
        return cls(script_dir=script_dir, project_root=project_root, lib_dir=lib_dir)


# Import pattern replacements
IMPORT_REPLACEMENTS: list[tuple[str, str]] = [
    (
        r"import { VectorDBErrorType, VectorDBError, handleVectorDBError } from ['\"]\.\/vector-db-error-handler['\"]",
        "import { VectorDbErrorType, VectorDbError, VectorDbErrorHandler } from './vector-db-error-handler-new'",
    ),
    (
        r"import { VectorDBErrorType, handleVectorDBError } from ['\"]\.\/vector-db-error-handler['\"]",
        "import { VectorDbErrorType, VectorDbErrorHandler } from './vector-db-error-handler-new'",
    ),
    (
        r"import { handleVectorDBError } from ['\"]\.\/vector-db-error-handler['\"]",
        "import { VectorDbErrorHandler } from './vector-db-error-handler-new'",
    ),
    (
        r"import { VectorDBError, VectorDBErrorType } from ['\"]\.\/vector-db-error-handler['\"]",
        "import { VectorDbError, VectorDbErrorType } from './vector-db-error-handler-new'",
    ),
]


def determine_error_type(line: str, method_name: str) -> str:
    """Determine the error type based on context.

    Args:
        line: The line containing the throw statement.
        method_name: The name of the method containing the throw.

    Returns:
        The appropriate VectorDbErrorType.
    """
    line_lower = line.lower()
    method_lower = method_name.lower()

    if "initialize" in line_lower or "not initialized" in line_lower:
        return "VectorDbErrorType.INITIALIZATION"
    if "connect" in line_lower or "connection" in line_lower:
        return "VectorDbErrorType.CONNECTION"
    if "search" in line_lower or "search" in method_lower:
        return "VectorDbErrorType.SEARCH"
    if "store" in method_lower or "create" in method_lower:
        return "VectorDbErrorType.VECTOR_OPERATION_FAILED"
    if "delete" in method_lower or "remove" in method_lower:
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


def is_retryable_error(error_type: str) -> bool:
    """Determine if an error type is retryable.

    Args:
        error_type: The VectorDbErrorType string.

    Returns:
        True if the error is retryable.
    """
    return error_type in (
        "VectorDbErrorType.CONNECTION",
        "VectorDbErrorType.TIMEOUT",
    )


def find_method_name(lines: list[str], target_line_idx: int) -> str:
    """Find the method name containing a given line.

    Args:
        lines: All lines in the file.
        target_line_idx: The line index to search from.

    Returns:
        The method name or 'unknown'.
    """
    # Search backwards for method declaration
    patterns = [
        r"async\s+([a-zA-Z0-9_]+)\s*\(",
        r"public\s+([a-zA-Z0-9_]+)\s*\(",
        r"protected\s+([a-zA-Z0-9_]+)\s*\(",
        r"private\s+([a-zA-Z0-9_]+)\s*\(",
    ]

    for i in range(target_line_idx, max(0, target_line_idx - 50), -1):
        line = lines[i]
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                return match.group(1)

    return "unknown"


def update_import_statements(content: str) -> str:
    """Update import statements to use new error handler.

    Args:
        content: File content.

    Returns:
        Updated content.
    """
    for old_pattern, new_import in IMPORT_REPLACEMENTS:
        content = re.sub(old_pattern, new_import, content)
    return content


def replace_error_names(content: str) -> str:
    """Replace old error names with new ones.

    Args:
        content: File content.

    Returns:
        Updated content.
    """
    # Replace function calls
    content = content.replace("handleVectorDBError(", "this.errorHandler.handleError(")

    # Replace type names
    content = content.replace("VectorDBError", "VectorDbError")
    content = content.replace("VectorDBErrorType", "VectorDbErrorType")

    return content


def add_error_handler_property(content: str, lines: list[str]) -> str:
    """Add error handler property to class if not present.

    Args:
        content: File content.
        lines: File lines.

    Returns:
        Updated content.
    """
    if "errorHandler:" in content:
        return content

    # Find last private property declaration
    last_private_idx = -1
    for i, line in enumerate(lines):
        if "private " in line and ";" in line:
            last_private_idx = i

    if last_private_idx >= 0:
        lines.insert(last_private_idx + 1, "  private errorHandler: VectorDbErrorHandler;")
        return "\n".join(lines)

    return content


def add_error_handler_init(
    content: str, lines: list[str], provider_name: str
) -> str:
    """Add error handler initialization to constructor.

    Args:
        content: File content.
        lines: File lines.
        provider_name: The provider name for the error handler.

    Returns:
        Updated content.
    """
    if "new VectorDbErrorHandler" in content:
        return content

    # Check for existing errorHandler initialization
    for i, line in enumerate(lines):
        if "this.errorHandler = " in line:
            # Update existing initialization
            lines[i] = (
                f"    this.errorHandler = new VectorDbErrorHandler("
                f"'{provider_name}', this.config.enableLogging || false, "
                f"this.config.enableMetrics || false);"
            )
            return "\n".join(lines)

    # Find super(config) line
    for i, line in enumerate(lines):
        if "super(config)" in line:
            init_line = (
                f"    this.errorHandler = new VectorDbErrorHandler("
                f"'{provider_name}', this.config.enableLogging || false, "
                f"this.config.enableMetrics || false);"
            )
            lines.insert(i + 1, init_line)
            return "\n".join(lines)

    return content


def process_throw_statements(lines: list[str]) -> list[str]:
    """Process and convert throw new Error statements.

    Args:
        lines: File lines.

    Returns:
        Updated lines.
    """
    result = []
    for i, line in enumerate(lines):
        if "throw new Error(" in line and "this.errorHandler" not in line:
            # Extract error message
            match = re.search(r"throw new Error\((.+)\);", line)
            if match:
                error_message = match.group(1)
                method_name = find_method_name(lines, i)
                error_type = determine_error_type(line, method_name)
                retryable = "true" if is_retryable_error(error_type) else "false"

                indent = len(line) - len(line.lstrip())
                new_line = (
                    f"{' ' * indent}throw this.errorHandler.handleError("
                    f"new Error({error_message}), '{method_name}', "
                    f"{error_type}, {retryable});"
                )
                result.append(new_line)
            else:
                result.append(line)
        else:
            result.append(line)

    return result


def process_catch_blocks(lines: list[str]) -> list[str]:
    """Process and update catch blocks.

    Args:
        lines: File lines.

    Returns:
        Updated lines.
    """
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]

        if "} catch (error) {" in line:
            result.append(line)
            method_name = find_method_name(lines, i)

            # Look for throw error; in the catch block
            j = i + 1
            brace_count = 1
            while j < len(lines) and brace_count > 0:
                catch_line = lines[j]

                if "{" in catch_line:
                    brace_count += catch_line.count("{")
                if "}" in catch_line:
                    brace_count -= catch_line.count("}")

                if "throw error;" in catch_line and "this.errorHandler" not in catch_line:
                    # Determine error type
                    error_type = determine_error_type("", method_name)

                    # Build context based on method
                    context = ""
                    method_lower = method_name.lower()
                    if "search" in method_lower:
                        context = ", { embeddingSize: embedding?.length || 0, options }"
                    elif "store" in method_lower:
                        context = ", { fileId, chunkCount: chunks?.length || 0 }"
                    elif "delete" in method_lower:
                        context = ", { fileId }"

                    indent = len(catch_line) - len(catch_line.lstrip())
                    new_line = (
                        f"{' ' * indent}throw this.errorHandler.handleError("
                        f"error, '{method_name}', {error_type}, "
                        f"this.errorHandler.isNetworkError(error) || "
                        f"this.errorHandler.isTimeoutError(error){context});"
                    )
                    result.append(new_line)
                else:
                    result.append(catch_line)

                j += 1

            i = j
        else:
            result.append(line)
            i += 1

    return result


def migrate_adapter(config: MigrationConfig, adapter_file: str, provider_name: str) -> bool:
    """Migrate a single adapter file.

    Args:
        config: Migration configuration.
        adapter_file: Name of the adapter file.
        provider_name: Provider name for error handler.

    Returns:
        True if successful, False otherwise.
    """
    file_path = config.lib_dir / adapter_file

    print(f"Processing adapter: {adapter_file}")

    if not file_path.exists():
        print(f"Error: File {file_path} not found.")
        return False

    # Create backup
    backup_path = file_path.with_suffix(file_path.suffix + ".bak")
    shutil.copy(file_path, backup_path)
    print(f"Created backup: {backup_path.name}")

    # Read file
    content = file_path.read_text()
    lines = content.split("\n")

    # Update imports
    content = update_import_statements(content)
    print(f"Updated import statements in {adapter_file}")

    # Update lines after import changes
    lines = content.split("\n")

    # Add error handler property
    content = add_error_handler_property(content, lines)
    lines = content.split("\n")

    # Add error handler initialization
    content = add_error_handler_init(content, lines, provider_name)
    lines = content.split("\n")

    # Replace error names
    content = replace_error_names(content)
    lines = content.split("\n")

    # Process throw statements
    lines = process_throw_statements(lines)

    # Process catch blocks
    lines = process_catch_blocks(lines)

    # Write updated content
    file_path.write_text("\n".join(lines))

    print(f"Completed processing adapter: {adapter_file}")
    print()
    return True


def update_adapter_imports(config: MigrationConfig, adapter_file: str) -> bool:
    """Update imports in an adapter file.

    Args:
        config: Migration configuration.
        adapter_file: Name of the adapter file.

    Returns:
        True if successful, False otherwise.
    """
    file_path = config.lib_dir / adapter_file

    print(f"Updating imports in: {adapter_file}")

    if not file_path.exists():
        print(f"Error: File {file_path} not found.")
        return False

    content = file_path.read_text()

    # Update import path
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
        print("Updated error type exports in base adapter")

    file_path.write_text(content)
    print(f"Completed updating imports in: {adapter_file}")
    print()
    return True


def check_new_error_handler_files(config: MigrationConfig) -> bool:
    """Check if new error handler files exist.

    Args:
        config: Migration configuration.

    Returns:
        True if files exist, False otherwise.
    """
    error_handler = config.lib_dir / "vector-db-error-handler-new.ts"
    retry_handler = config.lib_dir / "vector-retry-handler-new.ts"

    if not error_handler.exists():
        print(f"Error: {error_handler} not found. Cannot continue without new error handler.")
        return False

    if not retry_handler.exists():
        print(f"Error: {retry_handler} not found. Cannot continue without new retry handler.")
        return False

    print("New error handler files exist. Proceeding with migration.")
    return True


def update_factory_file(config: MigrationConfig) -> bool:
    """Update the vector database factory file.

    Args:
        config: Migration configuration.

    Returns:
        True if successful, False otherwise.
    """
    print("Updating vector database factory file...")

    factory_file = config.lib_dir / "vector-database-factory.ts"

    if not factory_file.exists():
        print(f"Error: Vector database factory file {factory_file} not found.")
        return False

    # Create backup
    backup_path = factory_file.with_suffix(factory_file.suffix + ".bak")
    shutil.copy(factory_file, backup_path)

    content = factory_file.read_text()

    # Update imports and type names
    content = content.replace(
        'from "./vector-db-error-handler"',
        'from "./vector-db-error-handler-new"',
    )
    content = content.replace("VectorDBErrorType", "VectorDbErrorType")
    content = content.replace("VectorDBError", "VectorDbError")

    factory_file.write_text(content)
    print("Vector database factory file updated")
    print()
    return True


def finalize_migration(config: MigrationConfig) -> None:
    """Finalize the migration by renaming files.

    Args:
        config: Migration configuration.
    """
    print("Finalizing migration...")

    # Rename error handler files
    old_error_handler = config.lib_dir / "vector-db-error-handler.ts"
    new_error_handler = config.lib_dir / "vector-db-error-handler-new.ts"

    if old_error_handler.exists() and new_error_handler.exists():
        old_backup = config.lib_dir / "vector-db-error-handler.old.ts"
        old_error_handler.rename(old_backup)
        new_error_handler.rename(old_error_handler)
        print("Replaced vector-db-error-handler.ts with new version")
    else:
        print("Warning: Could not replace vector-db-error-handler.ts")

    # Rename retry handler files
    old_retry_handler = config.lib_dir / "vector-retry-handler.ts"
    new_retry_handler = config.lib_dir / "vector-retry-handler-new.ts"

    if old_retry_handler.exists() and new_retry_handler.exists():
        old_backup = config.lib_dir / "vector-retry-handler.old.ts"
        old_retry_handler.rename(old_backup)
        new_retry_handler.rename(old_retry_handler)
        print("Replaced vector-retry-handler.ts with new version")
    else:
        print("Warning: Could not replace vector-retry-handler.ts")

    # Update imports in adapter files to use original filenames
    for adapter_file in config.lib_dir.glob("*-adapter*.ts"):
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
        print(f"Updated imports in {adapter_file.name}")

    print("Migration finalized")


def migrate_vector_error_handling(config: Optional[MigrationConfig] = None) -> int:
    """Run the migration.

    Args:
        config: Migration configuration (auto-detected if None).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = MigrationConfig.from_script_location()

    print("Starting standardized error handling migration...")
    print(f"Working in directory: {config.lib_dir}")

    # Check for new error handler files
    if not check_new_error_handler_files(config):
        return 1

    # Update factory file
    if not update_factory_file(config):
        return 1

    # Update base adapter imports
    update_adapter_imports(config, "base-vector-database-adapter.ts")

    # Process all adapter files
    print("Processing adapter files...")
    adapters = [
        ("postgres-vector-database-adapter.ts", "postgres"),
        ("redis-vector-database-adapter.ts", "redis"),
        ("enhanced-vector-database-adapter.ts", "enhanced"),
        ("cosmosdb-vector-database-adapter.ts", "cosmosdb"),
        ("sqlserver-vector-database-adapter.ts", "sqlserver"),
    ]

    for adapter_file, provider_name in adapters:
        migrate_adapter(config, adapter_file, provider_name)

    # Finalize migration
    finalize_migration(config)

    print("Error handling standardization migration complete.")
    print()
    print("Note: You may need to manually review and fix any complex error handling patterns")
    print("that were not automatically converted by this script.")

    return 0


def main() -> int:
    """Main entry point."""
    return migrate_vector_error_handling()


if __name__ == "__main__":
    sys.exit(main())
