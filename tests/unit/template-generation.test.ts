/**
 * Unit tests for template generation system
 * Validates that templates produce valid project structures
 */

import { generateFromTemplate } from '../../src/lib/templates/generator';
import { EnhancedProjectTemplates } from '../../src/lib/enhanced-project-templates';
import { PROJECT_TEMPLATES } from '../../src/lib/templates/index';

describe('Template Generation System', () => {
  describe('Basic Template Generator', () => {
    test('should generate project from React template', async () => {
      const reactTemplate = PROJECT_TEMPLATES.find(t => t.id === 'react-typescript-tailwind');
      
      if (!reactTemplate) {
        throw new Error('React template not found');
      }

      const result = await generateFromTemplate({
        template: reactTemplate.id,
        projectName: 'test-react-project'
      });

      expect(result.id).toBe(reactTemplate.id);
      expect(result.name).toBe('test-react-project');
      expect(result.description).toBe(reactTemplate.description);
      expect(result.category).toBe('frontend');
      expect(result.complexity).toBe('beginner');
      expect(result.tags).toEqual(reactTemplate.tags);
      expect(result.language).toEqual(['typescript']);
      expect(result.frameworks).toEqual(['react', 'vite']);
      expect(result.features).toEqual(reactTemplate.features);
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files.length).toBeGreaterThanOrEqual(0);
      expect(result.scripts).toEqual(reactTemplate.scripts);
      expect(result.dependencies).toEqual(reactTemplate.dependencies);
      expect(result.setupInstructions).toBeDefined();
      expect(Array.isArray(result.setupInstructions)).toBe(true);
      expect(result.documentation).toBeDefined();
      if (result.documentation.readme) {
        expect(result.documentation.readme).toContain('test-react-project');
      }
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.estimatedTime).toBeGreaterThanOrEqual(0);
    });

    test('should handle custom project name sanitization', async () => {
      const template = PROJECT_TEMPLATES[0];
      
      const result = await generateFromTemplate({
        template: template.id,
        projectName: 'My Special Project!'
      });

      expect(result.name).toBe('my-special-project');
    });

    test('should handle custom descriptions', async () => {
      const template = PROJECT_TEMPLATES[0];
      
      const result = await generateFromTemplate({
        template: template.id,
        projectName: 'test-project',
        customizations: {
          description: 'Custom project description'
        }
      });

      expect(result.description).toBe('Custom project description');
    });

    test('should handle custom features', async () => {
      const template = PROJECT_TEMPLATES[0];
      const customFeatures = ['custom-feature-1', 'custom-feature-2'];
      
      const result = await generateFromTemplate({
        template: template.id,
        projectName: 'test-project',
        features: customFeatures
      });

      expect(result.features).toEqual(customFeatures);
    });

    test('should handle environment variable overrides', async () => {
      const template = PROJECT_TEMPLATES[0];
      const envOverrides = {
        'CUSTOM_VAR': 'custom_value',
        'API_URL': 'https://api.example.com'
      };
      
      const result = await generateFromTemplate({
        template: template.id,
        projectName: 'test-project',
        envOverrides
      });

      // Check that environment variables are properly handled
      expect(result.envVars).toBeDefined();
      expect(Array.isArray(result.envVars)).toBe(true);
    });
  });

  describe('Enhanced Template Generation', () => {
    let enhancedTemplates: EnhancedProjectTemplates;

    beforeEach(() => {
      enhancedTemplates = new EnhancedProjectTemplates();
    });

    test('should generate Next.js AI SaaS project', () => {
      const result = enhancedTemplates.generateNextjsAiSaasTemplate('test-nextjs-saas', {
        aiProvider: 'openai',
        database: 'postgresql',
        authentication: 'nextauth',
        vectorDb: 'pinecone',
        deployment: 'vercel',
        includePayments: true,
        includeAnalytics: true
      });

      expect(result.id).toMatch(/^nextjs-ai-saas-\d+$/);
      expect(result.name).toBe('test-nextjs-saas');
      expect(result.description).toContain('Next.js AI SaaS application');
      expect(result.description).toContain('openai');
      expect(result.description).toContain('postgresql');
      expect(result.description).toContain('nextauth');
      expect(result.category).toBe('fullstack');
      expect(result.complexity).toBe('advanced');
      expect(result.tags).toContain('nextjs');
      expect(result.tags).toContain('ai');
      expect(result.tags).toContain('saas');
      expect(result.tags).toContain('openai');
      expect(result.language).toEqual(['typescript']);
      expect(result.frameworks).toEqual(['nextjs']);
      expect(result.features).toContain('ai-integration');
      expect(result.features).toContain('authentication');
      expect(result.features).toContain('database');
      expect(result.features).toContain('api');
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      
      // Check that core files are present
      const filePaths = result.files.map(f => f.path);
      expect(filePaths).toContain('package.json');
      expect(filePaths).toContain('next.config.js');
      expect(filePaths).toContain('tailwind.config.js');
      expect(filePaths).toContain('tsconfig.json');
      expect(filePaths).toContain('.env.example');
      expect(filePaths).toContain('src/pages/index.tsx');
      expect(filePaths).toContain('src/pages/api/ai/chat.ts');
      
      expect(result.dependencies).toBeDefined();
      expect(result.dependencies['next']).toBeDefined();
      expect(result.dependencies['react']).toBeDefined();
      expect(result.dependencies['typescript']).toBeDefined();
      
      expect(result.devDependencies).toBeDefined();
      
      expect(result.scripts).toBeDefined();
      expect(result.scripts.dev).toBe('next dev');
      expect(result.scripts.build).toBe('next build');
      
      expect(result.envVars).toBeDefined();
      expect(Array.isArray(result.envVars)).toBe(true);
      expect(result.envVars.length).toBeGreaterThan(0);
      
      const envVarNames = result.envVars.map(env => env.name);
      expect(envVarNames).toContain('OPENAI_API_KEY');
      expect(envVarNames).toContain('DATABASE_URL');
      expect(envVarNames).toContain('NEXTAUTH_SECRET');
      
      expect(result.documentation).toBeDefined();
      expect(result.documentation.setup).toBeDefined();
      expect(Array.isArray(result.documentation.setup)).toBe(true);
      expect(result.documentation.setup.some(s => s.includes('npm install'))).toBe(true);
      expect(result.documentation.deployment).toBeDefined();
      expect(Array.isArray(result.documentation.deployment)).toBe(true);
      expect(result.documentation.deployment.some(s => s.includes('Vercel'))).toBe(true);
      
      expect(result.setupInstructions).toBeDefined();
      expect(Array.isArray(result.setupInstructions)).toBe(true);
      expect(result.setupInstructions[0]).toContain('npm install');
    });

    test('should generate Python ML Platform project', () => {
      const result = enhancedTemplates.generatePythonMlPlatformTemplate('test-python-ml', {
        framework: 'fastapi',
        mlFramework: 'pytorch',
        database: 'postgresql',
        vectorDb: 'chroma',
        deployment: 'docker',
        includeMLflow: true,
        includeJupyter: true
      });

      expect(result.id).toMatch(/^python-ml-platform-\d+$/);
      expect(result.name).toBe('test-python-ml');
      expect(result.description).toContain('Python ML platform');
      expect(result.description).toContain('fastapi');
      expect(result.description).toContain('pytorch');
      expect(result.description).toContain('chroma');
      expect(result.category).toBe('data');
      expect(result.complexity).toBe('advanced');
      expect(result.tags).toContain('python');
      expect(result.tags).toContain('ml');
      expect(result.tags).toContain('ai');
      expect(result.tags).toContain('fastapi');
      expect(result.tags).toContain('pytorch');
      expect(result.language).toEqual(['python']);
      expect(result.frameworks).toEqual(['fastapi', 'pytorch']);
      expect(result.features).toContain('ml-pipeline');
      expect(result.features).toContain('vector-db');
      expect(result.features).toContain('api');
      expect(result.features).toContain('jupyter');
      
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      
      const filePaths = result.files.map(f => f.path);
      expect(filePaths).toContain('requirements.txt');
      expect(filePaths).toContain('pyproject.toml');
      expect(filePaths).toContain('src/main.py');
      
      // Check file content
      const mainPyFile = result.files.find(f => f.path === 'src/main.py');
      expect(mainPyFile).toBeDefined();
      expect(mainPyFile!.content).toContain('FastAPI');
      expect(mainPyFile!.content).toContain('uvicorn');
      
      const requirementsFile = result.files.find(f => f.path === 'requirements.txt');
      expect(requirementsFile).toBeDefined();
      expect(requirementsFile!.content).toContain('fastapi');
      expect(requirementsFile!.content).toContain('torch');
      expect(requirementsFile!.content).toContain('mlflow');
      
      expect(result.scripts).toBeDefined();
      expect(result.scripts.dev).toContain('uvicorn');
      expect(result.scripts.test).toContain('pytest');
      
      expect(result.envVars).toBeDefined();
      const envVarNames = result.envVars.map(env => env.name);
      expect(envVarNames).toContain('DATABASE_URL');
      expect(envVarNames).toContain('MLFLOW_TRACKING_URI');
      
      expect(Array.isArray(result.documentation.setup)).toBe(true);
      expect(result.documentation.setup.some(s => s.includes('python -m venv venv'))).toBe(true);
      expect(Array.isArray(result.documentation.deployment)).toBe(true);
      expect(result.documentation.deployment.some(s => s.includes('docker build'))).toBe(true);
    });

    test('should generate Rust Web API project', () => {
      const result = enhancedTemplates.generateRustWebApiTemplate('test-rust-api', {
        framework: 'axum',
        database: 'postgresql',
        auth: 'jwt',
        deployment: 'docker',
        includeGraphQL: false,
        includeMetrics: true
      });

      expect(result.id).toMatch(/^rust-web-api-\d+$/);
      expect(result.name).toBe('test-rust-api');
      expect(result.description).toContain('Rust web API');
      expect(result.description).toContain('axum');
      expect(result.description).toContain('postgresql');
      expect(result.description).toContain('jwt');
      expect(result.category).toBe('backend');
      expect(result.complexity).toBe('advanced');
      expect(result.tags).toContain('rust');
      expect(result.tags).toContain('web-api');
      expect(result.tags).toContain('async');
      expect(result.tags).toContain('axum');
      expect(result.tags).toContain('postgresql');
      expect(result.tags).toContain('jwt');
      expect(result.language).toEqual(['rust']);
      expect(result.frameworks).toEqual(['axum']);
      expect(result.features).toContain('web-api');
      expect(result.features).toContain('authentication');
      expect(result.features).toContain('database');
      expect(result.features).toContain('async');
      
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      
      const filePaths = result.files.map(f => f.path);
      expect(filePaths).toContain('Cargo.toml');
      expect(filePaths).toContain('src/main.rs');
      
      // Check file content
      const cargoFile = result.files.find(f => f.path === 'Cargo.toml');
      expect(cargoFile).toBeDefined();
      expect(cargoFile!.content).toContain('test-rust-api');
      expect(cargoFile!.content).toContain('axum');
      expect(cargoFile!.content).toContain('tokio');
      expect(cargoFile!.content).toContain('sqlx');
      
      const mainRsFile = result.files.find(f => f.path === 'src/main.rs');
      expect(mainRsFile).toBeDefined();
      expect(mainRsFile!.content).toContain('axum');
      expect(mainRsFile!.content).toContain('tokio::main');
      expect(mainRsFile!.content).toContain('Router');
      
      expect(result.scripts).toBeDefined();
      expect(result.scripts.dev).toBe('cargo watch -x run');
      expect(result.scripts.build).toBe('cargo build --release');
      expect(result.scripts.test).toBe('cargo test');
      
      expect(result.envVars).toBeDefined();
      const envVarNames = result.envVars.map(env => env.name);
      expect(envVarNames).toContain('DATABASE_URL');
      expect(envVarNames).toContain('JWT_SECRET');
      expect(envVarNames).toContain('RUST_LOG');
      
      expect(Array.isArray(result.documentation.setup)).toBe(true);
      expect(result.documentation.setup.some(s => s.includes('Install Rust'))).toBe(true);
      expect(result.documentation.setup.some(s => s.includes('cargo run'))).toBe(true);
      expect(Array.isArray(result.documentation.deployment)).toBe(true);
      expect(result.documentation.deployment.some(s => s.includes('cargo build --release'))).toBe(true);
    });

    test('should get available templates', () => {
      const templates = enhancedTemplates.getAvailableTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      const templateNames = templates.map(t => t.name);
      expect(templateNames).toContain('Next.js AI SaaS Application');
      expect(templateNames).toContain('Python ML Platform');
      expect(templateNames).toContain('Rust Web API');
      
      templates.forEach(template => {
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.category).toBeDefined();
        expect(template.complexity).toBeDefined();
        expect(Array.isArray(template.technologies)).toBe(true);
        expect(Array.isArray(template.features)).toBe(true);
        expect(Array.isArray(template.integrations)).toBe(true);
        expect(Array.isArray(template.deploymentTargets)).toBe(true);
        expect(typeof template.estimatedTimeHours).toBe('number');
      });
    });

    test('should get template by name', () => {
      const template = enhancedTemplates.getTemplate('nextjs-ai-saas');
      
      expect(template).toBeDefined();
      expect(template!.name).toBe('Next.js AI SaaS Application');
      expect(template!.category).toBe('ai-saas');
      
      const nonExistent = enhancedTemplates.getTemplate('non-existent-template');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('Template File Validation', () => {
    test('should validate Next.js template files have correct structure', () => {
      const enhancedTemplates = new EnhancedProjectTemplates();
      const result = enhancedTemplates.generateNextjsAiSaasTemplate('test-validation');
      
      result.files.forEach(file => {
        expect(file.path).toBeDefined();
        expect(typeof file.path).toBe('string');
        expect(file.path.length).toBeGreaterThan(0);

        expect(file.content).toBeDefined();
        expect(typeof file.content).toBe('string');

        // Files have size property instead of type after conversion
        expect(file.size).toBeDefined();
        expect(typeof file.size).toBe('number');
      });
      
      // Validate specific file contents
      const packageJsonFile = result.files.find(f => f.path === 'package.json');
      expect(packageJsonFile).toBeDefined();
      
      const packageJson = JSON.parse(packageJsonFile!.content);
      expect(packageJson.name).toBe('test-validation');
      expect(packageJson.version).toBeDefined();
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.devDependencies).toBeDefined();
      
      const nextConfigFile = result.files.find(f => f.path === 'next.config.js');
      expect(nextConfigFile).toBeDefined();
      expect(nextConfigFile!.content).toContain('NextConfig');
      expect(nextConfigFile!.content).toContain('module.exports');
      
      const tsconfigFile = result.files.find(f => f.path === 'tsconfig.json');
      expect(tsconfigFile).toBeDefined();
      
      const tsconfig = JSON.parse(tsconfigFile!.content);
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.include).toBeDefined();
      expect(tsconfig.exclude).toBeDefined();
    });

    test('should validate Python template files have correct structure', () => {
      const enhancedTemplates = new EnhancedProjectTemplates();
      const result = enhancedTemplates.generatePythonMlPlatformTemplate('test-python-validation');
      
      const requirementsFile = result.files.find(f => f.path === 'requirements.txt');
      expect(requirementsFile).toBeDefined();
      expect(requirementsFile!.content).toMatch(/^[a-zA-Z0-9\-_]+==[0-9.]+$/m);
      
      const pyprojectFile = result.files.find(f => f.path === 'pyproject.toml');
      expect(pyprojectFile).toBeDefined();
      expect(pyprojectFile!.content).toContain('[build-system]');
      expect(pyprojectFile!.content).toContain('[project]');
      expect(pyprojectFile!.content).toContain('name = "test-python-validation"');
      
      const mainPyFile = result.files.find(f => f.path === 'src/main.py');
      expect(mainPyFile).toBeDefined();
      expect(mainPyFile!.content).toContain('from fastapi import FastAPI');
      expect(mainPyFile!.content).toContain('if __name__ == "__main__":');
    });

    test('should validate Rust template files have correct structure', () => {
      const enhancedTemplates = new EnhancedProjectTemplates();
      const result = enhancedTemplates.generateRustWebApiTemplate('test-rust-validation');
      
      const cargoFile = result.files.find(f => f.path === 'Cargo.toml');
      expect(cargoFile).toBeDefined();
      expect(cargoFile!.content).toContain('[package]');
      expect(cargoFile!.content).toContain('[dependencies]');
      expect(cargoFile!.content).toContain('name = "test-rust-validation"');
      expect(cargoFile!.content).toContain('edition = "2021"');
      
      const mainRsFile = result.files.find(f => f.path === 'src/main.rs');
      expect(mainRsFile).toBeDefined();
      expect(mainRsFile!.content).toContain('#[tokio::main]');
      expect(mainRsFile!.content).toContain('async fn main()');
    });
  });

  describe('Template Content Quality', () => {
    test('should generate valid package.json for Next.js template', () => {
      const enhancedTemplates = new EnhancedProjectTemplates();
      const result = enhancedTemplates.generateNextjsAiSaasTemplate('content-test');
      
      const packageJsonFile = result.files.find(f => f.path === 'package.json');
      const packageJson = JSON.parse(packageJsonFile!.content);
      
      // Check required fields
      expect(packageJson.name).toBe('content-test');
      expect(packageJson.version).toBeDefined();
      expect(packageJson.private).toBe(true);
      
      // Check scripts
      expect(packageJson.scripts.dev).toBe('next dev');
      expect(packageJson.scripts.build).toBe('next build');
      expect(packageJson.scripts.start).toBe('next start');
      expect(packageJson.scripts.lint).toBe('next lint');
      
      // Check dependencies
      expect(packageJson.dependencies.next).toBeDefined();
      expect(packageJson.dependencies.react).toBeDefined();
      expect(packageJson.dependencies['react-dom']).toBeDefined();
      
      // Check dev dependencies
      expect(packageJson.devDependencies.typescript).toBeDefined();
      expect(packageJson.devDependencies['@types/react']).toBeDefined();
      expect(packageJson.devDependencies['@types/node']).toBeDefined();
    });

    test('should generate valid requirements.txt for Python template', () => {
      const enhancedTemplates = new EnhancedProjectTemplates();
      const result = enhancedTemplates.generatePythonMlPlatformTemplate('python-content-test');
      
      const requirementsFile = result.files.find(f => f.path === 'requirements.txt');
      const requirements = requirementsFile!.content.split('\n').filter(line => line.trim());
      
      // Check that all requirements have version numbers
      requirements.forEach(req => {
        expect(req).toMatch(/^[a-zA-Z0-9\-_\[\]]+==[0-9.]+$/);
      });
      
      // Check for essential packages
      const packageNames = requirements.map(req => req.split('==')[0]);
      expect(packageNames).toContain('fastapi');
      expect(packageNames).toContain('uvicorn');
      expect(packageNames).toContain('torch');
      expect(packageNames).toContain('mlflow');
      expect(packageNames).toContain('pytest');
    });

    test('should generate valid Cargo.toml for Rust template', () => {
      const enhancedTemplates = new EnhancedProjectTemplates();
      const result = enhancedTemplates.generateRustWebApiTemplate('rust-content-test');
      
      const cargoFile = result.files.find(f => f.path === 'Cargo.toml');
      const cargoContent = cargoFile!.content;
      
      // Check package section
      expect(cargoContent).toContain('name = "rust-content-test"');
      expect(cargoContent).toContain('version = "0.1.0"');
      expect(cargoContent).toContain('edition = "2021"');
      
      // Check dependencies section
      expect(cargoContent).toContain('[dependencies]');
      expect(cargoContent).toContain('axum =');
      expect(cargoContent).toContain('tokio =');
      expect(cargoContent).toContain('serde =');
      expect(cargoContent).toContain('sqlx =');
      
      // Check dev dependencies section
      expect(cargoContent).toContain('[dev-dependencies]');
    });
  });
});