#!/usr/bin/env node

/**
 * Script to migrate console.log statements to structured logging
 * This script identifies console.log usage and provides suggestions for migration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories to scan (exclude certain directories)
const SCAN_DIRS = ['src/app/api', 'src/lib', 'src/components', 'src/hooks'];
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /coverage/,
  /\.test\./,
  /\.spec\./,
  /__tests__/,
  /\.config\./
];

// Console methods to replace
const CONSOLE_METHODS = ['log', 'error', 'warn', 'info', 'debug'];

class ConsoleLogMigrator {
  constructor() {
    this.results = {
      scannedFiles: 0,
      filesWithConsole: 0,
      totalConsoleStatements: 0,
      migrationSuggestions: []
    };
  }

  /**
   * Scan directory recursively for TypeScript/JavaScript files
   */
  scanDirectory(dir) {
    const files = [];
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip excluded patterns
        if (EXCLUDE_PATTERNS.some(pattern => pattern.test(fullPath))) {
          continue;
        }
        
        if (entry.isDirectory()) {
          files.push(...this.scanDirectory(fullPath));
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Could not scan directory ${dir}: ${error.message}`);
    }
    
    return files;
  }

  /**
   * Analyze file for console usage
   */
  analyzeFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const consoleUsages = [];
      
      lines.forEach((line, index) => {
        CONSOLE_METHODS.forEach(method => {
          const pattern = new RegExp(`console\\.${method}\\s*\\(`, 'g');
          const matches = [...line.matchAll(pattern)];
          
          matches.forEach(match => {
            consoleUsages.push({
              line: index + 1,
              method,
              content: line.trim(),
              suggestion: this.generateMigrationSuggestion(method, line.trim())
            });
          });
        });
      });
      
      return consoleUsages;
    } catch (error) {
      console.warn(`Could not analyze file ${filePath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate migration suggestion based on console method and context
   */
  generateMigrationSuggestion(method, line) {
    const suggestions = {
      log: 'logger.info',
      info: 'logger.info', 
      warn: 'logger.warn',
      error: 'logger.error',
      debug: 'logger.debug'
    };
    
    // Analyze context for better suggestions
    if (line.includes('error') || line.includes('Error') || line.includes('failed')) {
      return 'logger.error';
    } else if (line.includes('warn') || line.includes('Warning')) {
      return 'logger.warn';
    } else if (line.includes('debug') || line.includes('Debug')) {
      return 'logger.debug';
    }
    
    return suggestions[method] || 'logger.info';
  }

  /**
   * Run the migration analysis
   */
  run() {
    console.log('🔍 Scanning for console.log usage...\n');
    
    // Collect all files to scan
    const allFiles = [];
    SCAN_DIRS.forEach(dir => {
      if (fs.existsSync(dir)) {
        allFiles.push(...this.scanDirectory(dir));
      }
    });
    
    console.log(`📁 Found ${allFiles.length} files to analyze\n`);
    
    // Analyze each file
    allFiles.forEach(filePath => {
      this.results.scannedFiles++;
      const consoleUsages = this.analyzeFile(filePath);
      
      if (consoleUsages.length > 0) {
        this.results.filesWithConsole++;
        this.results.totalConsoleStatements += consoleUsages.length;
        
        this.results.migrationSuggestions.push({
          file: filePath,
          usages: consoleUsages
        });
      }
    });
    
    this.generateReport();
  }

  /**
   * Generate migration report
   */
  generateReport() {
    console.log('📊 CONSOLE.LOG MIGRATION ANALYSIS REPORT');
    console.log('=' .repeat(50));
    console.log(`Files scanned: ${this.results.scannedFiles}`);
    console.log(`Files with console statements: ${this.results.filesWithConsole}`);
    console.log(`Total console statements: ${this.results.totalConsoleStatements}\n`);
    
    if (this.results.migrationSuggestions.length === 0) {
      console.log('✅ No console statements found that need migration!');
      return;
    }
    
    console.log('🔧 MIGRATION SUGGESTIONS:');
    console.log('-'.repeat(30));
    
    this.results.migrationSuggestions.forEach(({ file, usages }) => {
      console.log(`\n📄 ${file}`);
      
      usages.forEach(({ line, method, content, suggestion }) => {
        console.log(`   Line ${line}: console.${method}(...)`);
        console.log(`   Current: ${content}`);
        console.log(`   Suggest: ${suggestion}(..., { logContext })`);
        console.log('');
      });
    });
    
    // Generate summary recommendations
    console.log('\n💡 MIGRATION RECOMMENDATIONS:');
    console.log('-'.repeat(30));
    console.log('1. Import the logger: import { logger } from "@/lib/logger"');
    console.log('2. Replace console.log with logger.info');
    console.log('3. Replace console.error with logger.error');
    console.log('4. Replace console.warn with logger.warn');
    console.log('5. Add context metadata for better debugging');
    console.log('\nExample:');
    console.log('  // Before:');
    console.log('  console.log("User created", userId);');
    console.log('  ');
    console.log('  // After:');
    console.log('  logger.info("User created", { userId, component: "user-service" });');
    
    // Generate fix script suggestions
    this.generateFixScript();
  }

  /**
   * Generate automated fix script suggestions
   */
  generateFixScript() {
    console.log('\n🛠️  AUTOMATED FIX SUGGESTIONS:');
    console.log('-'.repeat(30));
    
    const highPriorityFiles = this.results.migrationSuggestions
      .filter(({ usages }) => usages.length > 3)
      .map(({ file }) => file);
    
    if (highPriorityFiles.length > 0) {
      console.log('High priority files (>3 console statements):');
      highPriorityFiles.forEach(file => console.log(`  - ${file}`));
    }
    
    console.log('\nTo apply fixes automatically, consider:');
    console.log('1. Using ESLint auto-fix where possible');
    console.log('2. Manual migration for complex cases');
    console.log('3. Adding proper log context for API routes');
  }
}

// Run the migration analysis
if (require.main === module) {
  const migrator = new ConsoleLogMigrator();
  migrator.run();
}

module.exports = ConsoleLogMigrator;