#!/usr/bin/env python3
"""Fix cognitive search adapter TypeScript file.

Updates imports and error handling in the cognitive-search-vector-database-adapter.ts file.
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    GREEN = "\033[0;32m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.GREEN = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


CHECK_INDEX_EXISTS_METHOD = '''  private async checkIndexExists(indexName: string): Promise<boolean> {
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
  }'''


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "file_path",
        type=Path,
        nargs="?",
        default=Path.home() / "vibecode-webgui/src/lib/vector-db/cognitive-search-vector-database-adapter.ts",
        help="Path to the TypeScript file",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Don't create a backup file",
    )

    args = parser.parse_args(argv)
    file_path: Path = args.file_path

    if not file_path.exists():
        print(f"error: File not found: {file_path}")
        return 1

    # Create backup
    if not args.no_backup:
        backup_path = file_path.with_suffix(file_path.suffix + ".bak")
        shutil.copy2(file_path, backup_path)
        print(f"Created backup: {backup_path}")

    content = file_path.read_text()

    # Fix import statement (line 16)
    content = re.sub(
        r"import \{ handleVectorDBError as errorHandler, VectorDBErrorType \} from.*",
        "import { VectorDbErrorHandler, VectorDbErrorType } from './vector-db-error-handler';",
        content,
    )

    # Fix error handler initialization in constructor
    content = re.sub(
        r"this\.errorHandler = handleVectorDBError;",
        "this.errorHandler = new VectorDbErrorHandler('azure-cognitive-search', config.enableLogging, config.enableMetrics);",
        content,
    )

    # Fix VectorDBErrorType to VectorDbErrorType
    content = content.replace("VectorDBErrorType", "VectorDbErrorType")

    # Fix CONNECTION_FAILED to CONNECTION
    content = content.replace("CONNECTION_FAILED", "CONNECTION")

    # Replace checkIndexExists method
    check_index_pattern = r"private async checkIndexExists\([^)]*\): Promise<boolean> \{.*?(?=\n  protected async pingProvider|\n  public async)"
    content = re.sub(
        check_index_pattern,
        CHECK_INDEX_EXISTS_METHOD,
        content,
        flags=re.DOTALL,
    )

    file_path.write_text(content)

    print(f"{Colors.GREEN}Updated cognitive-search-vector-database-adapter.ts with improved error handling{Colors.NC}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
