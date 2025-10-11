#!/usr/bin/env node

/**
 * Automated Merge Conflict Resolution Script
 * Resolves merge conflicts systematically by choosing the more comprehensive version
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Priority order for conflict resolution
const PRIORITY_PATTERNS = [
  /src\/app\/api/,           // API routes first
  /src\/lib\/ai/,            // AI libraries
  /src\/lib\/db/,            // Database libraries
  /src\/lib\/cache/,         // Cache libraries
  /src\/lib\/vector-db/,     // Vector database libraries
  /src\/lib\/monitoring/,    // Monitoring libraries
  /src\/lib/,                // Other lib files
  /src\/components/,         // Components last
];

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
    return Array.from(files).sort((a, b) => {
      const aPriority = PRIORITY_PATTERNS.findIndex(pattern => pattern.test(a));
      const bPriority = PRIORITY_PATTERNS.findIndex(pattern => pattern.test(b));
      return aPriority - bPriority;
    });
  } catch (error) {
    console.log('No merge conflicts found or error occurred:', error.message);
    return [];
  }
}

function resolveConflict(content, filePath) {
  let resolved = content;
  let conflictCount = 0;
  let maxIterations = 10; // Prevent infinite loops
  
  while (maxIterations > 0) {
    maxIterations--;
    
    // Pattern to match merge conflict blocks - more flexible pattern
    const conflictPattern = /<<<<<<< (.*?)\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> (.*?)\n/g;
    
    const newResolved = resolved.replace(conflictPattern, (match, marker1, content1, content2, marker2) => {
      conflictCount++;
      
      // Strategy: Choose the more comprehensive version
      // If one version has more content or better structure, choose it
      const lines1 = content1.split('\n').filter(line => line.trim()).length;
      const lines2 = content2.split('\n').filter(line => line.trim()).length;
      
      // Prefer "Updated upstream" or "HEAD" versions
      if (marker1.includes('Updated upstream') || marker1.includes('HEAD')) {
        return content1;
      }
      if (marker2.includes('Updated upstream') || marker2.includes('HEAD')) {
        return content2;
      }
      
      // Choose the version with more content (likely more complete)
      if (lines1 > lines2) {
        return content1;
      } else if (lines2 > lines1) {
        return content2;
      }
      
      // If equal, prefer the first version
      return content1;
    });
    
    // If no changes were made, break
    if (newResolved === resolved) {
      break;
    }
    
    resolved = newResolved;
  }
  
  return { resolved, conflictCount };
}

function fixFile(filePath) {
  try {
    console.log(`Fixing: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf8');
    const { resolved, conflictCount } = resolveConflict(content, filePath);
    
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
  console.log('🔧 Automated Merge Conflict Resolution');
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
    remainingFiles.slice(0, 10).forEach(file => console.log(`    ${file}`));
    if (remainingFiles.length > 10) {
      console.log(`    ... and ${remainingFiles.length - 10} more`);
    }
  } else {
    console.log('\n✅ All merge conflicts resolved!');
  }
}

main();
