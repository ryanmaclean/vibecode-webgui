#!/usr/bin/env node

/**
 * Console.log to Structured Logger Migration Tool
 *
 * This script helps migrate console.log statements to the Winston-based
 * structured logger. It can run in two modes:
 *
 * 1. Analyze mode (default): Scans files and reports findings
 * 2. Transform mode: Automatically replaces console.log with logger
 *
 * Usage:
 *   node scripts/migrate-to-logger.js [options] [files/directories...]
 *
 * Options:
 *   --dry-run, -d       Analyze without making changes (default)
 *   --transform, -t     Apply transformations to files
 *   --output, -o FILE   Write suggestions to file
 *   --help, -h          Show this help message
 *
 * Examples:
 *   # Analyze all source files
 *   node scripts/migrate-to-logger.js src/
 *
 *   # Transform specific files
 *   node scripts/migrate-to-logger.js -t src/lib/unified-ai-client.ts
 *
 *   # Generate report
 *   node scripts/migrate-to-logger.js -o migration-report.txt src/
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DEFAULT_PATHS = ['src/'];
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /coverage/,
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
];

// Console method patterns and their logger equivalents
const CONSOLE_PATTERNS = [
  {
    pattern: /console\.error\((.*?)\)/g,
    level: 'error',
    replacement: 'logger.error',
  },
  {
    pattern: /console\.warn\((.*?)\)/g,
    level: 'warn',
    replacement: 'logger.warn',
  },
  {
    pattern: /console\.info\((.*?)\)/g,
    level: 'info',
    replacement: 'logger.info',
  },
  {
    pattern: /console\.log\((.*?)\)/g,
    level: 'info',
    replacement: 'logger.info',
  },
  {
    pattern: /console\.debug\((.*?)\)/g,
    level: 'debug',
    replacement: 'logger.debug',
  },
];

// Statistics
const stats = {
  filesScanned: 0,
  filesWithConsole: 0,
  totalOccurrences: 0,
  byLevel: { error: 0, warn: 0, info: 0, debug: 0, log: 0 },
  filesTransformed: 0,
};

// Findings storage
const findings = [];

/**
 * Check if file should be excluded
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Get all files recursively
 */
function getAllFiles(dirPath, fileList = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);

    if (shouldExclude(filePath)) {
      return;
    }

    if (fs.statSync(filePath).isDirectory()) {
      fileList = getAllFiles(filePath, fileList);
    } else if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Analyze a single file for console statements
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileFindings = [];

  lines.forEach((line, lineIndex) => {
    // Skip commented lines
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }

    // Check for each console pattern
    CONSOLE_PATTERNS.forEach(({ pattern, level, replacement }) => {
      const regex = new RegExp(pattern);
      const matches = line.match(regex);

      if (matches) {
        matches.forEach(match => {
          const finding = {
            file: filePath,
            line: lineIndex + 1,
            original: match,
            suggested: generateReplacement(match, replacement),
            level,
            context: line.trim(),
          };

          fileFindings.push(finding);
          findings.push(finding);
          stats.totalOccurrences++;
          stats.byLevel[level === 'log' ? 'info' : level]++;
        });
      }
    });
  });

  stats.filesScanned++;
  if (fileFindings.length > 0) {
    stats.filesWithConsole++;
  }

  return fileFindings;
}

/**
 * Generate intelligent replacement based on context
 */
function generateReplacement(original, baseReplacement) {
  // Extract the arguments from console.log(...)
  const argsMatch = original.match(/console\.\w+\((.*)\)/);
  if (!argsMatch) return original;

  const args = argsMatch[1].trim();

  // Simple cases - just string or variable
  if (args.startsWith("'") || args.startsWith('"') || args.startsWith('`')) {
    return `${baseReplacement}(${args})`;
  }

  // Multiple arguments - convert to message + metadata
  const argsList = splitArguments(args);

  if (argsList.length === 1) {
    return `${baseReplacement}(${argsList[0]})`;
  }

  // First arg as message, rest as metadata
  const message = argsList[0];
  const metadata = argsList.slice(1);

  // Try to create structured metadata
  if (metadata.length === 1 && !metadata[0].includes('"') && !metadata[0].includes("'")) {
    // Single object/variable as metadata
    return `${baseReplacement}(${message}, { data: ${metadata[0]} })`;
  } else {
    // Multiple values - create metadata object
    const metadataObj = metadata.map((m, i) => `arg${i + 1}: ${m}`).join(', ');
    return `${baseReplacement}(${message}, { ${metadataObj} })`;
  }
}

/**
 * Split arguments respecting nested structures
 */
function splitArguments(argsStr) {
  const args = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    const prev = argsStr[i - 1];

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

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if logger import already exists
  const hasLoggerImport = content.includes("from '@/lib/logger'") ||
                         content.includes('from "../lib/logger"') ||
                         content.includes('from "../../lib/logger"') ||
                         content.includes('from "../../../lib/logger"');

  // Add logger import if needed
  if (!hasLoggerImport) {
    // Calculate relative path to logger
    const relativePath = calculateRelativeImport(filePath);
    const importStatement = `import { logger } from '${relativePath}';\n`;

    // Find appropriate place to add import (after other imports)
    const lines = content.split('\n');
    let importIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        importIndex = i + 1;
      } else if (importIndex > 0 && lines[i].trim() === '') {
        break;
      }
    }

    lines.splice(importIndex, 0, importStatement);
    content = lines.join('\n');
    modified = true;
  }

  // Replace console statements
  fileFindings.forEach(finding => {
    content = content.replace(finding.original, finding.suggested);
    modified = true;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    stats.filesTransformed++;
  }

  return modified;
}

