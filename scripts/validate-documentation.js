#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");

/**
 * Documentation Validation Script
 * Validates documentation structure, links, and completeness
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

// Initialize log aggregation
const logAggregation = new LogAggregation();


class DocumentationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.linkFailures = [];
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

    const requiredResources = [
      {
        label: 'Project README',
        paths: ['README.md']
      },
      {
        label: 'Documentation index',
        paths: [
          'docs/DOCUMENTATION_INDEX.md',
          'content/wiki/DOCUMENTATION_INDEX.md',
          'archive/consolidated-wiki/DOCUMENTATION_INDEX.md'
        ]
      },
      {
        label: 'Consolidated documentation overview',
        paths: [
          'docs/CONSOLIDATED_DOCUMENTATION.md',
          'docs/src/content/docs/wiki-archive/CONSOLIDATED_DOCUMENTATION.md',
          'archive/consolidated-wiki/CONSOLIDATED_DOCUMENTATION.md'
        ]
      },
      {
        label: 'Datadog monitoring guide',
        paths: [
          'docs/DATADOG_MONITORING.md',
          'docs/datadog/monitoring.md',
          'content/wiki/monitoring/DATADOG_MONITORING.md',
          'archive/consolidated-wiki/monitoring/DATADOG_MONITORING.md'
        ]
      },
      {
        label: 'OpenTelemetry integration guide',
        paths: [
          'docs/OPENTELEMETRY_INTEGRATION.md',
          'docs/monitoring/OPENTELEMETRY_INTEGRATION.md',
          'content/wiki/monitoring/OPENTELEMETRY_INTEGRATION.md',
          'archive/consolidated-wiki/monitoring/OPENTELEMETRY_INTEGRATION.md'
        ]
      },
      {
        label: 'Contributing guide',
        paths: ['CONTRIBUTING.md']
      },
      {
        label: 'Code of conduct',
        paths: [
          'CODE_OF_CONDUCT.md',
          'docs/CODE_OF_CONDUCT.md',
          'content/wiki/CODE_OF_CONDUCT.md',
          'archive/consolidated-wiki/CODE_OF_CONDUCT.md'
        ]
      }
    ];

    for (const resource of requiredResources) {
      const existingPath = await this.findExistingPath(resource.paths);
      if (existingPath) {
        console.log(`  ✅ ${resource.label} (${existingPath})`);
        continue;
      }

      this.errors.push(
        `Missing required ${resource.label} (checked: ${resource.paths.join(', ')})`
      );
      this.stats.missingFiles++;
      console.log(`  ❌ ${resource.label} - Missing`);
    }
  }

  async findExistingPath(candidatePaths) {
    for (const relativePath of candidatePaths) {
      if (await this.fileExists(relativePath)) {
        return relativePath;
      }
    }
    return null;
  }

  async fileExists(relativePath) {
    const absolutePath = path.join(process.cwd(), relativePath);
    try {
      await fs.access(absolutePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async validateLinks() {
    console.log('\n🔗 Validating documentation links...');

    const linkPatterns = [
      'docs/src/content/docs/**/*.md',
      'README.md',
      'CONTRIBUTING.md'
    ];

    const linkIgnore = [
      'node_modules/**',
      'docs/node_modules/**',
      'services/**/node_modules/**',
      'extensions/**/node_modules/**',
      '.git/**',
      'docs/dist/**',
      'docs/reports/**',
      'docs/src/content/docs/wiki-archive/**',
      'docs/src/content/docs/**/conflict-backup-*'
    ];

    const mdFiles = Array.from(new Set(linkPatterns.flatMap(pattern => 
      glob.sync(pattern, { ignore: linkIgnore })
    )));

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
    const sanitizedUrl = linkUrl.split('#')[0].split('?')[0].trim();

    if (
      !sanitizedUrl ||
      sanitizedUrl.startsWith('javascript:') ||
      sanitizedUrl.includes('${')
    ) {
      return;
    }

    const candidatePaths = this.generateCandidatePaths(sourceFile, sanitizedUrl);

    for (const candidate of candidatePaths) {
      if (await this.fileExists(candidate)) {
        return;
      }
    }

    const message = `Broken link in ${sourceFile}: "${linkText}" -> ${linkUrl}`;
    this.linkFailures.push(message);
    this.stats.brokenLinks++;
  }

  generateCandidatePaths(sourceFile, linkUrl) {
    const candidates = new Set();
    const repoRoot = process.cwd();
    const docsRoot = path.resolve(repoRoot, 'docs/src/content/docs');
    const normalizedUrl = linkUrl.replace(/\\/g, '/');
    const sourceDir = path.dirname(sourceFile);

    const addVariants = (relativePath) => {
      if (!relativePath) {
        return;
      }

      let normalized = relativePath.replace(/\\/g, '/');
      normalized = normalized.replace(/^\.\/+/, '');
      if (!normalized) {
        return;
      }

      const withoutTrailingSlash = normalized.replace(/\/+$/, '');
      const basePath = withoutTrailingSlash || normalized;

      candidates.add(basePath);

      if (!basePath.endsWith('.md')) {
        candidates.add(`${basePath}.md`);
        candidates.add(`${basePath}/index.md`);
      }
    };

    const addAbsoluteCandidate = (absolutePath) => {
      const relative = path.relative(repoRoot, absolutePath);
      addVariants(relative);
    };

    if (normalizedUrl.startsWith('/')) {
      const trimmed = normalizedUrl.replace(/^\/+/, '');
      addAbsoluteCandidate(path.join(docsRoot, trimmed));
    } else {
      addAbsoluteCandidate(path.resolve(repoRoot, sourceDir, normalizedUrl));
      addAbsoluteCandidate(path.resolve(docsRoot, normalizedUrl));
      addAbsoluteCandidate(path.resolve(repoRoot, normalizedUrl));
    }

    addVariants(normalizedUrl);

    return Array.from(candidates).filter(Boolean);
  }

  async validateContent() {
    console.log('\n📖 Validating content quality...');

    const criticalResources = [
      {
        label: 'README',
        paths: ['README.md']
      },
      {
        label: 'Consolidated documentation overview',
        paths: [
          'docs/CONSOLIDATED_DOCUMENTATION.md',
          'docs/src/content/docs/wiki-archive/CONSOLIDATED_DOCUMENTATION.md',
          'archive/consolidated-wiki/CONSOLIDATED_DOCUMENTATION.md'
        ]
      },
      {
        label: 'Datadog monitoring guide',
        paths: [
          'docs/DATADOG_MONITORING.md',
          'docs/datadog/monitoring.md',
          'content/wiki/monitoring/DATADOG_MONITORING.md',
          'archive/consolidated-wiki/monitoring/DATADOG_MONITORING.md'
        ]
      },
      {
        label: 'OpenTelemetry integration guide',
        paths: [
          'docs/OPENTELEMETRY_INTEGRATION.md',
          'docs/monitoring/OPENTELEMETRY_INTEGRATION.md',
          'content/wiki/monitoring/OPENTELEMETRY_INTEGRATION.md',
          'archive/consolidated-wiki/monitoring/OPENTELEMETRY_INTEGRATION.md'
        ]
      }
    ];

    for (const resource of criticalResources) {
      const existingPath = await this.findExistingPath(resource.paths);
      if (!existingPath) {
        this.errors.push(
          `Missing critical documentation file for ${resource.label} (checked: ${resource.paths.join(', ')})`
        );
        this.stats.missingFiles++;
        console.log(`  ❌ ${resource.label} - Missing`);
        continue;
      }

      await this.validateFileContent(existingPath);
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

    if (this.errors.length > 0) {
      console.log('❌ Errors:');
      this.errors.forEach(error => console.log(`  • ${error}`));
      console.log();
    }

    if (this.linkFailures.length > 0) {
      console.log('❌ Broken Links:');
      this.linkFailures.forEach(failure => console.log(`  • ${failure}`));
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

    const hasCriticalErrors = this.errors.length > 0;
    const hasBrokenLinks = this.linkFailures.length > 0;

    if (hasCriticalErrors) {
      console.log('\n❌ Documentation validation failed due to errors');
      process.exit(1);
    }

    if (hasBrokenLinks) {
      console.log('\n❌ Documentation validation failed due to broken links');
      process.exit(2);
    }

    console.log('\n✅ Documentation validation completed successfully');
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
