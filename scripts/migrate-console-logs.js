#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * Console.log to Structured Logger Migration Tool
 *
 * Automatically migrates console.log, console.error, console.warn, and console.info
 * to the project's Winston-based structured logger.
 *
 * Features:
 * - Intelligent pattern matching with context awareness
 * - Automatic logger import injection
 * - Multiple argument handling with metadata conversion
 * - Dry-run mode for safe preview
 * - Batch and incremental migration support
 * - Excludes test files and node_modules by default
 *
 * Usage:
 *   # Dry-run (analyze only, no changes)
 *   node scripts/migrate-console-logs.js [files/directories...]
 *   node scripts/migrate-console-logs.js server/index.js
 *   node scripts/migrate-console-logs.js src/lib/
 *
 *   # Transform mode (apply changes)
 *   node scripts/migrate-console-logs.js --transform [files/directories...]
 *   node scripts/migrate-console-logs.js -t server/index.js
 *
 *   # Generate detailed report
 *   node scripts/migrate-console-logs.js --output report.txt src/
 *
 * Options:
 *   --dry-run, -d       Analyze without making changes (default)
 *   --transform, -t     Apply transformations to files
 *   --output, -o FILE   Write detailed report to file
 *   --include-tests     Include test files in migration
 *   --help, -h          Show this help message
 *
 * Examples:
 *   # Analyze all source files
 *   node scripts/migrate-console-logs.js src/
 *
 *   # Transform specific file
 *   node scripts/migrate-console-logs.js -t server/index.js
 *
 *   # Transform directory with report
 *   node scripts/migrate-console-logs.js -t -o report.txt src/lib/
 *
 *   # Include test files in analysis
 *   node scripts/migrate-console-logs.js --include-tests tests/
 */

const fs = require('fs');
const path = require('path');

// Initialize log aggregation
const logAggregation = new LogAggregation();


// Configuration
const DEFAULT_PATHS = ['src/', 'server/', 'scripts/'];
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /coverage/,
  /\.git/,
  /claudedocs/,
];

const TEST_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\/__tests__\//,
  /\/tests?\//,
];

// Console method mappings
const CONSOLE_MAPPINGS = {
  'console.error': { level: 'error', loggerMethod: 'logger.error' },
  'console.warn': { level: 'warn', loggerMethod: 'logger.warn' },
  'console.info': { level: 'info', loggerMethod: 'logger.info' },
  'console.log': { level: 'info', loggerMethod: 'logger.info' },
  'console.debug': { level: 'debug', loggerMethod: 'logger.debug' },
};

// Statistics
const stats = {
  filesScanned: 0,
  filesWithConsole: 0,
  totalOccurrences: 0,
  byLevel: { error: 0, warn: 0, info: 0, debug: 0 },
  filesTransformed: 0,
  errorsEncountered: 0,
};

// Findings storage
const findings = [];

/**
 * Check if file should be excluded
 */
function shouldExclude(filePath, includeTests = false) {
  if (EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath))) {
    return true;
  }

  if (!includeTests && TEST_PATTERNS.some(pattern => pattern.test(filePath))) {
    return true;
  }

  return false;
}

/**
 * Get all files recursively
 */
function getAllFiles(dirPath, fileList = [], includeTests = false) {
  if (!fs.existsSync(dirPath)) {
    console.error(`Warning: Path does not exist: ${dirPath}`);
    return fileList;
  }

  const stat = fs.statSync(dirPath);

  if (stat.isFile()) {
    if (/\.(ts|tsx|js|jsx)$/.test(dirPath) && !shouldExclude(dirPath, includeTests)) {
      fileList.push(dirPath);
    }
    return fileList;
  }

  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);

    if (shouldExclude(filePath, includeTests)) {
      return;
    }

    if (fs.statSync(filePath).isDirectory()) {
      fileList = getAllFiles(filePath, fileList, includeTests);
    } else if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Extract console method calls using a more robust parser
 */
