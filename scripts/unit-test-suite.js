#!/usr/bin/env node

/**
 * VibeCode Unit Test Suite
 * Tests core functionality programmatically
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

class VibeCodeTestSuite {
    constructor() {
        this.results = {
            suite: 'VibeCode Unit Tests',
            timestamp: new Date().toISOString(),
            tests: [],
            summary: { total: 0, passed: 0, failed: 0 }
        };
        this.testDir = '/tmp/vibecode-unit-tests';
    }

    async runTest(testName, testFunction) {
        console.log(`🧪 Running: ${testName}`);
        this.results.summary.total++;
        
        try {
            const result = await testFunction();
            if (result.success) {
                console.log(`   ✅ PASSED: ${result.message}`);
                this.results.tests.push({
                    name: testName,
                    status: 'PASS',
                    message: result.message,
                    duration: result.duration || 0
                });
                this.results.summary.passed++;
            } else {
                console.log(`   ❌ FAILED: ${result.message}`);
                this.results.tests.push({
                    name: testName,
                    status: 'FAIL',
                    message: result.message,
                    error: result.error,
                    duration: result.duration || 0
                });
                this.results.summary.failed++;
            }
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
            this.results.tests.push({
                name: testName,
                status: 'ERROR',
                message: error.message,
                error: error.stack
            });
            this.results.summary.failed++;
        }
    }

    async testCodeServerAvailability() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const req = http.get('http://localhost:8080', { timeout: 5000 }, (res) => {
                const duration = Date.now() - startTime;
                if (res.statusCode === 200) {
                    resolve({
                        success: true,
                        message: `code-server responding (${res.statusCode})`,
                        duration
                    });
                } else {
                    resolve({
                        success: false,
                        message: `code-server returned ${res.statusCode}`,
                        duration
                    });
                }
            });

            req.on('error', (error) => {
                const duration = Date.now() - startTime;
                resolve({
                    success: false,
                    message: `code-server not accessible: ${error.message}`,
                    duration
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    success: false,
                    message: 'code-server request timed out',
                    duration: Date.now() - startTime
                });
            });
        });
    }

    async testCodeServerContent() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const req = http.get('http://localhost:8080', { timeout: 5000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const duration = Date.now() - startTime;
                    const hasCodeServer = data.includes('code-server') || data.includes('VS Code');
                    const hasWelcome = data.includes('Welcome') || data.includes('Getting Started');
                    
                    if (hasCodeServer && !hasWelcome) {
                        resolve({
                            success: true,
                            message: 'VS Code interface loaded without welcome screen',
                            duration
                        });
                    } else if (hasCodeServer && hasWelcome) {
                        resolve({
                            success: false,
                            message: 'VS Code interface loaded but shows welcome screen',
                            duration
                        });
                    } else {
                        resolve({
                            success: false,
                            message: 'VS Code interface not detected',
                            duration
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({
                    success: false,
                    message: `Failed to fetch content: ${error.message}`,
                    duration: Date.now() - startTime
                });
            });
        });
    }

    async testAppProcess(appName) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            exec(`pgrep -f "${appName}"`, (error, stdout) => {
                const duration = Date.now() - startTime;
                if (error) {
                    resolve({
                        success: false,
                        message: `App process not found: ${appName}`,
                        duration
                    });
                } else {
                    const pids = stdout.trim().split('\n').filter(pid => pid);
                    resolve({
                        success: true,
                        message: `App running with ${pids.length} process(es): ${pids.join(', ')}`,
                        duration
                    });
                }
            });
        });
    }

    async testAppLaunch(appPath) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            if (!fs.existsSync(appPath)) {
                resolve({
                    success: false,
                    message: `App not found at: ${appPath}`,
                    duration: 0
                });
                return;
            }

            const appName = path.basename(appPath, '.app');
            
            // Launch app
            exec(`open "${appPath}"`, (error) => {
                if (error) {
                    resolve({
                        success: false,
                        message: `Failed to launch app: ${error.message}`,
                        duration: Date.now() - startTime
                    });
                    return;
                }

                // Wait for app to start
                setTimeout(async () => {
                    const processTest = await this.testAppProcess(appName);
                    resolve({
                        success: processTest.success,
                        message: processTest.message,
                        duration: Date.now() - startTime
                    });
                }, 3000);
            });
        });
    }

    async testPKGStructure(pkgPath) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            if (!fs.existsSync(pkgPath)) {
                resolve({
                    success: false,
                    message: `PKG not found at: ${pkgPath}`,
                    duration: 0
                });
                return;
            }

            // Expand PKG
            const expandDir = path.join(this.testDir, 'pkg-expanded');
            exec(`pkgutil --expand "${pkgPath}" "${expandDir}"`, (error) => {
                const duration = Date.now() - startTime;
                
                if (error) {
                    resolve({
                        success: false,
                        message: `Failed to expand PKG: ${error.message}`,
                        duration
                    });
                    return;
                }

                // Check structure
                const appPath = path.join(expandDir, 'Applications', 'VibeCode.app');
                const infoPlist = path.join(appPath, 'Contents', 'Info.plist');
                
                if (fs.existsSync(appPath) && fs.existsSync(infoPlist)) {
                    resolve({
                        success: true,
                        message: 'PKG contains valid app bundle structure',
                        duration
                    });
                } else {
                    resolve({
                        success: false,
                        message: 'PKG missing required app bundle files',
                        duration
                    });
                }
            });
        });
    }

    async testThemeConfiguration() {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const configPath = path.join(process.env.HOME, '.config', 'code-server', 'user-data', 'User', 'settings.json');
            
            if (!fs.existsSync(configPath)) {
                resolve({
                    success: false,
                    message: 'code-server settings file not found',
                    duration: Date.now() - startTime
                });
                return;
            }

            try {
                const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                const hasTheme = settings['workbench.colorTheme'];
                const hasStartupEditor = settings['workbench.startupEditor'] === 'none';
                const hasWelcomeDisabled = settings['workbench.welcome.enabled'] === false;
                
                if (hasTheme && hasStartupEditor && hasWelcomeDisabled) {
                    resolve({
                        success: true,
                        message: `Theme configured: ${hasTheme}, startup editor disabled, welcome disabled`,
                        duration: Date.now() - startTime
                    });
                } else {
                    resolve({
                        success: false,
                        message: 'Theme configuration incomplete',
                        duration: Date.now() - startTime
                    });
                }
            } catch (error) {
                resolve({
                    success: false,
                    message: `Failed to parse settings: ${error.message}`,
                    duration: Date.now() - startTime
                });
            }
        });
    }

    async runAllTests() {
        console.log('🚀 Starting VibeCode Unit Test Suite');
        console.log('=====================================\n');

        // Ensure test directory exists
        if (!fs.existsSync(this.testDir)) {
            fs.mkdirSync(this.testDir, { recursive: true });
        }

        // Core functionality tests
        await this.runTest('code-server Availability', () => this.testCodeServerAvailability());
        await this.runTest('code-server Content', () => this.testCodeServerContent());
        await this.runTest('Theme Configuration', () => this.testThemeConfiguration());

        // App tests (if apps are running)
        await this.runTest('Tauri App Process', () => this.testAppProcess('vibecode'));
        await this.runTest('Electron App Process', () => this.testAppProcess('VibeCode Electron'));

        // PKG tests (if available)
        const pkgPath = '/tmp/vibecode-test/VibeCode-1.2.0.pkg';
        if (fs.existsSync(pkgPath)) {
            await this.runTest('PKG Structure', () => this.testPKGStructure(pkgPath));
        }

        // Generate report
        this.generateReport();
    }

    generateReport() {
        console.log('\n📊 Test Results Summary');
        console.log('=======================');
        console.log(`Total Tests: ${this.results.summary.total}`);
        console.log(`Passed: ${this.results.summary.passed}`);
        console.log(`Failed: ${this.results.summary.failed}`);
        console.log(`Success Rate: ${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%`);
        
        console.log('\n📋 Detailed Results:');
        this.results.tests.forEach(test => {
            const status = test.status === 'PASS' ? '✅' : '❌';
            console.log(`   ${status} ${test.name}: ${test.message}`);
        });

        // Save results
        const resultsFile = path.join(this.testDir, 'unit-test-results.json');
        fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
        console.log(`\n💾 Results saved to: ${resultsFile}`);

        // Exit with appropriate code
        process.exit(this.results.summary.failed > 0 ? 1 : 0);
    }
}

// Run the test suite
if (require.main === module) {
    const testSuite = new VibeCodeTestSuite();
    testSuite.runAllTests().catch(console.error);
}

module.exports = VibeCodeTestSuite;
