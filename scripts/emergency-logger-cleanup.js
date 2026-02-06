#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * EMERGENCY LOGGER IMPORT CLEANUP SCRIPT
 *
 * This script fixes corrupted logger imports that were inserted in wrong locations:
 * - Inside JSX tags
 * - Inside function bodies
 * - Inside interfaces
 * - Middle of code blocks
 *
 * Strategy:
 * 1. Remove ALL logger imports (regardless of location)
 * 2. Find the last proper import statement
 * 3. Add ONE correct logger import after it
 * 4. Only process files that actually use logger
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Initialize log aggregation
const logAggregation = new LogAggregation();


// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Statistics
const stats = {
  totalFiles: 0,
  filesProcessed: 0,
  filesFixed: 0,
  filesFailed: 0,
  filesSkipped: 0,
  errors: []
};

/**
 * Check if file actually uses logger
 */
function usesLogger(content) {
  // Look for logger method calls (excluding the import itself)
  const loggerUsagePattern = /logger\.(debug|info|warn|error|trace|fatal)\(/;
  return loggerUsagePattern.test(content);
}

/**
 * Remove all logger imports from content
 */
function removeAllLoggerImports(content) {
  // Match various forms of logger imports
  const patterns = [
    /import\s*{\s*logger\s*}\s*from\s*['"]@\/lib\/logger['"]\s*;?\s*\n?/g,
    /import\s*{logger}\s*from\s*['"]@\/lib\/logger['"]\s*;?\s*\n?/g,
    /import\s*{\s*logger\s*}\s*from\s*['"]@\/lib\/logger['"]\s*\n?/g,
  ];

  let cleaned = content;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned;
}

/**
 * Find the position after the last import statement
 */
function findLastImportPosition(content) {
  const lines = content.split('\n');
  let lastImportLine = -1;
  let inMultilineComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Track multiline comments
    if (line.includes('/*')) inMultilineComment = true;
    if (line.includes('*/')) inMultilineComment = false;

    // Skip comments and empty lines
    if (inMultilineComment || line.startsWith('//') || line.startsWith('*') || line === '') {
      continue;
    }

    // Check for import statements (including dynamic imports)
    if (line.startsWith('import ') && !line.includes('import(')) {
      lastImportLine = i;
    }

    // Stop at first non-import, non-comment code
    if (line &&
        !line.startsWith('import ') &&
        !line.startsWith('//') &&
        !line.startsWith('/*') &&
        !line.startsWith('*') &&
        !line.startsWith('export') &&
        line !== "'use client'" &&
        line !== '"use client"' &&
        line !== "'use server'" &&
        line !== '"use server"') {
      break;
    }
  }

  return lastImportLine;
}

/**
 * Add logger import at correct position
 */
function addLoggerImport(content) {
  const lastImportLine = findLastImportPosition(content);

  if (lastImportLine === -1) {
    // No imports found, add after 'use client' or at top
    const lines = content.split('\n');
    let insertLine = 0;

    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (lines[i].includes('use client') || lines[i].includes('use server')) {
        insertLine = i + 1;
        break;
      }
    }

    lines.splice(insertLine, 0, '', "import { logger } from '@/lib/logger';");
    return lines.join('\n');
  }

  // Add after last import
  const lines = content.split('\n');
  lines.splice(lastImportLine + 1, 0, "import { logger } from '@/lib/logger';");
  return lines.join('\n');
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    if (VERBOSE) console.log(`\n📄 Processing: ${filePath}`);

    // Read file
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if file uses logger
    if (!usesLogger(content)) {
      if (VERBOSE) console.log('   ⏭️  Skipped (no logger usage found)');
      stats.filesSkipped++;
      return;
    }

    // Remove all logger imports
    const withoutImports = removeAllLoggerImports(content);

    // Check if any imports were removed
    const importsRemoved = content !== withoutImports;

    if (!importsRemoved) {
      if (VERBOSE) console.log('   ⏭️  Skipped (no logger imports found)');
      stats.filesSkipped++;
      return;
    }

    // Add correct import
    const fixed = addLoggerImport(withoutImports);

    if (DRY_RUN) {
      console.log(`   🔍 [DRY RUN] Would fix: ${filePath}`);
      stats.filesProcessed++;
    } else {
      // Write fixed content
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`   ✅ Fixed: ${filePath}`);
      stats.filesProcessed++;
      stats.filesFixed++;
    }

  } catch (error) {
    console.error(`   ❌ Error processing ${filePath}:`, error.message);
    stats.filesFailed++;
    stats.errors.push({ file: filePath, error: error.message });
  }
}

/**
 * Find all files with logger imports
 */
function findAffectedFiles() {
  try {
    console.log('🔍 Finding files with logger imports...\n');

    // Use ripgrep or grep to find files
    let output;
    try {
      output = execSync(
        'rg -l "import.*logger.*from.*@/lib/logger" --type-add "code:*.{ts,tsx,js,jsx}" -t code',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
    } catch (e) {
      // rg returns exit code 1 if no matches, try grep as fallback
      try {
        output = execSync(
          'grep -rl "import.*logger.*from.*@/lib/logger" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" src/',
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
      } catch (e2) {
        console.error('❌ Could not find files. Make sure you are in the project root.');
        process.exit(1);
      }
    }

    const files = output
      .split('\n')
      .map(f => f.trim())
      .filter(f => f && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')))
      .map(f => path.resolve(f));

    return files;
  } catch (error) {
    console.error('❌ Error finding files:', error.message);
    return [];
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🚨 EMERGENCY LOGGER IMPORT CLEANUP 🚨\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

  // Find affected files
  const files = findAffectedFiles();
  stats.totalFiles = files.length;

  if (files.length === 0) {
    console.log('✅ No files found with logger imports');
    return;
  }

  console.log(`📊 Found ${files.length} files with logger imports\n`);
  console.log('🔧 Starting cleanup process...\n');

  // Process each file
  files.forEach(processFile);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CLEANUP SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files found:     ${stats.totalFiles}`);
  console.log(`Files processed:       ${stats.filesProcessed}`);
  console.log(`Files fixed:           ${stats.filesFixed}`);
  console.log(`Files skipped:         ${stats.filesSkipped}`);
  console.log(`Files failed:          ${stats.filesFailed}`);
  console.log('='.repeat(60));

  if (stats.errors.length > 0) {
    console.log('\n❌ ERRORS:\n');
    stats.errors.forEach(({ file, error }) => {
      console.log(`  ${file}`);
      console.log(`    └─ ${error}`);
    });
  }

  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to apply fixes\n');
  } else if (stats.filesFixed > 0) {
    console.log('\n✅ Cleanup complete! Run "npm run build" to verify.\n');
  }
}

// Run main
main();
