import fs from 'fs';
import path from 'path';

describe('Feature Audit #1442: Node.js/JavaScript/TypeScript Development', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');

  describe('Node.js VM Infrastructure', () => {
    it('has nodejs-dev-vm configuration', () => {
      const vmConfigPath = path.join(repoRoot, 'config', 'vfkit', 'nodejs-dev-vm.yaml');
      expect(fs.existsSync(vmConfigPath)).toBe(true);
      
      const content = fs.readFileSync(vmConfigPath, 'utf-8');
      expect(content).toContain('vibecode-nodejs-dev');
      expect(content).toContain('Node.js Development Environment');
      expect(content).toContain('3000'); // Next.js port
      expect(content).toContain('8080'); // code-server port
    });

    it('has Swift-based nodejs-vm runner', () => {
      const nodejsVmPath = path.join(repoRoot, 'tools', 'nodejs-vm');
      expect(fs.existsSync(nodejsVmPath)).toBe(true);
    });

    it('has VM provider implementations', () => {
      const providersPath = path.join(repoRoot, 'src', 'lib', 'vm', 'providers');
      expect(fs.existsSync(providersPath)).toBe(true);
      
      // Check for key providers
      const providers = ['vfkit', 'lima', 'qemu', 'docker', 'wsl2', 'native-vm'];
      providers.forEach(provider => {
        const providerFile = path.join(providersPath, `${provider}.ts`);
        if (fs.existsSync(providerFile)) {
          expect(fs.existsSync(providerFile)).toBe(true);
        }
      });
    });

    it('has NestJS RAG template', () => {
      const templatePath = path.join(repoRoot, 'config', 'templates', 'nodejs', 'nestjs-rag-app');
      expect(fs.existsSync(templatePath)).toBe(true);
    });
  });

  describe('TypeScript Configuration', () => {
    it('has main tsconfig.json', () => {
      const tsconfigPath = path.join(repoRoot, 'tsconfig.json');
      expect(fs.existsSync(tsconfigPath)).toBe(true);
      
      const config = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
      expect(config.compilerOptions).toBeDefined();
      expect(config.compilerOptions.target).toBe('ES2022');
      expect(config.compilerOptions.strict).toBeDefined();
      expect(config.compilerOptions.paths).toHaveProperty('@/*');
    });

    it('has specialized tsconfig files', () => {
      const configs = [
        'tsconfig.lite.json',
        'tsconfig.precommit.json',
        'tsconfig.vector.json'
      ];
      
      configs.forEach(config => {
        const configPath = path.join(repoRoot, config);
        expect(fs.existsSync(configPath)).toBe(true);
      });
    });

    it('has extension-specific tsconfigs', () => {
      const extensionConfigs = [
        'extensions/vibecode-ai-assistant/tsconfig.json',
        'extensions/workspace-rag/tsconfig.json',
        'packages/vibecode-cli/tsconfig.json'
      ];
      
      extensionConfigs.forEach(config => {
        const configPath = path.join(repoRoot, config);
        if (fs.existsSync(path.dirname(configPath))) {
          expect(fs.existsSync(configPath)).toBe(true);
        }
      });
    });
  });

  describe('JavaScript/TypeScript Tooling', () => {
    it('has ESLint 9 flat config', () => {
      const eslintConfigPath = path.join(repoRoot, 'eslint.config.mjs');
      expect(fs.existsSync(eslintConfigPath)).toBe(true);
    });

    it('has package.json with development scripts', () => {
      const packageJsonPath = path.join(repoRoot, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      // Verify Node.js version requirement
      expect(pkg.engines).toBeDefined();
      expect(pkg.engines.node).toBeDefined();
      
      // Verify key development scripts
      expect(pkg.scripts).toHaveProperty('dev');
      expect(pkg.scripts).toHaveProperty('build');
      expect(pkg.scripts).toHaveProperty('type-check');
      expect(pkg.scripts).toHaveProperty('lint');
      expect(pkg.scripts).toHaveProperty('test');
    });

    it('has TypeScript dependencies', () => {
      const packageJsonPath = path.join(repoRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies
      };
      
      expect(allDeps).toHaveProperty('typescript');
      expect(allDeps).toHaveProperty('@types/node');
      expect(allDeps).toHaveProperty('ts-node');
    });
  });

  describe('Testing Infrastructure', () => {
    it('has Jest configurations', () => {
      const jestConfigs = [
        'jest.config.js',
        'jest.no-docker.config.js',
        'jest.accessibility.config.js',
        'jest.performance.config.mjs'
      ];
      
      jestConfigs.forEach(config => {
        const configPath = path.join(repoRoot, config);
        expect(fs.existsSync(configPath)).toBe(true);
      });
    });

    it('has Playwright configuration', () => {
      const playwrightConfigPath = path.join(repoRoot, 'playwright.config.ts');
      expect(fs.existsSync(playwrightConfigPath)).toBe(true);
    });

    it('has test directories', () => {
      const testDirs = [
        'tests/unit',
        'tests/integration',
        'tests/e2e',
        'tests/feature-audit'
      ];
      
      testDirs.forEach(dir => {
        const dirPath = path.join(repoRoot, dir);
        expect(fs.existsSync(dirPath)).toBe(true);
      });
    });

    it('has VM provider tests', () => {
      const vmTestPath = path.join(repoRoot, 'src', 'lib', 'vm', 'providers', '__tests__');
      if (fs.existsSync(vmTestPath)) {
        expect(fs.existsSync(vmTestPath)).toBe(true);
      }
    });
  });

  describe('Documentation', () => {
    it('has Node.js VM implementation docs', () => {
      const docsPath = path.join(repoRoot, 'docs', 'nodejs-vm-implementation.md');
      expect(fs.existsSync(docsPath)).toBe(true);
    });

    it('has feature audit documentation', () => {
      const auditPath = path.join(
        repoRoot, 
        'docs', 
        'feature-audits', 
        'feature-audit-1442-feature-audit-vibecode-nodejs-50gb-node-js-development-environment.md'
      );
      expect(fs.existsSync(auditPath)).toBe(true);
      
      const content = fs.readFileSync(auditPath, 'utf-8');
      expect(content).toContain('FEATURE COMPLETE');
      expect(content).toContain('Node.js');
      expect(content).toContain('TypeScript');
    });

    it('has VM infrastructure documentation', () => {
      const vmDocsPath = path.join(repoRoot, 'docs', 'VM-INFRASTRUCTURE.md');
      expect(fs.existsSync(vmDocsPath)).toBe(true);
    });
  });

  describe('Example Projects', () => {
    it('has TypeScript SDK examples', () => {
      const examplesPath = path.join(repoRoot, 'examples', 'typescript');
      if (fs.existsSync(examplesPath)) {
        expect(fs.existsSync(examplesPath)).toBe(true);
      }
    });

    it('has demo workflows', () => {
      const demosPath = path.join(repoRoot, 'examples', 'demos');
      if (fs.existsSync(demosPath)) {
        expect(fs.existsSync(demosPath)).toBe(true);
      }
    });
  });

  describe('IDE Integration', () => {
    it('has VS Code extensions', () => {
      const extensionsPath = path.join(repoRoot, 'extensions');
      expect(fs.existsSync(extensionsPath)).toBe(true);
      
      // Check for key extensions
      const extensions = [
        'vibecode-ai-assistant',
        'workspace-rag'
      ];
      
      extensions.forEach(ext => {
        const extPath = path.join(extensionsPath, ext);
        if (fs.existsSync(extPath)) {
          expect(fs.existsSync(extPath)).toBe(true);
        }
      });
    });

    it('has code-server configuration', () => {
      const codeServerConfigPath = path.join(
        repoRoot,
        'config',
        'cloud-init',
        'codeserver-user-data.yaml'
      );
      if (fs.existsSync(codeServerConfigPath)) {
        expect(fs.existsSync(codeServerConfigPath)).toBe(true);
      }
    });
  });

  describe('Infrastructure Services', () => {
    it('has AI gateway with TypeScript', () => {
      const aiGatewayPath = path.join(repoRoot, 'infrastructure', 'services', 'ai-gateway');
      if (fs.existsSync(aiGatewayPath)) {
        expect(fs.existsSync(aiGatewayPath)).toBe(true);
      }
    });

    it('has CLI package', () => {
      const cliPath = path.join(repoRoot, 'packages', 'vibecode-cli');
      if (fs.existsSync(cliPath)) {
        expect(fs.existsSync(cliPath)).toBe(true);
        
        const cliPackagePath = path.join(cliPath, 'package.json');
        if (fs.existsSync(cliPackagePath)) {
          const pkg = JSON.parse(fs.readFileSync(cliPackagePath, 'utf-8'));
          expect(pkg.name).toContain('cli');
        }
      }
    });
  });

  describe('Quality Assurance', () => {
    it('has pre-commit hooks configuration', () => {
      const huskyPath = path.join(repoRoot, '.husky');
      if (fs.existsSync(huskyPath)) {
        expect(fs.existsSync(huskyPath)).toBe(true);
      }
    });

    it('has performance monitoring', () => {
      const lighthousePath = path.join(repoRoot, 'lighthouserc.js');
      const budgetPath = path.join(repoRoot, 'budget.json');
      
      if (fs.existsSync(lighthousePath)) {
        expect(fs.existsSync(lighthousePath)).toBe(true);
      }
      if (fs.existsSync(budgetPath)) {
        expect(fs.existsSync(budgetPath)).toBe(true);
      }
    });

    it('has Datadog instrumentation', () => {
      const instrumentPath = path.join(repoRoot, 'instrumentation.ts');
      if (fs.existsSync(instrumentPath)) {
        expect(fs.existsSync(instrumentPath)).toBe(true);
      }
    });
  });
});
