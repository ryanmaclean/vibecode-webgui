#!/usr/bin/env node
/**
 * Console to Winston Logger Migration Script
 *
 * Automatically migrates console.* calls to Winston logger.* calls
 * across the entire src/ directory.
 *
 * Features:
 * - Adds logger import if not present
 * - Preserves multiline statements
 * - Handles metadata/objects
 * - Supports dry-run mode
 * - File filtering with glob patterns
 * - Detailed migration report
 *
 * Usage:
 *   node scripts/migrate-console-to-logger.js              # Full migration
 *   node scripts/migrate-console-to-logger.js --dry-run    # Preview changes
 *   node scripts/migrate-console-to-logger.js --files "src/hooks/**"  # Target specific files
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Configuration
const CONFIG = {
  sourceDir: path.join(__dirname, '../src'),
  loggerImportPath: '@/lib/logger',
  targetExtensions: ['.ts', '.tsx', '.js', '.jsx'],
  consoleMethodMap: {
    'console.log': 'logger.info',
    'console.error': 'logger.error',
    'console.warn': 'logger.warn',
    'console.debug': 'logger.debug',
    'console.info': 'logger.info',
  },
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
  ],
};

// Statistics tracker
const stats = {
  filesScanned: 0,
  filesModified: 0,
  totalReplacements: 0,
  replacementsByType: {},
  errors: [],
  skipped: [],
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    filePattern: null,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run' || arg === '-d') {
      options.dryRun = true;
    } else if (arg === '--files' || arg === '-f') {
      options.filePattern = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Console to Winston Logger Migration Script

Usage:
  node scripts/migrate-console-to-logger.js [options]

Options:
  --dry-run, -d          Preview changes without modifying files
  --files, -f PATTERN    Target specific files (glob pattern)
  --verbose, -v          Show detailed output
  --help, -h             Show this help message

Examples:
  # Full migration (dry-run first recommended)
  node scripts/migrate-console-to-logger.js --dry-run
  node scripts/migrate-console-to-logger.js

  # Target specific directory
  node scripts/migrate-console-to-logger.js --files "src/hooks/**"

  # Target specific files
  node scripts/migrate-console-to-logger.js --files "src/pages/api/**/*.ts"
  `);
}

/**
 * Find all source files to process
 */
async function findSourceFiles(options) {
  const pattern = options.filePattern || `${CONFIG.sourceDir}/**/*{${CONFIG.targetExtensions.join(',')}}`;

  const files = await glob(pattern, {
    ignore: CONFIG.excludePatterns,
    absolute: true,
  });

  return files;
}

/**
 * Check if file already has logger import
 */
function hasLoggerImport(content) {
  const importRegex = /import\s+.*?from\s+['"]@\/lib\/logger['"]/;
  return importRegex.test(content);
}

/**
 * Check if file has any console.* calls
 */
function hasConsoleCalls(content) {
  const consoleRegex = /console\.(log|error|warn|debug|info)/;
  return consoleRegex.test(content);
}

/**
 * Add logger import to file content
 */
function addLoggerImport(content) {
  // Find the last import statement
  const importRegex = /^import\s+.*?;?\s*$/gm;
  let lastImportIndex = -1;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    lastImportIndex = match.index + match[0].length;
  }

  const loggerImport = "import { logger } from '@/lib/logger';";

  if (lastImportIndex === -1) {
    // No imports found, add at the beginning (after any leading comments)
    const firstNonCommentLine = content.search(/^(?!\/\/|\/\*|\*|['"]use \w+['"]).+/m);
    if (firstNonCommentLine === -1) {
      return loggerImport + '\n\n' + content;
    }
    return content.slice(0, firstNonCommentLine) + loggerImport + '\n\n' + content.slice(firstNonCommentLine);
  }

  // Add after last import
  return content.slice(0, lastImportIndex) + '\n' + loggerImport + content.slice(lastImportIndex);
}

/**
 * Replace console calls with logger calls
 */
function replaceConsoleCalls(content, filePath) {
  let modified = content;
  const replacements = [];

  // Handle multiline console statements with regex that captures the full call
  for (const [consoleMethod, loggerMethod] of Object.entries(CONFIG.consoleMethodMap)) {
    const methodName = consoleMethod.split('.')[1];

    // Regex to match console.method(...) including multiline
    // This handles: console.log('text'), console.log('text', {data}), console.error(...), etc.
    const regex = new RegExp(
      `console\\.${methodName}\\s*\\([^)]*(?:\\([^)]*\\)[^)]*)*\\)`,
      'gs'
    );

    let match;
    while ((match = regex.exec(content)) !== null) {
      const originalCall = match[0];
      const replacement = originalCall.replace(`console.${methodName}`, loggerMethod);

      replacements.push({
        original: originalCall,
        replacement: replacement,
        line: content.substring(0, match.index).split('\n').length,
      });

      modified = modified.replace(originalCall, replacement);

      // Update statistics
      stats.totalReplacements++;
      stats.replacementsByType[consoleMethod] = (stats.replacementsByType[consoleMethod] || 0) + 1;
    }
  }

  return { modified, replacements };
}

/**
 * Process a single file
 */
async function processFile(filePath, options) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    stats.filesScanned++;

    // Skip if no console calls
    if (!hasConsoleCalls(content)) {
      if (options.verbose) {
        console.log(`  ⏭  ${path.relative(CONFIG.sourceDir, filePath)} - No console calls`);
      }
      return null;
    }

    let modified = content;
    let hasChanges = false;

    // Add logger import if needed
    if (!hasLoggerImport(content)) {
      modified = addLoggerImport(modified);
      hasChanges = true;
    }

    // Replace console calls
    const { modified: withReplacements, replacements } = replaceConsoleCalls(modified, filePath);

    if (replacements.length > 0) {
      modified = withReplacements;
      hasChanges = true;
    }

    if (!hasChanges) {
      return null;
    }

    // Write changes if not dry-run
    if (!options.dryRun) {
      fs.writeFileSync(filePath, modified, 'utf8');
    }

    stats.filesModified++;

    return {
      filePath,
      replacements,
      addedImport: !hasLoggerImport(content),
    };

  } catch (error) {
    stats.errors.push({
      filePath,
      error: error.message,
    });
    return null;
  }
}

/**
 * Format file path for display
 */
function formatPath(filePath) {
  return path.relative(process.cwd(), filePath);
}

/**
 * Print migration report
 */
function printReport(results, options) {
  console.log('\n' + '='.repeat(80));
  console.log('MIGRATION REPORT');
  console.log('='.repeat(80));

  if (options.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No files were modified\n');
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Files scanned:    ${stats.filesScanned}`);
  console.log(`  Files modified:   ${stats.filesModified}`);
  console.log(`  Total replacements: ${stats.totalReplacements}`);

  if (Object.keys(stats.replacementsByType).length > 0) {
    console.log(`\n📝 Replacements by type:`);
    for (const [method, count] of Object.entries(stats.replacementsByType)) {
      const loggerMethod = CONFIG.consoleMethodMap[method];
      console.log(`  ${method} → ${loggerMethod}: ${count}`);
    }
  }

  if (results.length > 0) {
    console.log(`\n📄 Modified files:\n`);
    results.forEach(result => {
      const relativePath = formatPath(result.filePath);
      console.log(`  ✅ ${relativePath}`);
      if (result.addedImport) {
        console.log(`     + Added logger import`);
      }
      console.log(`     ~ ${result.replacements.length} replacement(s)`);

      if (options.verbose) {
        result.replacements.forEach(rep => {
          console.log(`       Line ${rep.line}: ${rep.original.substring(0, 60)}...`);
        });
      }
    });
  }

  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors:\n`);
    stats.errors.forEach(error => {
      console.log(`  ${formatPath(error.filePath)}: ${error.error}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  // Estimated time
  const avgTimePerFile = 0.1; // seconds
  const estimatedTime = (stats.filesScanned * avgTimePerFile).toFixed(1);
  console.log(`\n⏱  Estimated time: ${estimatedTime}s`);

  if (options.dryRun) {
    console.log(`\n💡 To apply these changes, run without --dry-run flag`);
  } else {
    console.log(`\n✅ Migration complete!`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();
  const options = parseArgs();

  console.log('\n🚀 Console to Winston Logger Migration Script\n');

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No files will be modified\n');
  }

  // Find all source files
  console.log('🔍 Scanning for source files...');
  const files = await findSourceFiles(options);
  console.log(`   Found ${files.length} file(s) to process\n`);

  if (files.length === 0) {
    console.log('❌ No files found matching the criteria');
    process.exit(1);
  }

  // Process each file
  console.log('🔄 Processing files...\n');
  const results = [];

  for (const file of files) {
    const result = await processFile(file, options);
    if (result) {
      results.push(result);
      if (!options.verbose) {
        process.stdout.write('.');
      }
    }
  }

  if (!options.verbose) {
    console.log('\n');
  }

  // Print report
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  printReport(results, options);

  console.log(`⏱  Actual execution time: ${duration}s\n`);

  // Exit with error code if there were errors
  if (stats.errors.length > 0) {
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = { processFile, replaceConsoleCalls, addLoggerImport };
