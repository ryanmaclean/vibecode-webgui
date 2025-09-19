#!/usr/bin/env node

/**
 * Automated Script Error Tracking Integration
 * 
 * This script automatically integrates Datadog Error Tracking into all
 * shell scripts and Node.js scripts in the project.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { execSync } from 'child_process';

interface ScriptInfo {
  path: string;
  name: string;
  type: 'shell' | 'node' | 'python' | 'other';
  hasErrorTracking: boolean;
  needsIntegration: boolean;
}

class ScriptErrorTrackingIntegrator {
  private scriptsDir: string;
  private processedScripts: ScriptInfo[] = [];
  private integrationStats = {
    total: 0,
    processed: 0,
    shellScripts: 0,
    nodeScripts: 0,
    pythonScripts: 0,
    alreadyIntegrated: 0,
    errors: 0
  };

  constructor(scriptsDir: string = './scripts') {
    this.scriptsDir = scriptsDir;
  }

  /**
   * Main integration process
   */
  async integrateAllScripts(): Promise<void> {
    console.log('🚀 Starting automated error tracking integration...');
    console.log(`📁 Scanning directory: ${this.scriptsDir}`);

    // Discover all scripts
    await this.discoverScripts();

    // Process each script
    await this.processScripts();

    // Generate report
    this.generateReport();

    console.log('✅ Error tracking integration completed!');
  }

  /**
   * Discover all scripts in the directory
   */
  private async discoverScripts(): Promise<void> {
    const files = this.getAllFiles(this.scriptsDir);
    
    for (const file of files) {
      const ext = extname(file);
      const name = basename(file);
      
      // Skip certain files
      if (this.shouldSkipFile(name, ext)) {
        continue;
      }

      const scriptInfo: ScriptInfo = {
        path: file,
        name,
        type: this.getScriptType(ext),
        hasErrorTracking: false,
        needsIntegration: false
      };

      // Check if already has error tracking
      scriptInfo.hasErrorTracking = this.hasErrorTracking(file);
      scriptInfo.needsIntegration = !scriptInfo.hasErrorTracking && scriptInfo.type !== 'other';

      this.processedScripts.push(scriptInfo);
      this.integrationStats.total++;
    }

    console.log(`📊 Discovered ${this.integrationStats.total} scripts`);
  }

  /**
   * Process each script for integration
   */
  private async processScripts(): Promise<void> {
    for (const script of this.processedScripts) {
      if (!script.needsIntegration) {
        if (script.hasErrorTracking) {
          this.integrationStats.alreadyIntegrated++;
        }
        continue;
      }

      try {
        console.log(`🔧 Processing: ${script.name} (${script.type})`);
        
        switch (script.type) {
          case 'shell':
            await this.integrateShellScript(script);
            this.integrationStats.shellScripts++;
            break;
          case 'node':
            await this.integrateNodeScript(script);
            this.integrationStats.nodeScripts++;
            break;
          case 'python':
            await this.integratePythonScript(script);
            this.integrationStats.pythonScripts++;
            break;
        }
        
        this.integrationStats.processed++;
      } catch (error) {
        console.error(`❌ Failed to process ${script.name}:`, error);
        this.integrationStats.errors++;
      }
    }
  }

  /**
   * Integrate error tracking into shell script
   */
  private async integrateShellScript(script: ScriptInfo): Promise<void> {
    const content = readFileSync(script.path, 'utf8');
    
    // Skip if already has error tracking
    if (content.includes('error-tracking.sh') || content.includes('init_error_tracking')) {
      return;
    }

    let newContent = content;

    // Add error tracking import at the top (after shebang)
    const shebangMatch = content.match(/^#!.*\n/);
    if (shebangMatch) {
      const afterShebang = content.substring(shebangMatch[0].length);
      newContent = shebangMatch[0] + 
        '# Source error tracking module\n' +
        'source "$(dirname "$0")/lib/error-tracking.sh"\n\n' +
        afterShebang;
    } else {
      newContent = '# Source error tracking module\n' +
        'source "$(dirname "$0")/lib/error-tracking.sh"\n\n' +
        content;
    }

    // Add error tracking initialization
    const component = this.extractComponentFromPath(script.path);
    const initLine = `init_error_tracking "${component}" "execution"`;
    
    // Find a good place to add initialization (after variable declarations)
    const lines = newContent.split('\n');
    let insertIndex = 0;
    
    // Look for a good insertion point
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^[A-Z_]+=/) || lines[i].match(/^#/) || lines[i].trim() === '') {
        insertIndex = i + 1;
      } else {
        break;
      }
    }
    
    lines.splice(insertIndex, 0, '', '# Initialize error tracking', initLine, '');
    newContent = lines.join('\n');

    // Replace set -e with error tracking
    newContent = newContent.replace(/^set -e$/m, '# set -e  # Replaced by error tracking');

    writeFileSync(script.path, newContent);
    console.log(`✅ Integrated error tracking into ${script.name}`);
  }

  /**
   * Integrate error tracking into Node.js script
   */
  private async integrateNodeScript(script: ScriptInfo): Promise<void> {
    const content = readFileSync(script.path, 'utf8');
    
    // Skip if already has error tracking
    if (content.includes('error-tracking-node') || content.includes('createScriptErrorTracker')) {
      return;
    }

    let newContent = content;

    // Add import at the top
    const importLine = "import { createScriptErrorTracker, checkErrorTrackingAvailability } from '../src/lib/automation/error-tracking-node.js';";
    
    // Find insertion point after existing imports
    const lines = newContent.split('\n');
    let insertIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s+/) || lines[i].match(/^const\s+.*require\(/) || lines[i].match(/^require\(/)) {
        insertIndex = i + 1;
      } else if (lines[i].trim() === '' && insertIndex > 0) {
        insertIndex = i + 1;
      } else if (lines[i].trim() !== '' && !lines[i].match(/^import\s+/) && !lines[i].match(/^const\s+.*require\(/) && !lines[i].match(/^require\(/)) {
        break;
      }
    }
    
    lines.splice(insertIndex, 0, '', importLine, '');

    // Add error tracker initialization
    const component = this.extractComponentFromPath(script.path);
    const initCode = `
// Initialize error tracking
const errorTracker = createScriptErrorTracker('${script.name}', '${component}', 'execution');
errorTracker.init();

// Track script completion on exit
process.on('exit', (code) => {
  errorTracker.trackScriptCompletion(code);
});

// Track script completion on SIGINT/SIGTERM
process.on('SIGINT', () => {
  errorTracker.trackScriptCompletion(0);
  process.exit(0);
});

process.on('SIGTERM', () => {
  errorTracker.trackScriptCompletion(0);
  process.exit(0);
});
`;

    // Find a good place to add initialization (after imports and before main code)
    let mainCodeIndex = insertIndex + 3;
    for (let i = mainCodeIndex; i < lines.length; i++) {
      if (lines[i].trim() !== '' && !lines[i].match(/^\/\//) && !lines[i].match(/^\/\*/)) {
        mainCodeIndex = i;
        break;
      }
    }
    
    lines.splice(mainCodeIndex, 0, initCode);

    newContent = lines.join('\n');
    writeFileSync(script.path, newContent);
    console.log(`✅ Integrated error tracking into ${script.name}`);
  }

  /**
   * Integrate error tracking into Python script
   */
  private async integratePythonScript(script: ScriptInfo): Promise<void> {
    const content = readFileSync(script.path, 'utf8');
    
    // Skip if already has error tracking
    if (content.includes('error_tracking') || content.includes('datadog')) {
      return;
    }

    let newContent = content;

    // Add error tracking import
    const importLine = "import os\nimport json\nimport requests\nfrom datetime import datetime";
    
    // Find insertion point after existing imports
    const lines = newContent.split('\n');
    let insertIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^import\s+/) || lines[i].match(/^from\s+.*import/)) {
        insertIndex = i + 1;
      } else if (lines[i].trim() === '' && insertIndex > 0) {
        insertIndex = i + 1;
      } else if (lines[i].trim() !== '' && !lines[i].match(/^import\s+/) && !lines[i].match(/^from\s+.*import/)) {
        break;
      }
    }
    
    lines.splice(insertIndex, 0, '', importLine, '');

    // Add error tracking functions
    const errorTrackingCode = `
# Error tracking configuration
DD_ERROR_TRACKING_ENABLED = os.getenv('DD_ERROR_TRACKING_ENABLED', 'false').lower() == 'true'
DD_API_KEY = os.getenv('DD_API_KEY', '')
DD_SERVICE = os.getenv('DD_SERVICE', 'vibecode-webgui')
DD_ENV = os.getenv('DD_ENV', os.getenv('NODE_ENV', 'development'))
DD_VERSION = os.getenv('DD_VERSION', '1.0.0')

def track_error(error_message, error_type='script_error', additional_context=None):
    if not DD_ERROR_TRACKING_ENABLED or not DD_API_KEY:
        return
    
    payload = {
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'service': DD_SERVICE,
        'env': DD_ENV,
        'version': DD_VERSION,
        'error': {
            'message': error_message,
            'type': error_type
        },
        'context': {
            'script_name': '${script.name}',
            'component': '${this.extractComponentFromPath(script.path)}',
            'hostname': os.uname().nodename,
            'user': os.getenv('USER', 'unknown'),
            'working_directory': os.getcwd(),
            **(additional_context or {})
        },
        'tags': [
            f'service:{DD_SERVICE}',
            f'env:{DD_ENV}',
            f'script:${script.name}',
            f'error_type:{error_type}'
        ]
    }
    
    try:
        response = requests.post(
            f'https://http-intake.logs.datadoghq.com/v1/input/{DD_API_KEY}',
            json=payload,
            timeout=5
        )
    except Exception:
        pass  # Fail silently

def track_script_start():
    track_error(f'Script started: ${script.name}', 'script_start')

def track_script_completion(exit_code=0):
    track_error(f'Script completed: ${script.name}', 'script_completion', {'exit_code': exit_code})

# Initialize error tracking
if DD_ERROR_TRACKING_ENABLED:
    track_script_start()
`;

    // Find main code section
    let mainCodeIndex = insertIndex + 2;
    for (let i = mainCodeIndex; i < lines.length; i++) {
      if (lines[i].trim() !== '' && not lines[i].startswith('#') && not lines[i].startswith('"""') && not lines[i].startswith("'''"):
        mainCodeIndex = i;
        break;
      }
    }
    
    lines.splice(mainCodeIndex, 0, errorTrackingCode);

    newContent = lines.join('\n');
    writeFileSync(script.path, newContent);
    console.log(`✅ Integrated error tracking into ${script.name}`);
  }

  /**
   * Get all files recursively
   */
  private getAllFiles(dir: string): string[] {
    const files: string[] = [];
    
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...this.getAllFiles(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}:`, error);
    }
    
    return files;
  }

  /**
   * Check if file should be skipped
   */
  private shouldSkipFile(name: string, ext: string): boolean {
    const skipPatterns = [
      /\.md$/,
      /\.txt$/,
      /\.json$/,
      /\.yaml$/,
      /\.yml$/,
      /\.toml$/,
      /\.example$/,
      /\.template$/,
      /README/,
      /LICENSE/,
      /\.git/,
      /node_modules/,
      /\.DS_Store/
    ];
    
    return skipPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Get script type from extension
   */
  private getScriptType(ext: string): 'shell' | 'node' | 'python' | 'other' {
    switch (ext) {
      case '.sh':
      case '.bash':
        return 'shell';
      case '.js':
      case '.ts':
      case '.mjs':
      case '.cjs':
        return 'node';
      case '.py':
        return 'python';
      default:
        return 'other';
    }
  }

  /**
   * Check if script already has error tracking
   */
  private hasErrorTracking(filePath: string): boolean {
    try {
      const content = readFileSync(filePath, 'utf8');
      return content.includes('error-tracking') || 
             content.includes('datadog') || 
             content.includes('DD_API_KEY') ||
             content.includes('trackError');
    } catch {
      return false;
    }
  }

  /**
   * Extract component name from file path
   */
  private extractComponentFromPath(filePath: string): string {
    const pathParts = filePath.split('/');
    
    // Look for common component indicators
    for (const part of pathParts) {
      if (part.includes('deploy')) return 'deployment';
      if (part.includes('test')) return 'testing';
      if (part.includes('monitor')) return 'monitoring';
      if (part.includes('setup')) return 'setup';
      if (part.includes('build')) return 'build';
      if (part.includes('kind')) return 'kubernetes';
      if (part.includes('aks')) return 'azure';
      if (part.includes('security')) return 'security';
      if (part.includes('validate')) return 'validation';
    }
    
    return 'script';
  }

  /**
   * Generate integration report
   */
  private generateReport(): void {
    console.log('\n📊 Integration Report');
    console.log('====================');
    console.log(`Total scripts found: ${this.integrationStats.total}`);
    console.log(`Scripts processed: ${this.integrationStats.processed}`);
    console.log(`Already integrated: ${this.integrationStats.alreadyIntegrated}`);
    console.log(`Errors encountered: ${this.integrationStats.errors}`);
    console.log('');
    console.log('By type:');
    console.log(`  Shell scripts: ${this.integrationStats.shellScripts}`);
    console.log(`  Node.js scripts: ${this.integrationStats.nodeScripts}`);
    console.log(`  Python scripts: ${this.integrationStats.pythonScripts}`);
    
    if (this.integrationStats.errors > 0) {
      console.log('\n⚠️  Some scripts could not be processed. Check the logs above.');
    }
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Set DD_ERROR_TRACKING_ENABLED=true in your environment');
    console.log('2. Set DD_API_KEY with your Datadog API key');
    console.log('3. Test the integration by running some scripts');
    console.log('4. Check your Datadog Error Tracking dashboard');
  }
}

// Main execution
async function main() {
  const integrator = new ScriptErrorTrackingIntegrator();
  await integrator.integrateAllScripts();
}

if (require.main === module) {
  main().catch(console.error);
}

export { ScriptErrorTrackingIntegrator };
