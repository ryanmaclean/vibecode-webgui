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
 * Check if Helm chart dependencies are available (no 'missing' status)
 * @param {string} chartPath - Path to the Helm chart directory
 * @returns {boolean}
 */
function hasHelmDependencies(chartPath) {
  try {
    // 'helm dependency list' is read-only and safe; detect missing deps without mutating state
    const output = execSync(`helm dependency list ${chartPath}`, {
      encoding: 'utf8', stdio: 'pipe', timeout: 10000,
    });
    return !output.toLowerCase().includes('missing');
  } catch (_err) {
    return false;
  }
}

/**
 * Check if Docker is available and running
 * @returns {boolean}
 */
function hasDocker() {
  return checkCommand('docker version');
}

/**
 * Check if Datadog Chaos Disruption CRD is installed
 * @returns {boolean}
 */
function hasChaosCRDInstalled() {
  if (!hasKubectl()) return false;
  try {
    execSync('kubectl get crd disruptions.chaos.datadoghq.com -o name', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch (_err) {
    return false;
  }
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

  // Optional: ensure Helm chart dependencies are present
  if (requirements.helmDependenciesChartPath && !hasHelmDependencies(requirements.helmDependenciesChartPath)) {
    missing.push(`Helm chart dependencies missing for ${requirements.helmDependenciesChartPath}`);
  }
  
  // Optional: require Chaos Disruption CRD availability
  if (requirements.chaosCRD && !hasChaosCRDInstalled()) {
    missing.push('Datadog Chaos Disruption CRD');
  }
  
  if (requirements.docker && !hasDocker()) {
    missing.push('Docker');
  }
  
  // Always skip infrastructure tests in CI unless explicitly enabled
  if (isCiEnvironment() && !process.env.ENABLE_INFRASTRUCTURE_TESTS) {
    missing.push('CI infrastructure tests disabled (set ENABLE_INFRASTRUCTURE_TESTS=true to enable)');
  }

  // Optional: run a custom probe command that must return non-empty output
  if (requirements.probeCommand) {
    try {
      const out = execSync(requirements.probeCommand, { encoding: 'utf8', stdio: 'pipe', timeout: 8000 });
      if (!out || out.trim().length === 0) {
        missing.push('environment probe');
      }
    } catch (_err) {
      missing.push('environment probe');
    }
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
  hasHelmDependencies,
  hasDocker,
  hasChaosCRDInstalled,
  skipIfInfrastructureUnavailable,
  describeWithInfrastructure
};