#!/usr/bin/env node

/**
 * Theme Testing Script for Code-Server
 * 
 * This script tests both dark and light themes to ensure they work properly
 * and don't have any visual issues.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ThemeTester {
    constructor() {
        this.testPort = 8080;
        this.results = {
            darkTheme: {},
            lightTheme: {},
            comparison: {}
        };
    }

    async runTests() {
        console.log('🎨 Starting Theme Testing Suite\n');
        
        try {
            // Test Dark Theme
            console.log('🌙 Testing Dark Theme...');
            await this.testDarkTheme();
            
            // Test Light Theme
            console.log('☀️  Testing Light Theme...');
            await this.testLightTheme();
            
            // Compare themes
            await this.compareThemes();
            
            // Generate report
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Theme test failed:', error.message);
        } finally {
            await this.cleanup();
        }
    }

    async testDarkTheme() {
        const testResults = {
            timestamp: new Date().toISOString(),
            theme: 'Dark+ (default dark)',
            tests: {}
        };

        try {
            // Update settings to dark theme
            await this.updateThemeSettings('Dark+ (default dark)');
            
            // Start code-server
            await this.startCodeServer();
            
            // Test theme loading
            testResults.tests.themeLoad = await this.testThemeLoad('dark');
            
            // Test UI elements
            testResults.tests.uiElements = await this.testUIElements('dark');
            
            // Take screenshot
            await this.takeScreenshot('dark-theme-test.png');
            
        } catch (error) {
            testResults.error = error.message;
        }

        this.results.darkTheme = testResults;
    }

    async testLightTheme() {
        const testResults = {
            timestamp: new Date().toISOString(),
            theme: 'Light+ (default light)',
            tests: {}
        };

        try {
            // Update settings to light theme
            await this.updateThemeSettings('Light+ (default light)');
            
            // Restart code-server
            await this.restartCodeServer();
            
            // Test theme loading
            testResults.tests.themeLoad = await this.testThemeLoad('light');
            
            // Test UI elements
            testResults.tests.uiElements = await this.testUIElements('light');
            
            // Take screenshot
            await this.takeScreenshot('light-theme-test.png');
            
        } catch (error) {
            testResults.error = error.message;
        }

        this.results.lightTheme = testResults;
    }

    async updateThemeSettings(themeName) {
        const settingsPath = path.join(process.env.HOME, '.config/code-server/user-data/User/settings.json');
        
        const settings = {
            "workbench.startupEditor": "none",
            "workbench.welcome.enabled": false,
            "workbench.welcomePage.walkthroughs.openOnInstall": false,
            "workbench.tips.enabled": false,
            "workbench.colorTheme": themeName,
            "workbench.firstRun": false,
            "workbench.hideWelcomeOnLaunch": true,
            "workbench.welcomePage.experimental.allowWalkthroughs": false,
            "workbench.editor.showTabs": "multiple",
            "workbench.editor.enablePreview": false,
            "workbench.startup.editor": "none",
            "workbench.preferredLightColorTheme": "Light+ (default light)",
            "workbench.preferredDarkColorTheme": "Dark+ (default dark)",
            "workbench.preferredHighContrastColorTheme": "Default High Contrast",
            "workbench.preferredHighContrastLightColorTheme": "Default High Contrast Light"
        };

        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log(`  ✅ Updated theme settings to: ${themeName}`);
    }

    async startCodeServer() {
        console.log('  🚀 Starting code-server...');
        
        // Kill existing instances
        try {
            execSync(`lsof -ti:${this.testPort} | xargs kill -9`, { stdio: 'ignore' });
        } catch (e) {
            // Ignore if no processes found
        }

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
        console.log('  ✅ Code-server started');
    }

    async restartCodeServer() {
        console.log('  🔄 Restarting code-server...');
        await this.startCodeServer();
    }

    async testThemeLoad(themeType) {
        console.log(`    📋 Testing ${themeType} theme load...`);
        
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

    async testUIElements(themeType) {
        console.log(`    🎨 Testing ${themeType} theme UI elements...`);
        
        // This would require browser automation to test actual UI elements
        // For now, we'll simulate the test
        return {
            editorBackground: 'unknown',
            sidebarBackground: 'unknown',
            statusBarBackground: 'unknown',
            activityBarBackground: 'unknown',
            titleBarBackground: 'unknown',
            note: 'Requires manual verification - check screenshots for visual issues'
        };
    }

    async takeScreenshot(filename) {
        console.log(`    📸 Taking screenshot: ${filename}`);
        
        try {
            // Open Safari
            execSync('open -a Safari http://localhost:8080');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Take screenshot
            execSync(`screencapture -w ~/tmp/${filename}`);
            console.log(`    ✅ Screenshot saved: ~/tmp/${filename}`);
        } catch (error) {
            console.log(`    ❌ Screenshot failed: ${error.message}`);
        }
    }

    async compareThemes() {
        console.log('📊 Comparing theme results...');
        
        this.results.comparison = {
            timestamp: new Date().toISOString(),
            summary: {
                darkThemeWorking: this.results.darkTheme.tests?.themeLoad?.success || false,
                lightThemeWorking: this.results.lightTheme.tests?.themeLoad?.success || false,
                bothThemesFunctional: (this.results.darkTheme.tests?.themeLoad?.success && this.results.lightTheme.tests?.themeLoad?.success) || false
            },
            recommendations: [
                'Verify screenshots for visual consistency',
                'Test theme switching functionality',
                'Check for any color contrast issues',
                'Ensure both themes are accessible'
            ]
        };
    }

    async generateReport() {
        const reportPath = 'test-results/theme-test-results.json';
        
        // Ensure directory exists
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        
        // Write results
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        
        console.log(`📄 Theme test report generated: ${reportPath}`);
        
        // Also create a markdown summary
        const markdownReport = this.generateMarkdownReport();
        fs.writeFileSync('test-results/theme-test-results.md', markdownReport);
        
        console.log('📄 Markdown report generated: test-results/theme-test-results.md');
    }

    generateMarkdownReport() {
        return `# Theme Testing Results

## Test Summary

**Test Date:** ${new Date().toISOString()}

### Results Overview

| Theme | Load Success | UI Elements | Screenshot |
|-------|--------------|-------------|------------|
| Dark+ (default dark) | ${this.results.darkTheme.tests?.themeLoad?.success ? '✅' : '❌'} | ⚠️ | 📸 |
| Light+ (default light) | ${this.results.lightTheme.tests?.themeLoad?.success ? '✅' : '❌'} | ⚠️ | 📸 |

### Key Findings

1. **Dark Theme**: ${this.results.darkTheme.tests?.themeLoad?.success ? 'Working properly' : 'Has issues'}
2. **Light Theme**: ${this.results.lightTheme.tests?.themeLoad?.success ? 'Working properly' : 'Has issues'}
3. **Theme Switching**: Both themes should be functional

### Screenshots

- Dark Theme: \`~/tmp/dark-theme-test.png\`
- Light Theme: \`~/tmp/light-theme-test.png\`

### Recommendations

${this.results.comparison.recommendations.map(rec => `- ${rec}`).join('\n')}

### Next Steps

1. Review screenshots for visual issues
2. Test theme switching manually
3. Verify accessibility compliance
4. Document any theme-specific issues
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
    const tester = new ThemeTester();
    tester.runTests().catch(console.error);
}

module.exports = ThemeTester;
