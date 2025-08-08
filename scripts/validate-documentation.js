#!/usr/bin/env node
/**
 * Documentation Validation Script
 * Validates documentation structure, links, and completeness
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

class DocumentationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.stats = {
      totalFiles: 0,
      brokenLinks: 0,
      missingFiles: 0,
      outdatedFiles: 0
    };
  }

  async run() {
    console.log('🔍 Validating VibeCode documentation...\n');

    try {
      await this.validateStructure();
      await this.validateLinks();
      await this.validateContent();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Documentation validation failed:', error);
      process.exit(1);
    }
  }

  async validateStructure() {
    console.log('📁 Validating documentation structure...');
    
    const requiredFiles = [
      'README.md',
      'docs/DOCUMENTATION_INDEX.md',
      'docs/CONSOLIDATED_DOCUMENTATION.md',
      'docs/DATADOG_MONITORING.md',
      'docs/OPENTELEMETRY_INTEGRATION.md',
      'CONTRIBUTING.md',
      'CODE_OF_CONDUCT.md'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(process.cwd(), file);
      try {
        await fs.access(filePath);
        console.log(`  ✅ ${file}`);
      } catch (error) {
        this.errors.push(`Missing required file: ${file}`);
        this.stats.missingFiles++;
        console.log(`  ❌ ${file} - Missing`);
      }
    }
  }

  async validateLinks() {
    console.log('\n🔗 Validating documentation links...');
    
    const mdFiles = glob.sync('**/*.md', {
      ignore: [
        'node_modules/**', 
        'docs/node_modules/**', 
        'services/**/node_modules/**',
        'extensions/**/node_modules/**',
        '.git/**',
        'docs/dist/**'
      ]
    });

    this.stats.totalFiles = mdFiles.length;

    for (const file of mdFiles) {
      await this.validateFileLinks(file);
    }
  }

  async validateFileLinks(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;

      while ((match = linkRegex.exec(content)) !== null) {
        const [fullMatch, linkText, linkUrl] = match;
        
        // Skip external URLs and anchors
        if (linkUrl.startsWith('http') || linkUrl.startsWith('#') || linkUrl.startsWith('mailto:')) {
          continue;
        }

        await this.validateLocalLink(filePath, linkUrl, linkText);
      }
    } catch (error) {
      this.errors.push(`Failed to read ${filePath}: ${error.message}`);
    }
  }

  async validateLocalLink(sourceFile, linkUrl, linkText) {
    // Resolve relative path from source file
    const sourceDir = path.dirname(sourceFile);
    const targetPath = path.resolve(sourceDir, linkUrl);
    
    try {
      await fs.access(targetPath);
    } catch (error) {
      this.errors.push(`Broken link in ${sourceFile}: "${linkText}" -> ${linkUrl}`);
      this.stats.brokenLinks++;
    }
  }

  async validateContent() {
    console.log('\n📖 Validating content quality...');
    
    const criticalFiles = [
      'README.md',
      'docs/CONSOLIDATED_DOCUMENTATION.md',
      'docs/DATADOG_MONITORING.md',
      'docs/OPENTELEMETRY_INTEGRATION.md'
    ];

    for (const file of criticalFiles) {
      await this.validateFileContent(file);
    }
  }

  async validateFileContent(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Check for basic content requirements
      const hasTitle = lines.some(line => line.startsWith('# '));
      if (!hasTitle) {
        this.warnings.push(`${filePath}: Missing main title (h1)`);
      }

      // Check for table of contents in long documents
      if (lines.length > 100) {
        const hasToC = content.toLowerCase().includes('table of contents') || 
                       content.includes('## 📋');
        if (!hasToC) {
          this.warnings.push(`${filePath}: Long document missing table of contents`);
        }
      }

      // Check for code examples in technical docs
      if (filePath.includes('MONITORING') || filePath.includes('INTEGRATION')) {
        const hasCodeBlocks = content.includes('```');
        if (!hasCodeBlocks) {
          this.warnings.push(`${filePath}: Technical document missing code examples`);
        }
      }

      // Check for last updated information
      if (!content.includes('Last updated') && !content.includes('Updated:')) {
        this.warnings.push(`${filePath}: Missing last updated information`);
      }

      console.log(`  ✅ ${filePath} - Content validated`);
      
    } catch (error) {
      this.errors.push(`Failed to validate content of ${filePath}: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('\n📊 Documentation Validation Report');
    console.log('================================\n');

    // Statistics
    console.log('📈 Statistics:');
    console.log(`  Total files checked: ${this.stats.totalFiles}`);
    console.log(`  Missing files: ${this.stats.missingFiles}`);
    console.log(`  Broken links: ${this.stats.brokenLinks}`);
    console.log(`  Errors: ${this.errors.length}`);
    console.log(`  Warnings: ${this.warnings.length}\n`);

    // Errors
    if (this.errors.length > 0) {
      console.log('❌ Errors:');
      this.errors.forEach(error => console.log(`  • ${error}`));
      console.log();
    }

    // Warnings
    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`  • ${warning}`));
      console.log();
    }

    // Recommendations
    console.log('💡 Recommendations:');
    console.log('  • Run this script before committing documentation changes');
    console.log('  • Update "Last updated" dates when modifying files');
    console.log('  • Add code examples to technical documentation');
    console.log('  • Include table of contents in long documents');
    console.log('  • Use consistent markdown formatting\n');

    // Documentation health score
    const totalIssues = this.errors.length + this.warnings.length;
    const healthScore = Math.max(0, 100 - (totalIssues * 5));
    
    console.log(`🏥 Documentation Health Score: ${healthScore}/100`);
    
    if (healthScore >= 90) {
      console.log('✅ Excellent documentation quality!');
    } else if (healthScore >= 75) {
      console.log('✅ Good documentation quality');
    } else if (healthScore >= 60) {
      console.log('⚠️  Documentation needs improvement');
    } else {
      console.log('❌ Documentation requires significant attention');
    }

    // Generate suggestions for improvement
    if (this.stats.brokenLinks > 0) {
      console.log('\n🔧 Fix broken links with:');
      console.log('  • Check file paths are correct');
      console.log('  • Update moved or renamed files');
      console.log('  • Use relative paths for internal links');
    }

    if (this.stats.missingFiles > 0) {
      console.log('\n📁 Create missing files:');
      console.log('  • Follow the documentation structure in DOCUMENTATION_INDEX.md');
      console.log('  • Use templates from existing documentation');
      console.log('  • Include proper headers and navigation');
    }

    // Exit with error if critical issues found
    if (this.errors.length > 0) {
      console.log('\n❌ Documentation validation failed due to errors');
      process.exit(1);
    } else {
      console.log('\n✅ Documentation validation completed successfully');
    }
  }
}

// Generate documentation statistics
async function generateStats() {
  const mdFiles = glob.sync('**/*.md', {
    ignore: [
      'node_modules/**', 
      'docs/node_modules/**', 
      'services/**/node_modules/**',
      'extensions/**/node_modules/**',
      '.git/**',
      'docs/dist/**'
    ]
  });

  let totalLines = 0;
  let totalWords = 0;
  const fileStats = [];

  for (const file of mdFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n').length;
      const words = content.split(/\s+/).length;
      
      totalLines += lines;
      totalWords += words;
      
      fileStats.push({
        file,
        lines,
        words,
        size: (await fs.stat(file)).size
      });
    } catch (error) {
      console.warn(`Could not read ${file}: ${error.message}`);
    }
  }

  return {
    totalFiles: mdFiles.length,
    totalLines,
    totalWords,
    averageLines: Math.round(totalLines / mdFiles.length),
    averageWords: Math.round(totalWords / mdFiles.length),
    largestFile: fileStats.reduce((max, file) => file.lines > max.lines ? file : max, fileStats[0]),
    fileStats
  };
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  if (command === 'stats') {
    console.log('📊 Generating documentation statistics...\n');
    const stats = await generateStats();
    
    console.log('📈 Documentation Statistics:');
    console.log(`  Total files: ${stats.totalFiles}`);
    console.log(`  Total lines: ${stats.totalLines.toLocaleString()}`);
    console.log(`  Total words: ${stats.totalWords.toLocaleString()}`);
    console.log(`  Average lines per file: ${stats.averageLines}`);
    console.log(`  Average words per file: ${stats.averageWords}`);
    console.log(`  Largest file: ${stats.largestFile.file} (${stats.largestFile.lines} lines)`);
    
    return;
  }
  
  const validator = new DocumentationValidator();
  await validator.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DocumentationValidator, generateStats };