/**
 * Calculate relative import path to logger
 */
function calculateRelativeImport(filePath) {
  const fileDir = path.dirname(filePath);
  const libPath = path.join(process.cwd(), 'src', 'lib');
  const relativePath = path.relative(fileDir, libPath);

  return relativePath === '' ? './lib/logger' : `${relativePath}/logger`.replace(/\\/g, '/');
}

/**
 * Generate report
 */
function generateReport(output) {
  const report = [];

  report.push('='.repeat(80));
  report.push('Console.log to Logger Migration Report');
  report.push('='.repeat(80));
  report.push('');
  report.push('Summary:');
  report.push(`  Files scanned:        ${stats.filesScanned}`);
  report.push(`  Files with console:   ${stats.filesWithConsole}`);
  report.push(`  Total occurrences:    ${stats.totalOccurrences}`);
  report.push('');
  report.push('By Level:');
  report.push(`  console.error():      ${stats.byLevel.error}`);
  report.push(`  console.warn():       ${stats.byLevel.warn}`);
  report.push(`  console.info():       ${stats.byLevel.info}`);
  report.push(`  console.log():        ${stats.byLevel.info - stats.byLevel.error - stats.byLevel.warn}`);
  report.push(`  console.debug():      ${stats.byLevel.debug}`);
  report.push('');
  report.push('='.repeat(80));
  report.push('Detailed Findings:');
  report.push('='.repeat(80));
  report.push('');

  // Group by file
  const byFile = {};
  findings.forEach(f => {
    if (!byFile[f.file]) byFile[f.file] = [];
    byFile[f.file].push(f);
  });

  Object.entries(byFile).forEach(([file, fileFindings]) => {
    report.push(`File: ${file} (${fileFindings.length} occurrences)`);
    report.push('-'.repeat(80));

    fileFindings.forEach(f => {
      report.push(`  Line ${f.line}: ${f.level.toUpperCase()}`);
      report.push(`    Original:  ${f.original}`);
      report.push(`    Suggested: ${f.suggested}`);
      report.push(`    Context:   ${f.context}`);
      report.push('');
    });

    report.push('');
  });

  report.push('='.repeat(80));
  report.push('Migration Strategy:');
  report.push('='.repeat(80));
  report.push('');
  report.push('Recommended approach:');
  report.push('');
  report.push('1. File-by-file migration (safest):');
  report.push('   node scripts/migrate-to-logger.js -t src/lib/unified-ai-client.ts');
  report.push('   # Test the file');
  report.push('   # Commit if working');
  report.push('');
  report.push('2. Directory-by-directory:');
  report.push('   node scripts/migrate-to-logger.js -t src/lib/');
  report.push('   # Test thoroughly');
  report.push('   # Commit if working');
  report.push('');
  report.push('3. Batch migration (requires extensive testing):');
  report.push('   node scripts/migrate-to-logger.js -t src/');
  report.push('   npm run test');
  report.push('   npm run lint');
  report.push('');
  report.push('Note: Always review changes before committing!');
  report.push('');

  const reportText = report.join('\n');

  if (output) {
    fs.writeFileSync(output, reportText);
    console.log(`\nReport written to: ${output}`);
  } else {
    console.log(reportText);
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

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace('/**', '').trim());
      process.exit(0);
    } else if (arg === '--transform' || arg === '-t') {
      mode = 'transform';
    } else if (arg === '--dry-run' || arg === '-d') {
      mode = 'analyze';
    } else if (arg === '--output' || arg === '-o') {
      outputFile = args[++i];
    } else if (!arg.startsWith('-')) {
      paths.push(arg);
    }
  }

  // Use default paths if none provided
  if (paths.length === 0) {
    paths = DEFAULT_PATHS;
  }

  console.log('Console.log to Logger Migration Tool');
  console.log('=====================================');
  console.log(`Mode: ${mode === 'transform' ? 'TRANSFORM' : 'ANALYZE (dry-run)'}`);
  console.log(`Paths: ${paths.join(', ')}`);
  console.log('');

  // Collect all files
  const allFiles = [];
  paths.forEach(p => {
    const fullPath = path.resolve(p);

    if (!fs.existsSync(fullPath)) {
      console.error(`Error: Path does not exist: ${fullPath}`);
      process.exit(1);
    }

    if (fs.statSync(fullPath).isDirectory()) {
      allFiles.push(...getAllFiles(fullPath));
    } else {
      allFiles.push(fullPath);
    }
  });

  console.log(`Found ${allFiles.length} files to analyze\n`);

  // Analyze all files
  allFiles.forEach(file => {
    const fileFindings = analyzeFile(file);

    if (fileFindings.length > 0) {
      console.log(`✓ ${file} (${fileFindings.length} occurrences)`);

      // Transform if in transform mode
      if (mode === 'transform') {
        transformFile(file, fileFindings);
      }
    }
  });

  console.log('');

  if (mode === 'transform') {
    console.log(`Transformation complete!`);
    console.log(`Files modified: ${stats.filesTransformed}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Review changes: git diff');
    console.log('2. Run tests: npm test');
    console.log('3. Run lint: npm run lint');
    console.log('4. Commit if everything passes');
    console.log('');
  }

  // Generate report
  generateReport(outputFile);
}

// Run
if (require.main === module) {
  main();
}