function findConsoleCalls(content) {
  const calls = [];
  const lines = content.split('\n');

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim();

    // Skip comments
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
      return;
    }

    // Find all console method calls
    Object.keys(CONSOLE_MAPPINGS).forEach(consoleMethod => {
      const escapedMethod = consoleMethod.replace('.', '\\.');
      const regex = new RegExp(`${escapedMethod}\\s*\\(`, 'g');
      let match;

      while ((match = regex.exec(line)) !== null) {
        const startPos = match.index;
        const callText = extractFullCall(line, startPos + match[0].length - 1);

        if (callText) {
          calls.push({
            lineIndex,
            line,
            method: consoleMethod,
            fullCall: consoleMethod + callText,
            startPos,
            endPos: startPos + consoleMethod.length + callText.length,
          });
        }
      }
    });
  });

  return calls;
}

/**
 * Extract full function call including nested parentheses
 */
function extractFullCall(line, startPos) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let result = '';

  for (let i = startPos; i < line.length; i++) {
    const char = line[i];
    const prevChar = i > 0 ? line[i - 1] : '';

    result += char;

    // Track string boundaries
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    // Track parentheses depth
    if (!inString) {
      if (char === '(') depth++;
      if (char === ')') {
        depth--;
        if (depth === 0) {
          return result;
        }
      }
    }
  }

  return null; // Incomplete call
}

/**
 * Analyze a single file for console statements
 */
function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const fileFindings = [];

    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();

      // Skip comments
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
        return;
      }

      // Check for each console method
      Object.entries(CONSOLE_MAPPINGS).forEach(([method, config]) => {
        const escapedMethod = method.replace('.', '\\.');
        const regex = new RegExp(`${escapedMethod}\\s*\\([^)]*\\)`, 'g');
        const matches = line.match(regex);

        if (matches) {
          matches.forEach(match => {
            const suggested = generateReplacement(match, config.loggerMethod);

            const finding = {
              file: filePath,
              line: lineIndex + 1,
              original: match,
              suggested,
              level: config.level,
              context: line.trim(),
            };

            fileFindings.push(finding);
            findings.push(finding);
            stats.totalOccurrences++;
            stats.byLevel[config.level]++;
          });
        }
      });
    });

    stats.filesScanned++;
    if (fileFindings.length > 0) {
      stats.filesWithConsole++;
    }

    return fileFindings;
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    stats.errorsEncountered++;
    return [];
  }
}

/**
 * Generate intelligent replacement based on context
 */
function generateReplacement(original, loggerMethod) {
  // Extract the arguments
  const argsMatch = original.match(/console\.\w+\s*\((.*)\)$/s);
  if (!argsMatch) return original.replace(/console\.\w+/, loggerMethod);

  const args = argsMatch[1].trim();

  // No arguments
  if (!args) {
    return `${loggerMethod}('Empty log')`;
  }

  // Parse arguments
  const argsList = splitArguments(args);

  // Single argument - keep as is
  if (argsList.length === 1) {
    return `${loggerMethod}(${argsList[0]})`;
  }

  // Multiple arguments - convert to structured logging
  const message = argsList[0];
  const metadata = argsList.slice(1);

  // Check if last argument looks like an error object
  const lastArg = metadata[metadata.length - 1].trim();
  const isError = lastArg === 'error' || lastArg === 'err' || lastArg.endsWith('.error') || lastArg.endsWith('.err');

  if (isError && metadata.length === 1) {
    // Special case: console.error('Message', error) -> logger.error('Message', { error })
    return `${loggerMethod}(${message}, { error: ${lastArg} })`;
  }

  // Try to intelligently structure metadata
  if (metadata.length === 1) {
    const metaArg = metadata[0].trim();
    // If it looks like an object, use it directly
    if (metaArg.startsWith('{')) {
      return `${loggerMethod}(${message}, ${metaArg})`;
    }
    // Otherwise wrap it
    return `${loggerMethod}(${message}, { data: ${metaArg} })`;
  }

  // Multiple metadata arguments - create structured object
  const metadataObj = metadata.map((m, i) => {
    const trimmed = m.trim();
    // Try to use variable name as key
    const varName = trimmed.match(/^[\w$]+$/);
    if (varName) {
      return `${varName[0]}: ${trimmed}`;
    }
    return `arg${i + 1}: ${trimmed}`;
  }).join(', ');

  return `${loggerMethod}(${message}, { ${metadataObj} })`;
}

