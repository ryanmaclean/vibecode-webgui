/**
 * Project Template Generator
 * Generates project templates and scaffolds for VibeCode
 */

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  framework: string;
  category: 'web' | 'mobile' | 'desktop' | 'api' | 'cli' | 'library';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  features: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  files: TemplateFile[];
  setupInstructions: string[];
  documentation: {
    readme: string;
    gettingStarted: string;
    apiReference?: string;
  };
  createdAt: Date;
  estimatedTime: number;
}

export interface TemplateFile {
  path: string;
  content: string;
  executable?: boolean;
  template?: boolean; // Contains template variables
}

export interface GeneratedProject {
  id: string;
  name: string;
  description: string;
  language: string;
  framework: string;
  templateId: string;
  files: Array<{
    path: string;
    content: string;
    size: number;
  }>;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  createdAt: Date;
  metadata: {
    estimatedSetupTime: number;
    complexity: string;
    features: string[];
  };
}

export interface GenerationOptions {
  name: string;
  description?: string;
  language?: string;
  framework?: string;
  features?: string[];
  includeDocumentation?: boolean;
  includeTests?: boolean;
  includeCI?: boolean;
  customVariables?: Record<string, string>;
}

/**
 * Project Template Generator Service
 */
export class TemplateGenerator {
  private templates: Map<string, ProjectTemplate> = new Map();
  private generators: Map<string, (options: GenerationOptions) => GeneratedProject> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
    this.initializeGenerators();
  }

  /**
   * Register a project template
   */
  registerTemplate(template: ProjectTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: ProjectTemplate['category']): ProjectTemplate[] {
    return this.getAvailableTemplates().filter(template => template.category === category);
  }

  /**
   * Get templates by language
   */
  getTemplatesByLanguage(language: string): ProjectTemplate[] {
    return this.getAvailableTemplates().filter(template =>
      template.language.toLowerCase() === language.toLowerCase()
    );
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): ProjectTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Generate project from template
   */
  async generateProject(
    templateId: string,
    options: GenerationOptions
  ): Promise<GeneratedProject> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const generator = this.generators.get(templateId);
    if (!generator) {
      throw new Error(`No generator available for template: ${templateId}`);
    }

    try {
      const project = generator(options);

      // Apply custom variables if provided
      if (options.customVariables) {
        project.files = project.files.map(file => ({
          ...file,
          content: this.applyTemplateVariables(file.content, options.customVariables!)
        }));
      }

      // Add documentation if requested
      if (options.includeDocumentation) {
        project.files.push(...this.generateDocumentationFiles(project, template));
      }

      // Add tests if requested
      if (options.includeTests) {
        project.files.push(...this.generateTestFiles(project, template));
      }

      // Add CI/CD if requested
      if (options.includeCI) {
        project.files.push(...this.generateCIConfig(project, template));
      }

      return project;
    } catch (error) {
      logger.error(`Failed to generate project from template ${templateId}:`, error);
      throw new Error(`Project generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply template variables to content
   */
  private applyTemplateVariables(content: string, variables: Record<string, string>): string {
    let processedContent = content;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(regex, value);
    }

    return processedContent;
  }

  /**
   * Generate documentation files
   */
  private generateDocumentationFiles(project: GeneratedProject, template: ProjectTemplate): TemplateFile[] {
    const files: TemplateFile[] = [];

    // README.md
    files.push({
      path: 'README.md',
      content: `# ${project.name}

${project.description}

## Features

${project.metadata.features.map(feature => `- ${feature}`).join('\n')}

## Getting Started

${template.documentation.gettingStarted}

## Setup

${template.setupInstructions.map(instruction => `- ${instruction}`).join('\n')}

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Scripts

${Object.entries(project.scripts).map(([script, command]) => `- \`npm run ${script}\` - ${command}`).join('\n')}

## License

MIT
`
    });

    // API Reference (if applicable)
    if (template.documentation.apiReference) {
      files.push({
        path: 'API.md',
        content: template.documentation.apiReference
      });
    }

    return files;
  }

  /**
   * Generate test files
   */
  private generateTestFiles(project: GeneratedProject, template: ProjectTemplate): TemplateFile[] {
    const files: TemplateFile[] = [];

    if (project.language === 'typescript' || project.language === 'javascript') {
      files.push({
        path: 'src/__tests__/index.test.ts',
        content: `import { describe, test, expect } from '${project.framework === 'vitest' ? 'vitest' : 'jest'}';

// Example test
describe('${project.name}', () => {
  test('should work correctly', () => {
    expect(true).toBe(true);
  });
});
`
      });
    } else if (project.language === 'python') {
      files.push({
        path: 'tests/test_example.py',
        content: `import pytest

def test_example():
    """Example test for ${project.name}"""
    assert True
`
      });
    }

    return files;
  }

  /**
   * Generate CI/CD configuration
   */
  private generateCIConfig(project: GeneratedProject, template: ProjectTemplate): TemplateFile[] {
    const files: TemplateFile[] = [];

    if (project.language === 'typescript' || project.language === 'javascript') {
      files.push({
        path: '.github/workflows/ci.yml',
        content: `name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Build project
      run: npm run build

    - name: Run linting
      run: npm run lint
`
      });
    }

    return files;
  }

  /**
   * Initialize default project templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: ProjectTemplate[] = [
      {
        id: 'react-ts-vite',
        name: 'React TypeScript Vite',
        description: 'Modern React application with TypeScript and Vite',
        language: 'typescript',
        framework: 'react',
        category: 'web',
        complexity: 'intermediate',
        tags: ['react', 'typescript', 'vite', 'modern'],
        features: ['TypeScript', 'ESLint', 'Prettier', 'Vitest'],
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0'
        },
        devDependencies: {
          '@vitejs/plugin-react': '^4.0.0',
          'vite': '^4.4.0',
          'typescript': '^5.0.0',
          'vitest': '^0.34.0',
          'eslint': '^8.45.0',
          'prettier': '^3.0.0'
        },
        scripts: {
          'dev': 'vite',
          'build': 'tsc && vite build',
          'preview': 'vite preview',
          'test': 'vitest',
          'lint': 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0'
        },
        files: [
          {
            path: 'src/main.tsx',
            content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { logger } from '@/lib/logger';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
          },
          {
            path: 'src/App.tsx',
            content: `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <h1>Vite + React + TypeScript</h1>
      <div>
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </div>
  )
}

