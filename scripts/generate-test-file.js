#!/usr/bin/env node

/**
 * Generate Large Test Files for Performance Testing
 *
 * This script generates test files with various line counts to test
 * large file performance optimizations in the Monaco editor.
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate a large test file with realistic TypeScript code
 * @param {number} lines - Number of lines to generate
 * @param {string} filename - Output filename
 * @param {string} language - Language type (typescript, javascript, text)
 */
function generateLargeFile(lines, filename, language = 'typescript') {
  console.log(`Generating ${filename} with ${lines} lines...`);

  const content = [];
  const startTime = Date.now();

  // Add file header
  content.push('/**');
  content.push(' * Large test file for performance testing');
  content.push(` * Generated with ${lines} lines`);
  content.push(` * Language: ${language}`);
  content.push(` * Generated: ${new Date().toISOString()}`);
  content.push(' */\n');

  if (language === 'typescript' || language === 'javascript') {
    // Generate realistic TypeScript/JavaScript code
    let functionCount = 0;
    let classCount = 0;

    for (let i = 0; i < lines; i++) {
      const lineType = i % 20;

      switch (lineType) {
        case 0:
          content.push(`// Line ${i}: Comment describing the code below`);
          break;

        case 1:
          content.push(`/**`);
          break;

        case 2:
          content.push(` * Function documentation for function${functionCount}`);
          break;

        case 3:
          content.push(` * @param param - The input parameter`);
          break;

        case 4:
          content.push(` * @returns The processed result`);
          break;

        case 5:
          content.push(` */`);
          break;

        case 6:
          functionCount++;
          content.push(`export function function${functionCount}(param: string): string {`);
          break;

        case 7:
          content.push(`  const variable${i} = 'value${i}';`);
          break;

        case 8:
          content.push(`  const number${i} = ${i};`);
          break;

        case 9:
          content.push(`  if (variable${i}.length > 0) {`);
          break;

        case 10:
          content.push(`    console.log('Processing line ${i}');`);
          break;

        case 11:
          content.push(`    const result = variable${i}.toUpperCase();`);
          break;

        case 12:
          content.push(`    return result;`);
          break;

        case 13:
          content.push('  }');
          break;

        case 14:
          content.push(`  return 'default${i}';`);
          break;

        case 15:
          content.push('}\n');
          break;

        case 16:
          classCount++;
          content.push(`export class Class${classCount} {`);
          break;

        case 17:
          content.push(`  private data: string;`);
          content.push(`  constructor(data: string) { this.data = data; }`);
          break;

        case 18:
          content.push(`  public getData(): string { return this.data; }`);
          break;

        case 19:
          content.push('}\n');
          break;

        default:
          content.push('');
      }
    }

    // Close any open blocks
    content.push('\n// End of file');

  } else if (language === 'json') {
    // Generate large JSON file
    content.push('{');
    content.push('  "data": [');

    for (let i = 0; i < lines; i++) {
      const comma = i < lines - 1 ? ',' : '';
      content.push(`    { "id": ${i}, "value": "item${i}", "index": ${i}, "timestamp": "${new Date().toISOString()}" }${comma}`);
    }

    content.push('  ]');
    content.push('}');

  } else {
    // Generate plain text
    for (let i = 0; i < lines; i++) {
      content.push(`Line ${i}: This is test content for performance testing. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`);
    }
  }

  // Write file
  const filePath = path.join(__dirname, '..', 'test-data', filename);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const fileContent = content.join('\n');
  fs.writeFileSync(filePath, fileContent);

  const elapsed = Date.now() - startTime;
  const sizeInBytes = Buffer.byteLength(fileContent, 'utf8');
  const sizeInMB = (sizeInBytes / 1024 / 1024).toFixed(2);

  console.log(`✓ Generated ${filename}`);
  console.log(`  - Lines: ${lines}`);
  console.log(`  - Size: ${sizeInMB} MB (${sizeInBytes.toLocaleString()} bytes)`);
  console.log(`  - Time: ${elapsed}ms`);
  console.log(`  - Path: ${filePath}\n`);

  return {
    filename,
    lines,
    sizeInBytes,
    sizeInMB,
    elapsed,
    path: filePath
  };
}

/**
 * Main function to generate all test files
 */
function main() {
  console.log('='.repeat(60));
  console.log('Large File Performance Test Data Generator');
  console.log('='.repeat(60));
  console.log('');

  const testFiles = [
    // Small files
    { lines: 1000, filename: 'small-file-1k.ts', language: 'typescript' },
    { lines: 2000, filename: 'small-file-2k.ts', language: 'typescript' },

    // Medium files
    { lines: 5000, filename: 'medium-file-5k.ts', language: 'typescript' },
    { lines: 7500, filename: 'medium-file-7.5k.ts', language: 'typescript' },

    // Large files
    { lines: 10000, filename: 'large-file-10k.ts', language: 'typescript' },
    { lines: 15000, filename: 'large-file-15k.ts', language: 'typescript' },

    // Very large files
    { lines: 20000, filename: 'very-large-file-20k.ts', language: 'typescript' },
    { lines: 30000, filename: 'very-large-file-30k.ts', language: 'typescript' },

    // Extreme files
    { lines: 50000, filename: 'extreme-file-50k.ts', language: 'typescript' },
    { lines: 75000, filename: 'extreme-file-75k.ts', language: 'typescript' },
    { lines: 100000, filename: 'extreme-file-100k.ts', language: 'typescript' },

    // Other formats
    { lines: 10000, filename: 'test-data-10k.json', language: 'json' },
    { lines: 50000, filename: 'test-data-50k.json', language: 'json' },
    { lines: 20000, filename: 'test-file-20k.txt', language: 'text' },
  ];

  const results = [];
  const totalStart = Date.now();

  for (const fileSpec of testFiles) {
    const result = generateLargeFile(fileSpec.lines, fileSpec.filename, fileSpec.language);
    results.push(result);
  }

  const totalElapsed = Date.now() - totalStart;
  const totalSize = results.reduce((sum, r) => sum + r.sizeInBytes, 0);
  const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total files generated: ${results.length}`);
  console.log(`Total size: ${totalSizeMB} MB (${totalSize.toLocaleString()} bytes)`);
  console.log(`Total time: ${totalElapsed}ms`);
  console.log('');
  console.log('Files by category:');
  console.log('  Small (< 5K lines): 2 files');
  console.log('  Medium (5K-10K lines): 2 files');
  console.log('  Large (10K-20K lines): 2 files');
  console.log('  Very Large (20K-50K lines): 2 files');
  console.log('  Extreme (50K+ lines): 3 files');
  console.log('  Other formats: 3 files');
  console.log('');
  console.log('✅ All test files generated successfully!');
  console.log('');
  console.log('Test files location: test-data/');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Load these files in the Monaco editor');
  console.log('  2. Verify load times meet acceptance criteria (< 2 seconds for 50K+ lines)');
  console.log('  3. Test UI responsiveness during editing');
  console.log('  4. Monitor memory usage (should stay < 4GB)');
  console.log('  5. Perform extended editing sessions (30+ minutes)');
  console.log('');
}

// Run main function
main();
