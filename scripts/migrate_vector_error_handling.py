#!/usr/bin/env python3
<<<<<<< HEAD


"""Migrate vector database adapters to standardized error handling.

This script updates all vector database adapters to use the new VectorDbErrorHandler class.
"""

from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------
=======
"""Script to standardize error handling across vector database adapters.

This script updates all vector database adapters to use the new VectorDbErrorHandler class.
"""
from __future__ import annotations
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import re
import shutil
import sys
<<<<<<< HEAD
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
=======
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
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)
    method_lower = method_name.lower()

    if "initialize" in line_lower or "not initialized" in line_lower:
        return "VectorDbErrorType.INITIALIZATION"
    if "connect" in line_lower or "connection" in line_lower:
        return "VectorDbErrorType.CONNECTION"
    if "search" in line_lower or "search" in method_lower:
        return "VectorDbErrorType.SEARCH"
<<<<<<< HEAD
    if "store" in method_lower or "create" in method_lower:
        return "VectorDbErrorType.VECTOR_OPERATION_FAILED"
    if "delete" in method_lower or "remove" in method_lower:
=======
    if any(x in method_lower for x in ["store", "create"]):
        return "VectorDbErrorType.VECTOR_OPERATION_FAILED"
    if any(x in method_lower for x in ["delete", "remove"]):
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)
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


<<<<<<< HEAD
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
=======
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
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)
        return False

    content = file_path.read_text()

<<<<<<< HEAD
    # Update import path
=======
    # Update import statements
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)
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
<<<<<<< HEAD
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
=======
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
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)
    content = content.replace(
        'from "./vector-db-error-handler"',
        'from "./vector-db-error-handler-new"',
    )
    content = content.replace("VectorDBErrorType", "VectorDbErrorType")
    content = content.replace("VectorDBError", "VectorDbError")

    factory_file.write_text(content)
<<<<<<< HEAD
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
=======
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
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)
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
<<<<<<< HEAD
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
=======
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
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)
    adapters = [
        ("postgres-vector-database-adapter.ts", "postgres"),
        ("redis-vector-database-adapter.ts", "redis"),
        ("enhanced-vector-database-adapter.ts", "enhanced"),
        ("cosmosdb-vector-database-adapter.ts", "cosmosdb"),
        ("sqlserver-vector-database-adapter.ts", "sqlserver"),
    ]

    for adapter_file, provider_name in adapters:
<<<<<<< HEAD
        migrate_adapter(config, adapter_file, provider_name)

    # Finalize migration
    finalize_migration(config)

    print("Error handling standardization migration complete.")
    print()
    print("Note: You may need to manually review and fix any complex error handling patterns")
    print("that were not automatically converted by this script.")
=======
        migrate_adapter_to_new_error_handler(lib_dir, adapter_file, provider_name)

    # Finalize migration
    finalize_migration(lib_dir)

    log("Error handling standardization migration complete.")
    log("")
    log("Note: You may need to manually review and fix any complex error handling patterns")
    log("that were not automatically converted by this script.")
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)

    return 0


<<<<<<< HEAD
def main() -> int:
    """Main entry point."""
    return migrate_vector_error_handling()


if __name__ == "__main__":
    sys.exit(main())
=======
if __name__ == "__main__":
    sys.exit(main())
>>>>>>> 179ba03dc (feat(scripts): convert shell scripts to Python and add vfkit TUI)
