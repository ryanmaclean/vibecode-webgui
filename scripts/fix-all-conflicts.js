#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * Aggressive Merge Conflict Resolution Script
 * Resolves ALL remaining conflicts by choosing "Updated upstream" version
 */

import fs from 'fs';
import { execSync } from 'child_process';

function findConflictedFiles() {
  try {
    const result = execSync('grep -r "<<<<<<<" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"', { encoding: 'utf8' });
    const files = new Set();
    result.split('\n').forEach(line => {
      if (line.includes(':')) {
        const filePath = line.split(':')[0];
        if (filePath) files.add(filePath);
      }
    });
    return Array.from(files);
  } catch (error) {
    console.log('No merge conflicts found or error occurred:', error.message);
    return [];
  }
}

function resolveAllConflicts(content) {
  let resolved = content;
  let conflictCount = 0;
  
  // Pattern to match merge conflict blocks - more flexible pattern
  const conflictPattern = /<<<<<<< (.*?)\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> (.*?)\n/g;
  
  resolved = resolved.replace(conflictPattern, (match, marker1, content1, content2, marker2) => {
    conflictCount++;
    
    // Always choose "Updated upstream" or "HEAD" version
    if (marker1.includes('Updated upstream') || marker1.includes('HEAD')) {
      return content1;
    }
    if (marker2.includes('Updated upstream') || marker2.includes('HEAD')) {
      return content2;
    }
    
    // If neither has "Updated upstream", choose the first version
    return content1;
  });
  
  return { resolved, conflictCount };
}

function fixFile(filePath) {
  try {
    console.log(`Fixing: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    const { resolved, conflictCount } = resolveAllConflicts(content);
    
    if (conflictCount > 0) {
      fs.writeFileSync(filePath, resolved);
      console.log(`  ✓ Resolved ${conflictCount} conflicts`);
      return conflictCount;
    } else {
      console.log(`  - No conflicts found`);
      return 0;
    }
  } catch (error) {
    console.error(`  ✗ Error fixing ${filePath}:`, error.message);
    return 0;
  }
}

function main() {
  console.log('🔧 AGGRESSIVE Merge Conflict Resolution');
  console.log('=====================================\n');
  
  const conflictedFiles = findConflictedFiles();
  console.log(`Found ${conflictedFiles.length} files with merge conflicts\n`);
  
  if (conflictedFiles.length === 0) {
    console.log('✅ No merge conflicts found!');
    return;
  }
  
  let totalConflicts = 0;
  let filesFixed = 0;
  
  for (const filePath of conflictedFiles) {
    const conflicts = fixFile(filePath);
    if (conflicts > 0) {
      totalConflicts += conflicts;
      filesFixed++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`  Files processed: ${conflictedFiles.length}`);
  console.log(`  Files fixed: ${filesFixed}`);
  console.log(`  Total conflicts resolved: ${totalConflicts}`);
  
  // Check if any conflicts remain
  const remainingFiles = findConflictedFiles();
  if (remainingFiles.length > 0) {
    console.log(`\n⚠️  ${remainingFiles.length} files still have conflicts:`);
    remainingFiles.forEach(file => console.log(`    ${file}`));
  } else {
    console.log('\n✅ All merge conflicts resolved!');
  }
}

main();
