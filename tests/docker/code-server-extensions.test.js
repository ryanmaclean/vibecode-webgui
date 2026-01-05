/**
 * Tests for code-server extensions
 * Verifies all required extensions are installed in the Docker image
 */

const { execSync } = require('child_process');

const HAS_DOCKER = process.env.SKIP_DOCKER_TESTS !== '1';

// Helper to check if docker is available
function isDockerAvailable() {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

(HAS_DOCKER ? describe : describe.skip)('Code-Server Extensions', () => {
  const IMAGE_NAME = 'vibecode/code-server:latest';
  let containerName;
  let containerAvailable = false;

  beforeAll(() => {
    // Verify Docker is available
    if (HAS_DOCKER && !isDockerAvailable()) {
      console.warn('Docker is not available. Skipping code-server extension tests.');
      return;
    }

    // Check if image exists, if not, skip tests
    try {
      execSync(`docker image inspect ${IMAGE_NAME}`, { stdio: 'pipe' });
    } catch (error) {
      console.warn(`Docker image ${IMAGE_NAME} not found. Skipping code-server extension tests.`);
      console.warn('To run these tests, build the image first: docker build -t ${IMAGE_NAME} .');
      return;
    }

    // Start a test container
    containerName = `code-server-test-${Date.now()}`;
    try {
      execSync(
        `docker run -d --name ${containerName} ${IMAGE_NAME} tail -f /dev/null`,
        { stdio: 'pipe' }
      );
      // Wait for container to be ready
      execSync('sleep 3');
      containerAvailable = true;
    } catch (error) {
      console.error('Failed to start test container:', error.message);
      containerAvailable = false;
    }
  });

  afterAll(() => {
    // Cleanup
    if (containerName) {
      try {
        execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
        execSync(`docker rm ${containerName}`, { stdio: 'pipe' });
      } catch (error) {
        console.error('Failed to cleanup container:', error.message);
      }
    }
  });

  const testExtension = (extensionId, extensionName) => {
    test(`should have ${extensionName} installed`, () => {
      if (!containerAvailable) {
        console.log(`Skipping ${extensionName} test - container not available`);
        return;
      }

      try {
        const output = execSync(
          `docker exec ${containerName} code-server --list-extensions`,
          { encoding: 'utf-8' }
        );
        expect(output).toContain(extensionId);
      } catch (error) {
        throw new Error(`Extension ${extensionName} (${extensionId}) not found`);
      }
    });
  };

  describe('AI Coding Assistants', () => {
    testExtension('continue.continue', 'Continue');
    testExtension('codeium.codeium', 'Codeium');
    testExtension('saoudrizwan.claude-dev', 'Cline (Claude Dev)');
    testExtension('aider.aider-vscode', 'Aider');
  });

  describe('Productivity Tools', () => {
    testExtension('usernamehw.errorlens', 'Error Lens');
    testExtension('streetsidesoftware.code-spell-checker', 'Code Spell Checker');
    testExtension('wayou.vscode-todo-highlight', 'TODO Highlight');
    testExtension('gruntfuggly.todo-tree', 'TODO Tree');
    testExtension('pkief.material-icon-theme', 'Material Icon Theme');
    testExtension('oderwat.indent-rainbow', 'Indent Rainbow');
    testExtension('christian-kohler.path-intellisense', 'Path Intellisense');
  });

  describe('Database Tools', () => {
    testExtension('mtxr.sqltools', 'SQLTools');
    testExtension('mtxr.sqltools-driver-pg', 'SQLTools PostgreSQL Driver');
  });

  describe('DevOps Tools', () => {
    testExtension('ms-azuretools.vscode-docker', 'Docker');
    testExtension('ms-kubernetes-tools.vscode-kubernetes-tools', 'Kubernetes');
    testExtension('humao.rest-client', 'REST Client');
  });

  describe('Documentation Tools', () => {
    testExtension('yzhang.markdown-all-in-one', 'Markdown All in One');
    testExtension('davidanson.vscode-markdownlint', 'Markdown Lint');
  });

  describe('Language Support', () => {
    testExtension('ms-python.python', 'Python');
    testExtension('ms-python.vscode-pylance', 'Pylance');
    testExtension('ms-python.black-formatter', 'Black Formatter');
    testExtension('ms-vscode.vscode-typescript-next', 'TypeScript');
    testExtension('ms-vscode.vscode-eslint', 'ESLint');
  });

  describe('Remote Development', () => {
    testExtension('ms-vscode-remote.remote-ssh', 'Remote SSH');
    testExtension('ms-vscode-remote.remote-containers', 'Remote Containers');
  });

  test('should have all LSP servers installed', () => {
    if (!containerAvailable) {
      console.log('Skipping LSP servers test - container not available');
      return;
    }

    const commands = [
      'which pylsp',
      'which typescript-language-server',
      'which rust-analyzer',
      'which gopls',
      'which bash-language-server',
      'which dockerfile-language-server-nodejs',
    ];

    commands.forEach((cmd) => {
      try {
        execSync(`docker exec ${containerName} ${cmd}`, { stdio: 'pipe' });
      } catch (error) {
        throw new Error(`LSP server not found: ${cmd}`);
      }
    });
  });
});
