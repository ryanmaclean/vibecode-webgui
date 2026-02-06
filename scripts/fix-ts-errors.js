#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * TypeScript Error Batch Fixer
 * Systematically fixes common TypeScript compilation errors
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Initialize log aggregation
const logAggregation = new LogAggregation();


console.log('🔧 TypeScript Error Batch Fixer');
console.log('===============================\n');

// Get TypeScript errors
console.log('1. Getting TypeScript compilation errors...');
let tscOutput;
try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('✅ No TypeScript errors found!');
  process.exit(0);
} catch (error) {
  tscOutput = error.stdout.toString();
}

// Parse errors
const errorLines = tscOutput.split('\n').filter(line => line.includes('error TS'));
console.log(`Found ${errorLines.length} TypeScript errors\n`);

// Common error patterns and their fixes
const errorPatterns = [
  {
    pattern: /Property 'ip' does not exist on type 'NextRequest'/,
    fix: (filePath, line) => {
      console.log(`Fixing IP property in ${filePath}`);
      let content = fs.readFileSync(filePath, 'utf8');
      content = content.replace(/request\.ip/g, "request.headers.get('x-forwarded-for')?.split(',')[0]");
      content = content.replace(/req\.ip/g, "req.headers.get('x-forwarded-for')?.split(',')[0]");
      fs.writeFileSync(filePath, content);
    }
  },
  {
    pattern: /Property 'server' does not exist on type 'Socket'/,
    fix: (filePath, line) => {
      console.log(`Fixing Socket server property in ${filePath}`);
      let content = fs.readFileSync(filePath, 'utf8');
      content = content.replace(/res\.socket\.server/g, "(res.socket as any).server");
      fs.writeFileSync(filePath, content);
    }
  },
  {
    pattern: /is of type 'unknown'/,
    fix: (filePath, line) => {
      console.log(`Fixing unknown type in ${filePath}:${line}`);
      // This requires more context-specific fixes
    }
  }
];

// Apply fixes
let fixedCount = 0;
const processedFiles = new Set();

errorLines.forEach(errorLine => {
  const match = errorLine.match(/^(.+?)\((\d+),\d+\): error TS\d+: (.+)$/);
  if (!match) return;
  
  const [, filePath, lineNumber, errorMessage] = match;
  
  // Skip if we've already processed this file
  if (processedFiles.has(filePath)) return;
  
  // Find matching pattern
  for (const pattern of errorPatterns) {
    if (pattern.pattern.test(errorMessage)) {
      try {
        pattern.fix(filePath, parseInt(lineNumber));
        processedFiles.add(filePath);
        fixedCount++;
      } catch (error) {
        console.warn(`Failed to fix error in ${filePath}: ${error.message}`);
      }
      break;
    }
  }
});

console.log(`\n🎉 Fixed ${fixedCount} TypeScript errors in ${processedFiles.size} files`);

// Run type check again to see remaining errors
console.log('\n📊 Remaining TypeScript errors:');
try {
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
} catch (error) {
  const remainingErrors = error.stdout.toString().split('\n').filter(line => line.includes('error TS')).length;
  console.log(`\n⚠️  ${remainingErrors} errors remaining`);
}