export default App`
          },
          {
            path: 'src/index.css',
            content: `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}`
          }
        ],
        setupInstructions: [
          'Install dependencies: npm install',
          'Start development server: npm run dev',
          'Open http://localhost:5173 in your browser'
        ],
        documentation: {
          readme: 'A modern React application built with Vite and TypeScript',
          gettingStarted: 'Get started by editing src/App.tsx'
        },
        createdAt: new Date(),
        estimatedTime: 30
      },
      {
        id: 'nextjs-ts',
        name: 'Next.js TypeScript',
        description: 'Full-stack Next.js application with TypeScript',
        language: 'typescript',
        framework: 'nextjs',
        category: 'web',
        complexity: 'advanced',
        tags: ['nextjs', 'typescript', 'fullstack', 'react'],
        features: ['App Router', 'TypeScript', 'Tailwind CSS', 'ESLint'],
        dependencies: {
          'next': '^14.0.0',
          'react': '^18.2.0',
          'react-dom': '^18.2.0'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'tailwindcss': '^3.3.0',
          'eslint': '^8.45.0',
          '@types/node': '^20.0.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0'
        },
        scripts: {
          'dev': 'next dev',
          'build': 'next build',
          'start': 'next start',
          'lint': 'next lint'
        },
        files: [
          {
            path: 'app/page.tsx',
            content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Get started by editing&nbsp;
          <code className="font-mono font-bold">app/page.tsx</code>
        </p>
      </div>
    </main>
  )
}`
          },
          {
            path: 'app/layout.tsx',
            content: `export const metadata = {
  title: 'Next.js',
  description: 'Generated by create next app',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`
          }
        ],
        setupInstructions: [
          'Install dependencies: npm install',
          'Start development server: npm run dev',
          'Open http://localhost:3000 in your browser'
        ],
        documentation: {
          readme: 'A full-stack Next.js application with TypeScript and Tailwind CSS',
          gettingStarted: 'Edit app/page.tsx to modify the home page'
        },
        createdAt: new Date(),
        estimatedTime: 45
      }
    ];

    defaultTemplates.forEach(template => this.registerTemplate(template));
  }

  /**
   * Initialize project generators
   */
  private initializeGenerators(): void {
    // React TypeScript Vite Generator
    this.generators.set('react-ts-vite', (options: GenerationOptions) => {
      const template = this.templates.get('react-ts-vite')!;
      const projectId = crypto.randomUUID();

      return {
        id: projectId,
        name: options.name,
        description: options.description || `Generated ${options.name} project`,
        language: 'typescript',
        framework: 'react',
        templateId: 'react-ts-vite',
        files: template.files.map(file => ({
          path: file.path,
          content: file.content,
          size: file.content.length
        })),
        dependencies: template.dependencies,
        scripts: template.scripts,
        createdAt: new Date(),
        metadata: {
          estimatedSetupTime: template.estimatedTime,
          complexity: template.complexity,
          features: template.features
        }
      };
    });

    // Next.js TypeScript Generator
    this.generators.set('nextjs-ts', (options: GenerationOptions) => {
      const template = this.templates.get('nextjs-ts')!;
      const projectId = crypto.randomUUID();

      return {
        id: projectId,
        name: options.name,
        description: options.description || `Generated ${options.name} project`,
        language: 'typescript',
        framework: 'nextjs',
        templateId: 'nextjs-ts',
        files: template.files.map(file => ({
          path: file.path,
          content: file.content,
          size: file.content.length
        })),
        dependencies: template.dependencies,
        scripts: template.scripts,
        createdAt: new Date(),
        metadata: {
          estimatedSetupTime: template.estimatedTime,
          complexity: template.complexity,
          features: template.features
        }
      };
    });
  }

  /**
   * Create a custom template
   */
  createCustomTemplate(
    name: string,
    description: string,
    language: string,
    framework: string,
    files: TemplateFile[]
  ): ProjectTemplate {
    const template: ProjectTemplate = {
      id: `custom-${Date.now()}`,
      name,
      description,
      language,
      framework,
      category: 'web',
      complexity: 'intermediate',
      tags: [language, framework],
      features: ['Custom template'],
      dependencies: {},
      devDependencies: {},
      scripts: {},
      files,
      setupInstructions: ['Follow the included documentation'],
      documentation: {
        readme: `# ${name}\n\n${description}`,
        gettingStarted: 'Refer to the project files for setup instructions'
      },
      createdAt: new Date(),
      estimatedTime: 60
    };

    this.registerTemplate(template);
    return template;
  }

  /**
   * Get template statistics
   */
  getTemplateStats(): {
    totalTemplates: number;
    templatesByCategory: Record<string, number>;
    templatesByLanguage: Record<string, number>;
    templatesByComplexity: Record<string, number>;
  } {
    const templates = this.getAvailableTemplates();
    const stats = {
      totalTemplates: templates.length,
      templatesByCategory: {} as Record<string, number>,
      templatesByLanguage: {} as Record<string, number>,
      templatesByComplexity: {} as Record<string, number>
    };

    templates.forEach(template => {
      stats.templatesByCategory[template.category] =
        (stats.templatesByCategory[template.category] || 0) + 1;
      stats.templatesByLanguage[template.language] =
        (stats.templatesByLanguage[template.language] || 0) + 1;
      stats.templatesByComplexity[template.complexity] =
        (stats.templatesByComplexity[template.complexity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Search templates by criteria
   */
  searchTemplates(criteria: {
    query?: string;
    language?: string;
    category?: ProjectTemplate['category'];
    complexity?: ProjectTemplate['complexity'];
    tags?: string[];
  }): ProjectTemplate[] {
    let templates = this.getAvailableTemplates();

    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      templates = templates.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (criteria.language) {
      templates = templates.filter(template =>
        template.language.toLowerCase() === criteria.language!.toLowerCase()
      );
    }

    if (criteria.category) {
      templates = templates.filter(template => template.category === criteria.category);
    }

    if (criteria.complexity) {
      templates = templates.filter(template => template.complexity === criteria.complexity);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      templates = templates.filter(template =>
        criteria.tags!.some(tag => template.tags.includes(tag))
      );
    }

    return templates;
  }
}

// Export singleton instance for global use
export const templateGenerator = new TemplateGenerator();
