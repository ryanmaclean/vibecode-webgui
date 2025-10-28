#!/usr/bin/env npx tsx

/**
 * Documentation Example Fixer
 * Automatically fixes common documentation issues like broken import paths
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface FixResult {
  file: string;
  fixes: string[];
  success: boolean;
}

class DocumentationFixer {
  private results: FixResult[] = [];
  private srcStructure: Map<string, string> = new Map();

  async fix() {
    console.log('🔧 Starting documentation fixes...');
    
    // Build source structure map for import path corrections
    await this.buildSourceStructure();
    
    // Find documentation files
    const docFiles = await glob('**/*.md', {
      cwd: process.cwd(),
      ignore: ['node_modules/**', '**/node_modules/**', 'dist/**', 'build/**']
    });

    console.log(`🔍 Found ${docFiles.length} documentation files`);

    for (const file of docFiles) {
      try {
        await this.fixFile(file);
      } catch (error) {
        console.warn(`⚠️ Failed to fix ${file}:`, error.message);
        this.results.push({
          file,
          fixes: [],
          success: false
        });
      }
    }

    await this.generateReport();
  }

  private async buildSourceStructure() {
    console.log('📂 Analyzing source structure...');
    
    const sourceFiles = await glob('src/**/*.{ts,tsx}', {
      cwd: process.cwd()
    });

    for (const file of sourceFiles) {
      // Map file paths to their actual locations
      const fileName = path.basename(file, path.extname(file));
      const dirPath = path.dirname(file);
      
      this.srcStructure.set(fileName, file);
      this.srcStructure.set(dirPath, file);
    }
  }

  private async fixFile(filePath: string) {
    const content = await fs.readFile(filePath, 'utf-8');
    let fixedContent = content;
    const fixes: string[] = [];

    // Fix 1: Add language specifiers to code blocks
    fixedContent = this.fixCodeBlockLanguages(fixedContent, fixes);
    
    // Fix 2: Fix import paths
    fixedContent = this.fixImportPaths(fixedContent, fixes);
    
    // Fix 3: Fix npm script references
    fixedContent = await this.fixNpmScripts(fixedContent, fixes);
    
    // Fix 4: Remove version number mismatches (informational only)
    fixedContent = this.fixVersionReferences(fixedContent, fixes);

    // Only write if changes were made
    if (fixedContent !== content) {
      await fs.writeFile(filePath, fixedContent);
      this.results.push({
        file: filePath,
        fixes,
        success: true
      });
    }
  }

  private fixCodeBlockLanguages(content: string, fixes: string[]): string {
    // Find code blocks without language specifiers
    const codeBlockRegex = /```\n([\s\S]*?)```/g;
    
    return content.replace(codeBlockRegex, (match, code) => {
      const trimmedCode = code.trim();
      
      // Detect language based on content
      let language = '';
      
      if (trimmedCode.includes('npm run') || trimmedCode.includes('git ') || trimmedCode.includes('curl ')) {
        language = 'bash';
      } else if (trimmedCode.includes('import ') || trimmedCode.includes('export ') || 
                 trimmedCode.includes('interface ') || trimmedCode.includes('const ')) {
        language = 'typescript';
      } else if (trimmedCode.includes('function(') || trimmedCode.includes('var ') ||
                 trimmedCode.includes('let ')) {
        language = 'javascript';
      } else if (trimmedCode.startsWith('{') && trimmedCode.endsWith('}')) {
        language = 'json';
      }

      if (language) {
        fixes.push(`Added ${language} language specifier to code block`);
        return `\`\`\`${language}\n${code}\`\`\``;
      }
      
      return match;
    });
  }

  private fixImportPaths(content: string, fixes: string[]): string {
    // Fix relative import paths in TypeScript examples
    const importRegex = /import.*from\s+['"`](\.\.?\/[^'"`]+)['"`]/g;
    
    return content.replace(importRegex, (match, importPath) => {
      // Check if path exists
      const cleanPath = importPath.replace(/^\.\.?\//, '');
      
      // Try to find a matching file in our source structure
      for (const [key, actualPath] of this.srcStructure.entries()) {
        if (cleanPath.includes(key) || actualPath.includes(cleanPath)) {
          const correctedPath = `../lib/${key}`;
          if (correctedPath !== importPath) {
            fixes.push(`Fixed import path: ${importPath} → ${correctedPath}`);
            return match.replace(importPath, correctedPath);
          }
        }
      }
      
      return match;
    });
  }

  private async fixNpmScripts(content: string, fixes: string[]): Promise<string> {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      const availableScripts = Object.keys(packageJson.scripts || {});

      const npmRunRegex = /npm run ([a-zA-Z0-9:-]+)/g;
      
      return content.replace(npmRunRegex, (match, scriptName) => {
        if (!availableScripts.includes(scriptName)) {
          // Try to find a similar script
          const similarScript = this.findSimilarScript(scriptName, availableScripts);
          if (similarScript) {
            fixes.push(`Fixed npm script: ${scriptName} → ${similarScript}`);
            return match.replace(scriptName, similarScript);
          } else {
            // Comment out the invalid script
            fixes.push(`Commented out invalid npm script: ${scriptName}`);
            return `# ${match}  # Script not found`;
          }
        }
        return match;
      });
    } catch (error) {
      return content;
    }
  }

  private findSimilarScript(scriptName: string, availableScripts: string[]): string | null {
    // Simple similarity matching
    for (const available of availableScripts) {
      if (available.includes(scriptName) || scriptName.includes(available)) {
        return available;
      }
    }
    
    // Check for common aliases
    const aliases = {
      'test:unit': 'test',
      'test:e2e': 'test:e2e',
      'dev:start': 'dev',
      'docs:build': 'docs:generate'
    };

    return aliases[scriptName] || null;
  }

  private fixVersionReferences(content: string, fixes: string[]): string {
    // Replace hardcoded version numbers with dynamic references where appropriate
    const versionRegex = /version[:\s]+(\d+\.\d+\.\d+)/gi;
    
    return content.replace(versionRegex, (match, version) => {
      // Only fix obvious version mismatches in documentation
      if (version === '1.0.0' || version === '0.0.1') {
        fixes.push(`Updated generic version reference`);
        return match.replace(version, 'latest');
      }
      return match;
    });
  }

  private async generateReport() {
    const successfulFixes = this.results.filter(r => r.success);
    const totalFixes = successfulFixes.reduce((sum, r) => sum + r.fixes.length, 0);

    console.log(`\n📊 Documentation fixes complete:`);
    console.log(`   Files processed: ${this.results.length}`);
    console.log(`   Files fixed: ${successfulFixes.length}`);
    console.log(`   Total fixes applied: ${totalFixes}`);

    if (successfulFixes.length > 0) {
      console.log(`\n✅ Fixed files:`);
      successfulFixes.forEach(result => {
        console.log(`   📄 ${result.file}: ${result.fixes.length} fixes`);
        result.fixes.forEach(fix => {
          console.log(`      • ${fix}`);
        });
      });
    }

    // Write detailed report
    let report = `# Documentation Fixes Report\n\n`;
    report += `*Generated on ${new Date().toISOString()}*\n\n`;
    report += `## Summary\n\n`;
    report += `- **Files processed:** ${this.results.length}\n`;
    report += `- **Files fixed:** ${successfulFixes.length}\n`;
    report += `- **Total fixes:** ${totalFixes}\n\n`;

    if (successfulFixes.length > 0) {
      report += `## Fixed Files\n\n`;
      
      successfulFixes.forEach(result => {
        report += `### ${result.file}\n\n`;
        result.fixes.forEach(fix => {
          report += `- ${fix}\n`;
        });
        report += `\n`;
      });
    }

    await fs.writeFile(
      path.join(process.cwd(), 'docs/FIXES_REPORT.md'),
      report
    );
  }
}

// Script execution
if (require.main === module) {
  const fixer = new DocumentationFixer();
  fixer.fix().catch(error => {
    console.error('Documentation fixing failed:', error);
    process.exit(1);
  });
}

export { DocumentationFixer };