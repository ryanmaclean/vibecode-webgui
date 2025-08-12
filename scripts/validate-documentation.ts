#!/usr/bin/env npx tsx

/**
 * Documentation Validation and Code Example Testing
 * Ensures documentation stays current with code changes
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { execSync } from 'child_process';

interface ValidationResult {
  file: string;
  issues: Issue[];
  stats: FileStats;
}

interface Issue {
  type: 'error' | 'warning' | 'info';
  line?: number;
  message: string;
  suggestion?: string;
}

interface FileStats {
  codeBlocks: number;
  validCodeBlocks: number;
  brokenLinks: number;
  outdatedExamples: number;
}

class DocumentationValidator {
  private results: ValidationResult[] = [];
  private packageJson: any;

  async validate() {
    console.log('📖 Starting documentation validation...');
    
    // Load package.json for script validation
    this.packageJson = JSON.parse(
      await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
    );

    // Find all documentation files
    const docFiles = await glob('**/*.md', {
      cwd: process.cwd(),
      ignore: ['node_modules/**', '**/node_modules/**', 'dist/**', 'build/**']
    });

    console.log(`🔍 Found ${docFiles.length} documentation files`);

    for (const file of docFiles) {
      try {
        await this.validateFile(file);
      } catch (error) {
        console.warn(`⚠️ Failed to validate ${file}:`, error.message);
      }
    }

    await this.generateReport();
  }

  private async validateFile(filePath: string) {
    const content = await fs.readFile(filePath, 'utf-8');
    const issues: Issue[] = [];
    const stats: FileStats = {
      codeBlocks: 0,
      validCodeBlocks: 0,
      brokenLinks: 0,
      outdatedExamples: 0
    };

    // Validate code blocks
    await this.validateCodeBlocks(content, filePath, issues, stats);
    
    // Validate links
    await this.validateLinks(content, filePath, issues, stats);
    
    // Validate npm scripts
    await this.validateNpmScripts(content, filePath, issues, stats);
    
    // Check for outdated information
    await this.checkOutdatedInfo(content, filePath, issues, stats);

    this.results.push({
      file: filePath,
      issues,
      stats
    });

    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;
    
    if (errorCount > 0 || warningCount > 0) {
      console.log(`📄 ${filePath}: ${errorCount} errors, ${warningCount} warnings`);
    }
  }

  private async validateCodeBlocks(
    content: string, 
    filePath: string, 
    issues: Issue[], 
    stats: FileStats
  ) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      stats.codeBlocks++;
      const language = match[1];
      const code = match[2].trim();
      const lineNumber = content.substring(0, match.index).split('\n').length;

      if (!language) {
        issues.push({
          type: 'warning',
          line: lineNumber,
          message: 'Code block missing language specification',
          suggestion: 'Add language identifier (e.g., ```typescript, ```bash)'
        });
        continue;
      }

      try {
        await this.validateCodeBlock(language, code, issues, lineNumber);
        stats.validCodeBlocks++;
      } catch (error) {
        issues.push({
          type: 'error',
          line: lineNumber,
          message: `Invalid ${language} code: ${error.message}`,
          suggestion: 'Check syntax and ensure code compiles'
        });
      }
    }
  }

  private async validateCodeBlock(
    language: string, 
    code: string, 
    issues: Issue[], 
    lineNumber: number
  ) {
    switch (language) {
      case 'typescript':
      case 'ts':
        await this.validateTypeScript(code, issues, lineNumber);
        break;
      
      case 'bash':
      case 'sh':
        await this.validateBashCommands(code, issues, lineNumber);
        break;
      
      case 'json':
        this.validateJSON(code, issues, lineNumber);
        break;
      
      case 'javascript':
      case 'js':
        await this.validateJavaScript(code, issues, lineNumber);
        break;
    }
  }

  private async validateTypeScript(code: string, issues: Issue[], lineNumber: number) {
    // Check for common TypeScript syntax issues
    if (code.includes('import') && !code.includes('from')) {
      issues.push({
        type: 'warning',
        line: lineNumber,
        message: 'Incomplete import statement',
        suggestion: 'Ensure import statements include "from" clause'
      });
    }

    // Check for proper typing
    if (code.includes(': any') && !code.includes('// TODO:')) {
      issues.push({
        type: 'warning',
        line: lineNumber,
        message: 'Use of "any" type detected',
        suggestion: 'Consider using specific types instead of "any"'
      });
    }

    // Validate against actual imports in codebase
    const imports = code.match(/import.*from\s+['"`]([^'"`]+)['"`]/g);
    if (imports) {
      for (const importStatement of imports) {
        const modulePath = importStatement.match(/from\s+['"`]([^'"`]+)['"`]/)?.[1];
        if (modulePath?.startsWith('../') || modulePath?.startsWith('./')) {
          await this.validateLocalImport(modulePath, issues, lineNumber);
        }
      }
    }
  }

  private async validateLocalImport(importPath: string, issues: Issue[], lineNumber: number) {
    try {
      // Resolve relative path
      const fullPath = path.resolve(process.cwd(), 'src', importPath);
      const possibleFiles = [
        `${fullPath}.ts`,
        `${fullPath}.tsx`,
        `${fullPath}/index.ts`,
        `${fullPath}/index.tsx`
      ];

      const exists = await Promise.all(
        possibleFiles.map(async file => {
          try {
            await fs.access(file);
            return true;
          } catch {
            return false;
          }
        })
      );

      if (!exists.some(Boolean)) {
        issues.push({
          type: 'error',
          line: lineNumber,
          message: `Import path "${importPath}" not found`,
          suggestion: 'Verify the import path exists in the codebase'
        });
      }
    } catch (error) {
      // Ignore validation errors for complex paths
    }
  }

  private async validateBashCommands(code: string, issues: Issue[], lineNumber: number) {
    const commands = code.split('\n').filter(line => 
      line.trim() && 
      !line.trim().startsWith('#') &&
      !line.trim().startsWith('//') &&
      !line.trim().startsWith('echo')
    );

    for (const command of commands) {
      const cmd = command.trim();
      
      // Check for npm scripts
      if (cmd.startsWith('npm run ')) {
        const scriptName = cmd.replace('npm run ', '').split(' ')[0];
        if (!this.packageJson.scripts?.[scriptName]) {
          issues.push({
            type: 'error',
            line: lineNumber,
            message: `npm script "${scriptName}" not found in package.json`,
            suggestion: 'Add the script to package.json or update documentation'
          });
        }
      }

      // Check for dangerous commands
      if (cmd.includes('rm -rf') && !cmd.includes('node_modules')) {
        issues.push({
          type: 'warning',
          line: lineNumber,
          message: 'Potentially dangerous rm -rf command',
          suggestion: 'Review command for safety'
        });
      }
    }
  }

  private validateJSON(code: string, issues: Issue[], lineNumber: number) {
    try {
      JSON.parse(code);
    } catch (error) {
      issues.push({
        type: 'error',
        line: lineNumber,
        message: `Invalid JSON: ${error.message}`,
        suggestion: 'Fix JSON syntax errors'
      });
    }
  }

  private async validateJavaScript(code: string, issues: Issue[], lineNumber: number) {
    // Basic JavaScript validation
    if (code.includes('var ')) {
      issues.push({
        type: 'warning',
        line: lineNumber,
        message: 'Use of "var" keyword',
        suggestion: 'Consider using "const" or "let" instead'
      });
    }
  }

  private async validateLinks(
    content: string, 
    filePath: string, 
    issues: Issue[], 
    stats: FileStats
  ) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const linkText = match[1];
      const linkUrl = match[2];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
        // External link - skip validation for now
        continue;
      }

      // Validate local file links
      if (linkUrl.startsWith('./') || linkUrl.startsWith('../') || linkUrl.startsWith('/')) {
        try {
          let resolvedPath = linkUrl;
          if (linkUrl.startsWith('./') || linkUrl.startsWith('../')) {
            resolvedPath = path.resolve(path.dirname(filePath), linkUrl);
          } else {
            resolvedPath = path.resolve(process.cwd(), linkUrl.substring(1));
          }

          await fs.access(resolvedPath);
        } catch {
          stats.brokenLinks++;
          issues.push({
            type: 'error',
            line: lineNumber,
            message: `Broken link: ${linkUrl}`,
            suggestion: 'Check if the linked file exists and update the path'
          });
        }
      }
    }
  }

  private async validateNpmScripts(
    content: string, 
    filePath: string, 
    issues: Issue[], 
    stats: FileStats
  ) {
    // Find all npm run commands in documentation
    const npmRunRegex = /npm run ([a-zA-Z0-9:-]+)/g;
    let match;

    while ((match = npmRunRegex.exec(content)) !== null) {
      const scriptName = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      if (!this.packageJson.scripts?.[scriptName]) {
        issues.push({
          type: 'error',
          line: lineNumber,
          message: `npm script "${scriptName}" not found`,
          suggestion: 'Add the script to package.json or update documentation'
        });
      }
    }
  }

  private async checkOutdatedInfo(
    content: string, 
    filePath: string, 
    issues: Issue[], 
    stats: FileStats
  ) {
    // Check for version numbers that might be outdated
    const versionRegex = /(?:version|v)[\s:]*(\d+\.\d+\.\d+)/gi;
    let match;

    while ((match = versionRegex.exec(content)) !== null) {
      const version = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      // Compare with package.json version if it's about this package
      if (this.packageJson.version && version !== this.packageJson.version) {
        issues.push({
          type: 'info',
          line: lineNumber,
          message: `Version ${version} may be outdated (current: ${this.packageJson.version})`,
          suggestion: 'Consider updating version number'
        });
      }
    }

    // Check for TODO comments
    if (content.includes('TODO:') || content.includes('FIXME:')) {
      stats.outdatedExamples++;
      issues.push({
        type: 'info',
        message: 'Documentation contains TODO/FIXME items',
        suggestion: 'Review and complete pending documentation items'
      });
    }
  }

  private async generateReport() {
    const totalFiles = this.results.length;
    const totalIssues = this.results.reduce((sum, r) => sum + r.issues.length, 0);
    const totalErrors = this.results.reduce((sum, r) => 
      sum + r.issues.filter(i => i.type === 'error').length, 0);
    const totalWarnings = this.results.reduce((sum, r) => 
      sum + r.issues.filter(i => i.type === 'warning').length, 0);

    let report = `# Documentation Validation Report\n\n`;
    report += `*Generated on ${new Date().toISOString()}*\n\n`;
    report += `## Summary\n\n`;
    report += `- **Files processed:** ${totalFiles}\n`;
    report += `- **Total issues:** ${totalIssues}\n`;
    report += `- **Errors:** ${totalErrors}\n`;
    report += `- **Warnings:** ${totalWarnings}\n\n`;

    if (totalIssues > 0) {
      report += `## Issues by File\n\n`;

      this.results.forEach(result => {
        if (result.issues.length > 0) {
          report += `### ${result.file}\n\n`;
          
          result.issues.forEach(issue => {
            const icon = issue.type === 'error' ? '🚫' : 
                        issue.type === 'warning' ? '⚠️' : 'ℹ️';
            report += `${icon} **${issue.type.toUpperCase()}**`;
            
            if (issue.line) {
              report += ` (line ${issue.line})`;
            }
            
            report += `: ${issue.message}\n`;
            
            if (issue.suggestion) {
              report += `   *Suggestion: ${issue.suggestion}*\n`;
            }
            report += `\n`;
          });
        }
      });
    }

    // Statistics
    report += `## Statistics\n\n`;
    const totalCodeBlocks = this.results.reduce((sum, r) => sum + r.stats.codeBlocks, 0);
    const validCodeBlocks = this.results.reduce((sum, r) => sum + r.stats.validCodeBlocks, 0);
    const brokenLinks = this.results.reduce((sum, r) => sum + r.stats.brokenLinks, 0);

    report += `- **Code blocks:** ${validCodeBlocks}/${totalCodeBlocks} valid\n`;
    report += `- **Broken links:** ${brokenLinks}\n\n`;

    if (totalErrors === 0 && totalWarnings === 0) {
      report += `## ✅ All documentation is valid!\n\n`;
      report += `No issues found in the documentation.\n`;
    }

    // Write report
    await fs.writeFile(
      path.join(process.cwd(), 'docs/VALIDATION_REPORT.md'), 
      report
    );

    console.log(`\n📊 Validation complete:`);
    console.log(`   Files: ${totalFiles}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log(`   Warnings: ${totalWarnings}`);
    console.log(`   Code blocks: ${validCodeBlocks}/${totalCodeBlocks} valid`);
    
    if (totalErrors > 0) {
      console.log(`\n❌ Validation failed with ${totalErrors} errors`);
      process.exit(1);
    } else {
      console.log(`\n✅ Documentation validation passed`);
    }
  }
}

// Script execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'validate';

  const validator = new DocumentationValidator();
  
  if (command === 'validate') {
    validator.validate().catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
  } else if (command === 'stats') {
    // Just show quick stats without full validation
    (async () => {
      console.log('📊 Quick documentation stats:');
      const docFiles = await glob('**/*.md', {
        cwd: process.cwd(),
        ignore: ['node_modules/**', '**/node_modules/**', 'dist/**', 'build/**']
      });
      console.log(`   Documentation files: ${docFiles.length}`);
    })();
  } else {
    console.log('Usage: npm run docs:validate [validate|stats]');
  }
}

export { DocumentationValidator };