/**
 * Split arguments respecting nested structures and strings
 */
function splitArguments(argsStr) {
  const args = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    const prev = i > 0 ? argsStr[i - 1] : '';

    // Track string boundaries
    if ((char === '"' || char === "'" || char === '`') && prev !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    // Track bracket depth
    if (!inString) {
      if (char === '(' || char === '[' || char === '{') depth++;
      if (char === ')' || char === ']' || char === '}') depth--;
    }

    // Split on comma at depth 0
    if (char === ',' && depth === 0 && !inString) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Transform a file by replacing console statements
 */
function transformFile(filePath, fileFindings) {
  if (fileFindings.length === 0) return false;

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const isTypeScript = /\.tsx?$/.test(filePath);
    const isModule = content.includes('import ') || content.includes('export ');
    let modified = false;

    // Check if logger import already exists
    const hasLoggerImport = content.match(/import.*logger.*from/i) ||
                           content.match(/const.*logger.*=.*require/i);

    // Add logger import if needed
    if (!hasLoggerImport) {
      const importStatement = generateLoggerImport(filePath, isModule, isTypeScript);
      content = injectImport(content, importStatement);
      modified = true;
    }

    // Replace console statements - use global replace for each unique pattern
    fileFindings.forEach(finding => {
      // Escape special regex characters in the original string
      const escapedOriginal = finding.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedOriginal, 'g');

      if (content.includes(finding.original)) {
        content = content.replace(regex, finding.suggested);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.filesTransformed++;
    }

    return modified;
  } catch (error) {
    console.error(`Error transforming ${filePath}:`, error.message);
    stats.errorsEncountered++;
    return false;
  }
}

/**
 * Generate appropriate logger import statement
 */
function generateLoggerImport(filePath, isModule, isTypeScript) {
  if (!isModule) {
    // CommonJS require
    return "const { logger } = require('./src/lib/logger');\n";
  }

  // ES Module import - calculate relative path
  const fileDir = path.dirname(filePath);
  const loggerPath = path.join(process.cwd(), 'src', 'lib', 'logger');
  let relativePath = path.relative(fileDir, loggerPath);

  // Normalize path separators for imports
  relativePath = relativePath.replace(/\\/g, '/');

  // Ensure it starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  return `import { logger } from '${relativePath}';\n`;
}

/**
 * Inject import statement at the appropriate location
 */
function injectImport(content, importStatement) {
  const lines = content.split('\n');
  let insertIndex = 0;

  // Find the last import/require statement
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || line.startsWith('const ') || line.startsWith('require(')) {
      insertIndex = i + 1;
    } else if (insertIndex > 0 && line === '') {
      // Stop at first empty line after imports
      break;
    }
  }

  // Insert the import
  lines.splice(insertIndex, 0, importStatement);
  return lines.join('\n');
}

/**
 * Generate detailed report
 */
