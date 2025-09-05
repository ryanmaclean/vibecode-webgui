/**
 * Infrastructure Detection Utilities
 * Helper functions to detect available testing infrastructure and skip tests appropriately
 */

const { execSync } = require('child_process');

/**
 * Check if a command is available and working
 * @param {string} command - Command to test
 * @returns {boolean} - True if command works, false otherwise
 */
function checkCommand(command) {
  try {
    execSync(command, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if kubectl is available
 * @returns {boolean}
 */
function hasKubectl() {
  return checkCommand('kubectl version --client');
}

/**
 * Check if a Kubernetes cluster is accessible
 * @returns {boolean}
 */
function hasKubernetesCluster() {
  if (!hasKubectl()) return false;
  
  try {
    const clusterInfo = execSync('kubectl cluster-info --request-timeout=5s', { 
      encoding: 'utf8', 
      stdio: 'pipe',
      timeout: 10000 
    });
    return clusterInfo.includes('Kubernetes control plane') || clusterInfo.includes('Kubernetes master');
  } catch (error) {
    return false;
  }
}

/**
 * Check if KIND cluster is available
 * @returns {boolean}
 */
function hasKindCluster() {
  if (!hasKubernetesCluster()) return false;
  
  try {
    const clusterInfo = execSync('kubectl cluster-info --request-timeout=5s', { encoding: 'utf8', stdio: 'pipe' });
    return clusterInfo.includes('127.0.0.1') || clusterInfo.includes('localhost');
  } catch (error) {
    return false;
  }
}

/**
 * Check if running in CI environment
 * @returns {boolean}
 */
function isCiEnvironment() {
  return process.env.CI === 'true' || 
         process.env.GITHUB_ACTIONS === 'true' ||
         process.env.GITLAB_CI === 'true' ||
         process.env.JENKINS_URL !== undefined ||
         process.env.BUILDKITE === 'true';
}

/**
 * Check if helm is available
 * @returns {boolean}
 */
function hasHelm() {
  return checkCommand('helm version');
}

/**
 * Check if Docker is available and running
 * @returns {boolean}
 */
function hasDocker() {
  return checkCommand('docker version');
}

/**
 * Skip test if infrastructure requirements not met
 * @param {Object} requirements - Infrastructure requirements
 * @param {boolean} requirements.kubernetes - Requires Kubernetes cluster
 * @param {boolean} requirements.kind - Requires KIND cluster specifically
 * @param {boolean} requirements.helm - Requires Helm
 * @param {boolean} requirements.docker - Requires Docker
 * @param {string} testName - Name of test for skip message
 */
function skipIfInfrastructureUnavailable(requirements, testName = 'test') {
  const missing = [];
  
  if (requirements.kubernetes && !hasKubernetesCluster()) {
    missing.push('Kubernetes cluster');
  }
  
  if (requirements.kind && !hasKindCluster()) {
    missing.push('KIND cluster');
  }
  
  if (requirements.helm && !hasHelm()) {
    missing.push('Helm');
  }
  
  if (requirements.docker && !hasDocker()) {
    missing.push('Docker');
  }
  
  // Always skip infrastructure tests in CI unless explicitly enabled
  if (isCiEnvironment() && !process.env.ENABLE_INFRASTRUCTURE_TESTS) {
    missing.push('CI infrastructure tests disabled (set ENABLE_INFRASTRUCTURE_TESTS=true to enable)');
  }
  
  if (missing.length > 0) {
    const skipMessage = `Skipping ${testName}: Missing infrastructure - ${missing.join(', ')}`;
    console.log(`⏭️  ${skipMessage}`);
    return skipMessage;
  }
  
  return null;
}

/**
 * Jest describe wrapper that skips entire test suite if infrastructure unavailable
 * @param {string} title - Test suite title
 * @param {Object} requirements - Infrastructure requirements
 * @param {Function} testFn - Test function
 */
function describeWithInfrastructure(title, requirements, testFn) {
  const skipReason = skipIfInfrastructureUnavailable(requirements, title);
  
  if (skipReason) {
    describe.skip(title + ' - ' + skipReason, () => {
      test('skipped due to infrastructure requirements', () => {
        expect(true).toBe(true);
      });
    });
  } else {
    describe(title, testFn);
  }
}

module.exports = {
  checkCommand,
  hasKubectl,
  hasKubernetesCluster,
  hasKindCluster,
  isCiEnvironment,
  hasHelm,
  hasDocker,
  skipIfInfrastructureUnavailable,
  describeWithInfrastructure
};