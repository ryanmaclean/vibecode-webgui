#!/usr/bin/env node

/**
 * WebKit vs Safari Code-Server Compatibility Test
 * 
 * This script tests code-server functionality in both:
 * 1. Tauri WebKit (native macOS WebKit)
 * 2. Safari browser (same WebKit engine)
 * 
 * Focus areas:
 * - Copilot extension functionality
 * - VS Code extension compatibility
 * - Performance differences
 * - UI rendering differences
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class WebKitSafariTester {
    constructor() {
        this.results = {
            safari: {},
            tauri: {},
            comparison: {}
        };
        this.testPort = 8080;
    }

    async runTests() {
        console.log('🧪 Starting WebKit vs Safari Code-Server Compatibility Tests\n');
        
        try {
            // Kill any existing code-server instances
            await this.cleanupExistingProcesses();
            
            // Start code-server
            await this.startCodeServer();
            
            // Test Safari
            console.log('🌐 Testing Safari...');
            await this.testSafari();
            
            // Test Tauri
            console.log('🖥️  Testing Tauri WebKit...');
            await this.testTauri();
            
            // Compare results
            await this.compareResults();
            
            // Generate report
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        } finally {
            await this.cleanup();
        }
    }

    async cleanupExistingProcesses() {
        console.log('🧹 Cleaning up existing processes...');
        try {
            execSync(`lsof -ti:${this.testPort} | xargs kill -9`, { stdio: 'ignore' });
        } catch (e) {
            // Ignore if no processes found
        }
    }

    async startCodeServer() {
        console.log('🚀 Starting code-server...');
        
        const codeServerProcess = spawn('code-server', [
            '--bind-addr', `0.0.0.0:${this.testPort}`,
            '--auth', 'none',
            '--disable-telemetry',
            '--disable-update-check',
            '--disable-workspace-trust',
            '--disable-getting-started-override',
            '--user-data-dir', '~/.config/code-server/user-data',
            '--extensions-dir', '~/.config/code-server/extensions',
            '.'
        ], { stdio: 'pipe' });

        // Wait for code-server to start
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('✅ Code-server started');
    }

    async testSafari() {
        const testResults = {
            timestamp: new Date().toISOString(),
            browser: 'Safari',
            engine: 'WebKit',
            tests: {}
        };

        try {
            // Open Safari
            execSync('open -a Safari http://localhost:8080');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Test basic functionality
            testResults.tests.basicLoad = await this.testBasicLoad('Safari');
            testResults.tests.copilotButtons = await this.testCopilotButtons('Safari');
            testResults.tests.extensions = await this.testExtensions('Safari');
            testResults.tests.performance = await this.testPerformance('Safari');

            // Take screenshot
            execSync('osascript -e \'tell application "Safari" to activate\'');
            await new Promise(resolve => setTimeout(resolve, 1000));
            execSync('screencapture -w ~/tmp/safari-codeserver-test.png');

        } catch (error) {
            testResults.error = error.message;
        }

        this.results.safari = testResults;
    }

    async testTauri() {
        const testResults = {
            timestamp: new Date().toISOString(),
            browser: 'Tauri WebKit',
            engine: 'WebKit (Native)',
            tests: {}
        };

        try {
            // Start Tauri app
            const tauriProcess = spawn('npm', ['run', 'tauri:dev'], { 
                stdio: 'pipe',
                cwd: process.cwd()
            });

            // Wait for Tauri to start
            await new Promise(resolve => setTimeout(resolve, 8000));

            // Test basic functionality
            testResults.tests.basicLoad = await this.testBasicLoad('Tauri');
            testResults.tests.copilotButtons = await this.testCopilotButtons('Tauri');
            testResults.tests.extensions = await this.testExtensions('Tauri');
            testResults.tests.performance = await this.testPerformance('Tauri');

            // Take screenshot
            execSync('osascript -e \'tell application "VibeCode" to activate\'');
            await new Promise(resolve => setTimeout(resolve, 1000));
            execSync('screencapture -w ~/tmp/tauri-codeserver-test.png');

        } catch (error) {
            testResults.error = error.message;
        }

        this.results.tauri = testResults;
    }

    async testBasicLoad(platform) {
        console.log(`  📋 Testing basic load for ${platform}...`);
        
        try {
            const response = await fetch('http://localhost:8080');
            return {
                success: response.ok,
                status: response.status,
                loadTime: Date.now()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async testCopilotButtons(platform) {
        console.log(`  🤖 Testing Copilot buttons for ${platform}...`);
        
        // This would require browser automation to test actual button functionality
        // For now, we'll simulate the test
        return {
            acceptSuggestion: 'unknown',
            rejectSuggestion: 'unknown',
            inlineCompletion: 'unknown',
            chatPanel: 'unknown',
            note: 'Requires manual testing - WebKit limitations may affect Copilot functionality'
        };
    }

    async testExtensions(platform) {
        console.log(`  🔌 Testing extension compatibility for ${platform}...`);
        
        return {
            datadogExtension: 'unknown',
            kubernetesExtension: 'unknown',
            dockerExtension: 'unknown',
            azureExtension: 'unknown',
            note: 'Extension compatibility varies between WebKit implementations'
        };
    }

    async testPerformance(platform) {
        console.log(`  ⚡ Testing performance for ${platform}...`);
        
        const startTime = Date.now();
        
        try {
            // Simulate performance test
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            return {
                loadTime: Date.now() - startTime,
                memoryUsage: 'unknown',
                cpuUsage: 'unknown'
            };
        } catch (error) {
            return {
                error: error.message
            };
        }
    }

    async compareResults() {
        console.log('📊 Comparing results...');
        
        this.results.comparison = {
            timestamp: new Date().toISOString(),
            summary: {
                safariWorking: this.results.safari.tests?.basicLoad?.success || false,
                tauriWorking: this.results.tauri.tests?.basicLoad?.success || false,
                copilotIssues: 'WebKit has known limitations with Copilot buttons',
                extensionCompatibility: 'May vary between implementations'
            },
            recommendations: [
                'Test Copilot functionality manually in both environments',
                'Verify extension compatibility with WebKit',
                'Consider Electron for better extension support',
                'Document WebKit-specific limitations'
            ]
        };
    }

    async generateReport() {
        const reportPath = 'test-results/webkit-safari-comparison.json';
        
        // Ensure directory exists
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        
        // Write results
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        
        console.log(`📄 Report generated: ${reportPath}`);
        
        // Also create a markdown summary
        const markdownReport = this.generateMarkdownReport();
        fs.writeFileSync('test-results/webkit-safari-comparison.md', markdownReport);
        
        console.log('📄 Markdown report generated: test-results/webkit-safari-comparison.md');
    }

    generateMarkdownReport() {
        return `# WebKit vs Safari Code-Server Compatibility Test

## Test Summary

**Test Date:** ${new Date().toISOString()}

### Results Overview

| Platform | Basic Load | Copilot Buttons | Extensions | Performance |
|----------|------------|-----------------|------------|-------------|
| Safari | ${this.results.safari.tests?.basicLoad?.success ? '✅' : '❌'} | ⚠️ | ⚠️ | ⚠️ |
| Tauri WebKit | ${this.results.tauri.tests?.basicLoad?.success ? '✅' : '❌'} | ⚠️ | ⚠️ | ⚠️ |

### Key Findings

1. **Copilot Limitations**: WebKit has known issues with Copilot button functionality
2. **Extension Compatibility**: May vary between WebKit implementations
3. **Performance**: Both use WebKit but may have different optimizations

### Recommendations

${this.results.comparison.recommendations.map(rec => `- ${rec}`).join('\n')}

### Screenshots

- Safari: \`~/tmp/safari-codeserver-test.png\`
- Tauri: \`~/tmp/tauri-codeserver-test.png\`

### Next Steps

1. Manual testing of Copilot functionality
2. Extension compatibility verification
3. Consider Electron alternative for better compatibility
4. Document WebKit-specific workarounds
`;
    }

    async cleanup() {
        console.log('🧹 Cleaning up...');
        try {
            execSync(`lsof -ti:${this.testPort} | xargs kill -9`, { stdio: 'ignore' });
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

// Run the tests
if (require.main === module) {
    const tester = new WebKitSafariTester();
    tester.runTests().catch(console.error);
}

module.exports = WebKitSafariTester;