function generateReport(outputFile = null) {
  const report = [];

  report.push('='.repeat(80));
  report.push('Console.log to Structured Logger Migration Report');
  report.push('='.repeat(80));
  report.push('');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push('');
  report.push('Summary:');
  report.push(`  Files scanned:        ${stats.filesScanned}`);
  report.push(`  Files with console:   ${stats.filesWithConsole}`);
  report.push(`  Total occurrences:    ${stats.totalOccurrences}`);
  report.push(`  Files transformed:    ${stats.filesTransformed}`);
  report.push(`  Errors encountered:   ${stats.errorsEncountered}`);
  report.push('');
  report.push('By Severity Level:');
  report.push(`  ERROR (console.error):   ${stats.byLevel.error}`);
  report.push(`  WARN  (console.warn):    ${stats.byLevel.warn}`);
  report.push(`  INFO  (console.log/info): ${stats.byLevel.info}`);
  report.push(`  DEBUG (console.debug):   ${stats.byLevel.debug}`);
  report.push('');

  if (findings.length > 0) {
    report.push('='.repeat(80));
    report.push('Detailed Findings by File:');
    report.push('='.repeat(80));
    report.push('');

    // Group by file
    const byFile = {};
    findings.forEach(f => {
      if (!byFile[f.file]) byFile[f.file] = [];
      byFile[f.file].push(f);
    });

    Object.entries(byFile).forEach(([file, fileFindings]) => {
      report.push(`📁 ${file}`);
      report.push(`   ${fileFindings.length} occurrence(s)`);
      report.push('-'.repeat(80));

      fileFindings.forEach((f, idx) => {
        report.push(`  ${idx + 1}. Line ${f.line}: [${f.level.toUpperCase()}]`);
        report.push(`     Original:  ${f.original}`);
        report.push(`     Suggested: ${f.suggested}`);
        report.push('');
      });

      report.push('');
    });
  }

  report.push('='.repeat(80));
  report.push('Recommended Migration Strategy:');
  report.push('='.repeat(80));
  report.push('');

  if (stats.totalOccurrences === 0) {
    report.push('✅ No console statements found! Your code is already using structured logging.');
  } else if (stats.totalOccurrences < 10) {
    report.push('🎯 INCREMENTAL APPROACH (Recommended for < 10 occurrences):');
    report.push('');
    report.push('1. Transform files one by one:');
    report.push('   node scripts/migrate-console-logs.js -t path/to/file.js');
    report.push('');
    report.push('2. Test each file after transformation');
    report.push('');
    report.push('3. Commit each file individually');
  } else if (stats.totalOccurrences < 50) {
    report.push('🎯 DIRECTORY-BY-DIRECTORY APPROACH (Recommended for 10-50 occurrences):');
    report.push('');
    report.push('1. Transform by directory:');
    report.push('   node scripts/migrate-console-logs.js -t src/lib/');
    report.push('');
    report.push('2. Run tests:');
    report.push('   npm run test');
    report.push('   npm run lint');
    report.push('');
    report.push('3. Review changes:');
    report.push('   git diff');
    report.push('');
    report.push('4. Commit if tests pass');
  } else {
    report.push('🎯 BATCH MIGRATION APPROACH (For > 50 occurrences):');
    report.push('');
    report.push('⚠️  IMPORTANT: This requires comprehensive testing!');
    report.push('');
    report.push('1. Create a feature branch:');
    report.push('   git checkout -b feature/structured-logging-migration');
    report.push('');
    report.push('2. Run full migration:');
    report.push('   node scripts/migrate-console-logs.js -t src/ server/ scripts/');
    report.push('');
    report.push('3. Review all changes:');
    report.push('   git diff --stat');
    report.push('   git diff');
    report.push('');
    report.push('4. Run comprehensive tests:');
    report.push('   npm run test');
    report.push('   npm run test:integration');
    report.push('   npm run lint');
    report.push('   npm run type-check');
    report.push('');
    report.push('5. Commit and create PR:');
    report.push('   git add -A');
    report.push('   git commit -m "refactor: migrate console.log to structured logger"');
    report.push('   git push origin feature/structured-logging-migration');
  }

  report.push('');
  report.push('='.repeat(80));
  report.push('Post-Migration Checklist:');
  report.push('='.repeat(80));
  report.push('');
  report.push('✓ All tests passing');
  report.push('✓ Linting passes');
  report.push('✓ Type checking passes');
  report.push('✓ Manual testing of affected features');
  report.push('✓ Review logger configuration (src/lib/logger.ts)');
  report.push('✓ Verify log outputs in development environment');
  report.push('✓ Check log aggregation in production environment');
  report.push('');

  const reportText = report.join('\n');

  if (outputFile) {
    try {
      fs.writeFileSync(outputFile, reportText);
      console.log(`\n📄 Detailed report written to: ${outputFile}`);
    } catch (error) {
      console.error(`Error writing report: ${error.message}`);
    }
  } else {
    console.log('\n' + reportText);
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let mode = 'analyze';
  let outputFile = null;
  let paths = [];
  let includeTests = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      const helpText = fs.readFileSync(__filename, 'utf8');
      const helpMatch = helpText.match(/\/\*\*([\s\S]*?)\*\//);
      if (helpMatch) {
        console.log(helpMatch[1].trim());
      }
      process.exit(0);
    } else if (arg === '--transform' || arg === '-t') {
      mode = 'transform';
    } else if (arg === '--dry-run' || arg === '-d') {
      mode = 'analyze';
    } else if (arg === '--output' || arg === '-o') {
      outputFile = args[++i];
    } else if (arg === '--include-tests') {
      includeTests = true;
    } else if (!arg.startsWith('-')) {
      paths.push(arg);
    }
  }

  // Use default paths if none provided
  if (paths.length === 0) {
    paths = DEFAULT_PATHS.filter(p => fs.existsSync(p));
  }

  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  Console.log → Structured Logger Migration Tool                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Mode:         ${mode === 'transform' ? '✏️  TRANSFORM (changes will be applied)' : '🔍 ANALYZE (dry-run, no changes)'}`);
  console.log(`Paths:        ${paths.join(', ')}`);
  console.log(`Include tests: ${includeTests ? 'Yes' : 'No'}`);
  console.log('');

  // Collect all files
  const allFiles = [];
  paths.forEach(p => {
    const fullPath = path.resolve(p);
    const files = getAllFiles(fullPath, [], includeTests);
    allFiles.push(...files);
  });

  console.log(`📂 Found ${allFiles.length} file(s) to analyze\n`);

  if (allFiles.length === 0) {
    console.log('❌ No files found to analyze. Check your paths.\n');
    process.exit(1);
  }

  // Analyze all files
  allFiles.forEach(file => {
    const fileFindings = analyzeFile(file);

    if (fileFindings.length > 0) {
      const relativePath = path.relative(process.cwd(), file);
      console.log(`✓ ${relativePath} (${fileFindings.length} occurrence(s))`);

      // Transform if in transform mode
      if (mode === 'transform') {
        const success = transformFile(file, fileFindings);
        if (success) {
          console.log(`  ✏️  Transformed`);
        }
      }
    }
  });

  console.log('');

  if (mode === 'transform') {
    console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Transformation Complete!                                                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Files modified: ${stats.filesTransformed}`);
    console.log(`Total changes:  ${stats.totalOccurrences}`);
    console.log('');
    console.log('⚠️  Next Steps:');
    console.log('  1. Review changes:    git diff');
    console.log('  2. Run tests:         npm test');
    console.log('  3. Run linter:        npm run lint');
    console.log('  4. Type check:        npm run type-check');
    console.log('  5. Commit if passing: git commit -am "refactor: migrate to structured logger"');
    console.log('');
  }

  // Generate report
  generateReport(outputFile);

  // Exit with error code if there were errors
  if (stats.errorsEncountered > 0) {
    console.error(`\n⚠️  ${stats.errorsEncountered} error(s) encountered during processing.`);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main();
}

module.exports = {
  analyzeFile,
  transformFile,
  generateReplacement,
  findConsoleCalls,
  splitArguments,
};
