#!/usr/bin/env python3
"""Fix cognitive search adapter TypeScript file.

Fixes import statements and error handler initialization in the
Azure Cognitive Search vector database adapter.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from textwrap import dedent


# Default file path (can be overridden)
DEFAULT_FILE_PATH = Path.home() / "vibecode-webgui" / "src" / "lib" / "vector-db" / "cognitive-search-vector-database-adapter.ts"


def get_check_index_exists_replacement() -> str:
    """Get the replacement code for checkIndexExists method."""
    return dedent("""\
      private async checkIndexExists(indexName: string): Promise<boolean> {
        if (!this.searchIndexClient) {
          throw this.errorHandler.handleError(
            new Error('Search index client not initialized'),
            'checkIndexExists',
            VectorDbErrorType.INITIALIZATION,
            false
          );
        }

        try {
          const indexes = await this.searchIndexClient.listIndexes();
          for await (const index of indexes) {
            if (index.name === indexName) {
              return true;
            }
          }
          return false;
        } catch (error) {
          // Determine error type based on error characteristics
          let errorType = VectorDbErrorType.SERVICE;
          let retryable = false;

          if (this.errorHandler.isAuthError(error)) {
            errorType = VectorDbErrorType.AUTHENTICATION;
            retryable = false;
          } else if (this.errorHandler.isNetworkError(error)) {
            errorType = VectorDbErrorType.CONNECTION;
            retryable = true;
          } else if (this.errorHandler.isTimeoutError(error)) {
            errorType = VectorDbErrorType.TIMEOUT;
            retryable = true;
          }

          // Include additional context in error data
          const errorData = {
            endpoint: this.searchConfig.endpoint,
            indexName
          };

          // For index checks, we'll log but not throw to allow initialization to continue
          // and make a decision about the missing index
          if (this.config.enableLogging) {
            console.error('Error checking if index exists:', error);
          }

          if (this.config.enableMetrics) {
            metrics.increment('vector_db.check_index.error');
          }

          return false;
        }
      }
    """)


def fix_imports(content: str) -> str:
    """Fix import statements for error handler."""
    # Fix error handler import
    content = re.sub(
        r"import \{ handleVectorDBError as errorHandler, VectorDBErrorType \} from.*",
        "import { VectorDbErrorHandler, VectorDbErrorType } from './vector-db-error-handler';",
        content,
    )
    return content


def fix_error_handler_init(content: str) -> str:
    """Fix error handler initialization in constructor."""
    content = re.sub(
        r"this\.errorHandler = handleVectorDBError;",
        "this.errorHandler = new VectorDbErrorHandler('azure-cognitive-search', config.enableLogging, config.enableMetrics);",
        content,
    )
    return content


def fix_error_types(content: str) -> str:
    """Fix VectorDBErrorType to VectorDbErrorType."""
    content = content.replace("VectorDBErrorType", "VectorDbErrorType")
    content = content.replace("CONNECTION_FAILED", "CONNECTION")
    return content


def main(file_path: Path | None = None) -> int:
    """Main entry point.

    Args:
        file_path: Path to the adapter file. Defaults to DEFAULT_FILE_PATH.
    """
    target_file = file_path or DEFAULT_FILE_PATH

    if not target_file.exists():
        print(f"Error: File not found: {target_file}")
        return 1

    # Create backup
    backup_path = target_file.with_suffix(".ts.bak")
    backup_path.write_text(target_file.read_text())
    print(f"Created backup: {backup_path}")

    # Read content
    content = target_file.read_text()

    # Apply fixes
    content = fix_imports(content)
    content = fix_error_handler_init(content)
    content = fix_error_types(content)

    # Note: The checkIndexExists replacement would need more sophisticated
    # parsing to properly replace the method. For now, we apply the simpler fixes.

    # Write updated content
    target_file.write_text(content)

    print(f"Updated {target_file.name} with improved error handling")
    print("Applied fixes:")
    print("  - Fixed error handler import")
    print("  - Fixed error handler initialization")
    print("  - Fixed VectorDBErrorType -> VectorDbErrorType")
    print("  - Fixed CONNECTION_FAILED -> CONNECTION")

    return 0


if __name__ == "__main__":
    # Allow passing file path as argument
    if len(sys.argv) > 1:
        sys.exit(main(Path(sys.argv[1])))
    else:
        sys.exit(main())
