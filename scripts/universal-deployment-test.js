#!/usr/bin/env node

/**
 * Universal VibeCode Deployment Testing Framework
 * Tests all deployment modes: local, docker, compose, KIND, kubernetes
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

class DeploymentTester {
    constructor() {
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.modes = ['local', 'docker', 'compose', 'kind', 'kubernetes'];
        this.currentMode = null;
    }

    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            error: '\x1b[31m',
            warning: '\x1b[33m',
            reset: '\x1b[0m'
        };
        const prefix = {
            info: '[INFO]',
            success: '[PASS]',
            error: '[FAIL]',
            warning: '[WARN]'
        };
        console.log(`${colors[type]}${prefix[type]}\x1b[0m ${message}`);
    }

    async runCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const result = execSync(command, {
                    encoding: 'utf8',
                    timeout: options.timeout || 30000,
                    ...options
                });
                resolve(result.trim());
            } catch (error) {
                if (options.allowFailure) {
                    resolve(null);
                } else {
                    reject(error);
                }
            }
        });
    }

    async checkUrl(url, expectedContent = null, timeout = 10000) {
        return new Promise((resolve) => {
            const client = url.startsWith('https') ? https : http;
            const req = client.get(url, { timeout }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (expectedContent) {
                        resolve(data.includes(expectedContent));
                    } else {
                        resolve(res.statusCode >= 200 && res.statusCode < 400);
                    }
                });
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => resolve(false));
        });
    }

    recordTest(testName, passed, details = '') {
        this.totalTests++;
        if (passed) {
            this.passedTests++;
            this.log(`${testName}${details ? ' - ' + details : ''}`, 'success');
        } else {
            this.failedTests++;
            this.log(`${testName}${details ? ' - ' + details : ''}`, 'error');
        }
        this.testResults.push({ mode: this.currentMode, test: testName, passed, details });
    }

    async testLocalDevelopment() {
        this.currentMode = 'local';
        this.log('Testing Local Development Mode...', 'info');

        // Check if package.json exists
        const packageExists = fs.existsSync('./package.json');
        this.recordTest('Package.json exists', packageExists);

        if (!packageExists) return;

        // Check dependencies installation
        const nodeModulesExists = fs.existsSync('./node_modules');
        this.recordTest('Dependencies installed', nodeModulesExists);

        // Try to build the project
        try {
            await this.runCommand('npm run build', { timeout: 120000 });
            this.recordTest('Build successful', true);
        } catch (error) {
            this.recordTest('Build successful', false, error.message.split('\n')[0]);
        }

        // Check if we can start dev server (non-blocking test)
        try {
            const devProcess = spawn('npm', ['run', 'dev'], { stdio: 'pipe' });
            
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    devProcess.kill();
                    resolve();
                }, 15000);

                devProcess.stdout.on('data', (data) => {
                    if (data.toString().includes('localhost:3000') || data.toString().includes('Ready')) {
                        clearTimeout(timeout);
                        devProcess.kill();
                        this.recordTest('Dev server starts', true);
                        resolve();
                    }
                });

                devProcess.on('error', () => {
                    clearTimeout(timeout);
                    this.recordTest('Dev server starts', false);
                    resolve();
                });
            });
        } catch (error) {
            this.recordTest('Dev server starts', false, 'Failed to start');
        }
    }

    async testDockerDevelopment() {
        this.currentMode = 'docker';
        this.log('Testing Docker Development Mode...', 'info');

        // Check if Docker is available
        try {
            await this.runCommand('docker --version');
            this.recordTest('Docker available', true);
        } catch (error) {
            this.recordTest('Docker available', false, 'Docker not installed');
            return;
        }

        // Check if Dockerfile exists
        const dockerfileExists = fs.existsSync('./Dockerfile') || fs.existsSync('./Dockerfile.dev');
        this.recordTest('Dockerfile exists', dockerfileExists);

        if (!dockerfileExists) return;

        // Try to build Docker image
        try {
            await this.runCommand('docker build -t vibecode-test .', { timeout: 300000 });
            this.recordTest('Docker build successful', true);

            // Try to run container
            try {
                const containerId = await this.runCommand(
                    'docker run -d -p 3001:3000 vibecode-test',
                    { timeout: 30000 }
                );
                this.recordTest('Docker container starts', true);

                // Wait a bit and test if service responds
                await new Promise(resolve => setTimeout(resolve, 5000));
                const responds = await this.checkUrl('http://localhost:3001');
                this.recordTest('Docker service responds', responds);

                // Cleanup
                await this.runCommand(`docker stop ${containerId}`, { allowFailure: true });
                await this.runCommand(`docker rm ${containerId}`, { allowFailure: true });
            } catch (error) {
                this.recordTest('Docker container starts', false);
            }

            // Cleanup image
            await this.runCommand('docker rmi vibecode-test', { allowFailure: true });
        } catch (error) {
            this.recordTest('Docker build successful', false, 'Build failed');
        }
    }

    async testDockerCompose() {
        this.currentMode = 'compose';
        this.log('Testing Docker Compose Mode...', 'info');

        // Check if docker-compose is available
        try {
            await this.runCommand('docker-compose --version');
            this.recordTest('Docker Compose available', true);
        } catch (error) {
            this.recordTest('Docker Compose available', false);
            return;
        }

        // Check if docker-compose.yml exists
        const composeExists = fs.existsSync('./docker-compose.yml');
        this.recordTest('docker-compose.yml exists', composeExists);

        if (!composeExists) return;

        try {
            // Start services
            await this.runCommand('docker-compose up -d', { timeout: 180000 });
            this.recordTest('Docker Compose services start', true);

            // Wait for services to be ready
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Check if main service responds
            const mainServiceResponds = await this.checkUrl('http://localhost:3000');
            this.recordTest('Main service responds', mainServiceResponds);

            // Check service health if health endpoint exists
            const healthResponds = await this.checkUrl('http://localhost:3000/health', 'healthy');
            this.recordTest('Health endpoint responds', healthResponds);

        } catch (error) {
            this.recordTest('Docker Compose services start', false);
        } finally {
            // Cleanup
            await this.runCommand('docker-compose down', { allowFailure: true, timeout: 60000 });
        }
    }

    async testKindDeployment() {
        this.currentMode = 'kind';
        this.log('Testing KIND Deployment Mode...', 'info');

        // Check if KIND is available
        try {
            await this.runCommand('kind version');
            this.recordTest('KIND available', true);
        } catch (error) {
            this.recordTest('KIND available', false);
            return;
        }

        // Check if kubectl is available
        try {
            await this.runCommand('kubectl version --client');
            this.recordTest('kubectl available', true);
        } catch (error) {
            this.recordTest('kubectl available', false);
            return;
        }

        const testClusterName = 'vibecode-universal-test';

        try {
            // Create KIND cluster
            await this.runCommand(`kind create cluster --name ${testClusterName}`, { timeout: 180000 });
            this.recordTest('KIND cluster created', true);

            // Check cluster is accessible
            await this.runCommand(`kubectl cluster-info --context kind-${testClusterName}`);
            this.recordTest('Cluster accessible', true);

            // Check if we have Helm charts
            if (fs.existsSync('./helm/vibecode-platform')) {
                try {
                    // Try to deploy with Helm
                    await this.runCommand('helm version'); // Check Helm availability
                    await this.runCommand(
                        `helm install vibecode-test ./helm/vibecode-platform --wait --timeout=300s`,
                        { timeout: 320000 }
                    );
                    this.recordTest('Helm deployment successful', true);

                    // Check if pods are running
                    const pods = await this.runCommand('kubectl get pods --no-headers');
                    const runningPods = pods.split('\n').filter(line => line.includes('Running')).length;
                    this.recordTest('Pods running', runningPods > 0, `${runningPods} pods running`);

                } catch (error) {
                    this.recordTest('Helm deployment successful', false);
                }
            } else {
                this.log('No Helm charts found, skipping Helm deployment test', 'warning');
            }

        } catch (error) {
            this.recordTest('KIND cluster created', false);
        } finally {
            // Cleanup
            await this.runCommand(`kind delete cluster --name ${testClusterName}`, { allowFailure: true });
        }
    }

    async testKubernetesDeployment() {
        this.currentMode = 'kubernetes';
        this.log('Testing Kubernetes Deployment Mode...', 'info');

        // Check if kubectl is available and connected
        try {
            await this.runCommand('kubectl cluster-info', { timeout: 10000 });
            this.recordTest('Kubernetes cluster accessible', true);
        } catch (error) {
            this.recordTest('Kubernetes cluster accessible', false, 'No cluster or kubectl not configured');
            return;
        }

        // Check if we have Kubernetes manifests
        const k8sDir = './k8s';
        if (fs.existsSync(k8sDir)) {
            const manifestFiles = fs.readdirSync(k8sDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
            this.recordTest('Kubernetes manifests exist', manifestFiles.length > 0, `${manifestFiles.length} manifests`);

            if (manifestFiles.length > 0) {
                try {
                    // Create test namespace
                    await this.runCommand('kubectl create namespace vibecode-universal-test', { allowFailure: true });
                    
                    // Apply manifests
                    await this.runCommand(`kubectl apply -f ${k8sDir}/ -n vibecode-universal-test`);
                    this.recordTest('Manifests apply successfully', true);

                    // Check deployment status
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    const deployments = await this.runCommand('kubectl get deployments -n vibecode-universal-test --no-headers', { allowFailure: true });
                    if (deployments) {
                        this.recordTest('Deployments created', true, deployments.split('\n').length + ' deployments');
                    }

                } catch (error) {
                    this.recordTest('Manifests apply successfully', false);
                } finally {
                    // Cleanup
                    await this.runCommand('kubectl delete namespace vibecode-universal-test', { allowFailure: true });
                }
            }
        } else {
            this.recordTest('Kubernetes manifests exist', false, 'No k8s directory found');
        }
    }

    async runAllTests() {
        this.log('Starting Universal VibeCode Deployment Testing...', 'info');
        this.log('', 'info');

        const testMethods = [
            this.testLocalDevelopment,
            this.testDockerDevelopment,
            this.testDockerCompose,
            this.testKindDeployment,
            this.testKubernetesDeployment
        ];

        for (const testMethod of testMethods) {
            try {
                await testMethod.call(this);
            } catch (error) {
                this.log(`Error in ${testMethod.name}: ${error.message}`, 'error');
            }
            this.log('', 'info'); // Empty line between test modes
        }

        this.printSummary();
    }

    printSummary() {
        this.log('='.repeat(60), 'info');
        this.log('UNIVERSAL DEPLOYMENT TEST RESULTS', 'info');
        this.log('='.repeat(60), 'info');
        
        this.log(`Total Tests: ${this.totalTests}`, 'info');
        this.log(`Passed: ${this.passedTests}`, 'success');
        this.log(`Failed: ${this.failedTests}`, 'error');
        this.log(`Success Rate: ${Math.round((this.passedTests / this.totalTests) * 100)}%`, 'info');

        this.log('', 'info');
        this.log('DEPLOYMENT MODE SUMMARY:', 'info');
        this.log('-'.repeat(40), 'info');

        const modeResults = {};
        this.testResults.forEach(result => {
            if (!modeResults[result.mode]) {
                modeResults[result.mode] = { passed: 0, failed: 0 };
            }
            if (result.passed) {
                modeResults[result.mode].passed++;
            } else {
                modeResults[result.mode].failed++;
            }
        });

        Object.keys(modeResults).forEach(mode => {
            const { passed, failed } = modeResults[mode];
            const total = passed + failed;
            const rate = Math.round((passed / total) * 100);
            const status = rate === 100 ? 'FULLY WORKING' : 
                          rate >= 75 ? 'MOSTLY WORKING' : 
                          rate >= 50 ? 'PARTIALLY WORKING' : 'NOT WORKING';
            
            this.log(`${mode.toUpperCase().padEnd(15)} ${status.padEnd(20)} (${passed}/${total} - ${rate}%)`, 
                     rate === 100 ? 'success' : rate >= 50 ? 'warning' : 'error');
        });

        if (this.failedTests > 0) {
            this.log('', 'info');
            this.log('FAILED TESTS:', 'error');
            this.log('-'.repeat(40), 'info');
            this.testResults
                .filter(r => !r.passed)
                .forEach(r => this.log(`${r.mode}: ${r.test} - ${r.details}`, 'error'));
        }

        this.log('', 'info');
        this.log('RECOMMENDATIONS:', 'info');
        this.log('-'.repeat(40), 'info');

        if (modeResults.local && modeResults.local.passed === 0) {
            this.log('- Run "npm install" to fix local development', 'warning');
        }
        if (modeResults.docker && modeResults.docker.failed > 0) {
            this.log('- Check Docker installation and Dockerfile configuration', 'warning');
        }
        if (modeResults.compose && modeResults.compose.failed > 0) {
            this.log('- Verify docker-compose.yml and service configurations', 'warning');
        }
        if (modeResults.kind && modeResults.kind.failed > 0) {
            this.log('- Install KIND and Helm for local Kubernetes testing', 'warning');
        }
        if (modeResults.kubernetes && modeResults.kubernetes.failed > 0) {
            this.log('- Ensure kubectl is configured and cluster is accessible', 'warning');
        }
    }
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log('Universal VibeCode Deployment Tester');
    console.log('Usage: node scripts/universal-deployment-test.js [options]');
    console.log('\nOptions:');
    console.log('  --mode <mode>     Test specific mode only (local|docker|compose|kind|kubernetes)');
    console.log('  --help, -h        Show this help message');
    console.log('\nExamples:');
    console.log('  node scripts/universal-deployment-test.js');
    console.log('  node scripts/universal-deployment-test.js --mode local');
    process.exit(0);
}

// Run tests
async function main() {
    const tester = new DeploymentTester();
    
    const modeIndex = args.indexOf('--mode');
    if (modeIndex !== -1 && args[modeIndex + 1]) {
        const targetMode = args[modeIndex + 1];
        const methodName = `test${targetMode.charAt(0).toUpperCase() + targetMode.slice(1)}Development`;
        
        if (targetMode === 'kind') {
            await tester.testKindDeployment();
        } else if (targetMode === 'kubernetes') {
            await tester.testKubernetesDeployment();
        } else if (targetMode === 'compose') {
            await tester.testDockerCompose();
        } else if (typeof tester[methodName] === 'function') {
            await tester[methodName]();
        } else {
            console.error(`Unknown mode: ${targetMode}`);
            process.exit(1);
        }
    } else {
        await tester.runAllTests();
    }
}

main().catch(error => {
    console.error('Test framework error:', error);
    process.exit(1);
});