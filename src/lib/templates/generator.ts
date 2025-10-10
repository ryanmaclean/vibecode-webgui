/**
 * Template generation utilities for scaffolding projects
 */

import { ProjectTemplate, TemplateFile } from './index'
import { getTemplateById } from './index'

export interface GenerateFromTemplateOptions {
  projectName: string
  template: string
  customizations?: {
    packageName?: string
    description?: string
    author?: string
    license?: string
    gitRepository?: string
  }
  features?: string[]
  envOverrides?: Record<string, string>
}

export interface GeneratedProject {
  id: string
  name: string
  description: string
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'data' | 'infrastructure'
  complexity: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  language: string[] // matches ProjectTemplate
  frameworks: string[] // matches ProjectTemplate
  features: string[]
  files: TemplateFile[]
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies?: Record<string, string>
  envVars: Array<{
    name: string
    value: string
    description: string
  }>
  setupInstructions: string[]
  documentation: {
    readme: string
    setup: string
    deployment: string
  }
  createdAt: Date
  estimatedTime: number
}

/**
 * Generate a project from a template with customizations
 */
export async function generateFromTemplate(
  options: GenerateFromTemplateOptions
): Promise<GeneratedProject> {
  const template = getTemplateById(options.template)
  if (!template) {
    throw new Error(`Template "${options.template}" not found`)
  }

  const projectName = sanitizeProjectName(options.projectName)
  const packageName = options.customizations?.packageName || projectName
  
  // Generate template files with variable substitution
  const files = await generateTemplateFiles(template, {
    projectName,
    packageName,
    description: options.customizations?.description || template.description,
    author: options.customizations?.author || 'VibeCode User',
    license: options.customizations?.license || 'MIT',
    gitRepository: options.customizations?.gitRepository || ''
  })

  // Process environment variables with overrides
  const envVars = template.envVars.map(env => ({
    name: env.name,
    value: options.envOverrides?.[env.name] || env.defaultValue || '',
    description: env.description
  }))

  // Generate setup instructions
  const setupInstructions = generateSetupInstructions(template, projectName)

  return {
    id: template.id,
    name: projectName,
    description: options.customizations?.description || template.description,
    category: template.category,
    tags: template.tags,
    language: template.language,
    frameworks: template.frameworks,
    complexity: template.complexity,
    features: options.features || template.features,  // Use features from options if provided, otherwise from template
    files,
    scripts: { ...template.scripts },
    dependencies: { ...template.dependencies },
    devDependencies: template.devDependencies ? { ...template.devDependencies } : undefined,
    envVars,
    documentation: {
      readme: `# ${projectName}\n\n${template.description}`,
      setup: template.documentation.setup.join('\n'),
      deployment: template.documentation.deployment.join('\n')
    },
    createdAt: new Date(),
    estimatedTime: 30,
    setupInstructions,
  }
}

/**
 * Sanitize project name for use as directory/package name
 */
function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Generate template files with variable substitution
 */
async function generateTemplateFiles(
  template: ProjectTemplate,
  variables: {
    projectName: string
    packageName: string
    description: string
    author: string
    license: string
    gitRepository: string
  }
): Promise<TemplateFile[]> {
  const files: TemplateFile[] = []

  // Add template-specific files based on template ID
  switch (template.id) {
    case 'react-typescript-tailwind':
      files.push(...await generateReactTypeScriptFiles(variables))
      break
    case 'nextjs-app-router':
      files.push(...await generateNextJsFiles(variables))
      break
    case 'express-typescript-api':
      files.push(...await generateExpressApiFiles(variables))
      break
    case 'fastapi-python':
      files.push(...await generateFastApiFiles(variables))
      break
    case 'vue-composition-api':
      files.push(...await generateVueFiles(variables))
      break
    case 'mern-stack':
      files.push(...await generateMernStackFiles(variables))
      break
    case 'nextjs-supabase':
      files.push(...await generateNextJsSupabaseFiles(variables))
      break
    case 'react-native-expo':
      files.push(...await generateReactNativeFiles(variables))
      break
    case 'python-data-science':
      files.push(...await generateDataScienceFiles(variables))
      break
    case 'docker-microservices':
      files.push(...await generateMicroservicesFiles(variables))
      break
    case 'electron-desktop':
      files.push(...await generateElectronFiles(variables))
      break
    case 'graphql-api':
      files.push(...await generateGraphQLFiles(variables))
      break
    case 'flutter-app':
      files.push(...await generateFlutterFiles(variables))
      break
    case 'serverless-functions':
      files.push(...await generateServerlessFiles(variables))
      break
    case 'blockchain-dapp':
      files.push(...await generateBlockchainFiles(variables))
      break
    default:
      files.push(...await generateGenericFiles(template, variables))
  }

  return files
}

/**
 * Generate setup instructions for a template
 */
function generateSetupInstructions(
  template: ProjectTemplate,
  projectName: string
): string[] {
  const instructions = [
    `cd ${projectName}`,
    ...template.documentation.setup
  ]

  if (template.dockerSupport) {
    instructions.push('# Docker support available - see Dockerfile')
  }

  if (template.kubernetesSupport) {
    instructions.push('# Kubernetes manifests available in k8s/')
  }

  return instructions
}

// Template variables interface
export interface TemplateVariables {
  projectName: string
  packageName: string
  description: string
  author: string
  license: string
  gitRepository: string
}

// Template-specific file generators
async function generateReactTypeScriptFiles(variables: TemplateVariables): Promise<TemplateFile[]> {
  return [
    {
      path: 'package.json',
      type: 'file',
      content: JSON.stringify({
        name: variables.packageName,
        private: true,
        version: '0.0.0',
        description: variables.description,
        author: variables.author,
        license: variables.license,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          preview: 'vite preview',
          lint: 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
          format: 'prettier --write "src/**/*.{ts,tsx,js,jsx}"'
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        },
        devDependencies: {
          '@types/react': '^18.2.15',
          '@types/react-dom': '^18.2.7',
          '@typescript-eslint/eslint-plugin': '^6.0.0',
          '@typescript-eslint/parser': '^6.0.0',
          '@vitejs/plugin-react': '^4.0.3',
          autoprefixer: '^10.4.14',
          eslint: '^8.45.0',
          'eslint-plugin-react-hooks': '^4.6.0',
          'eslint-plugin-react-refresh': '^0.4.3',
          postcss: '^8.4.27',
          prettier: '^3.0.0',
          tailwindcss: '^3.3.3',
          typescript: '^5.0.2',
          vite: '^4.4.5'
        }
      }, null, 2)
    },
    {
      path: 'index.html',
      type: 'file',
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${variables.projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
    },
    {
      path: 'src/main.tsx',
      type: 'file',
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
    },
    {
      path: 'src/App.tsx',
      type: 'file',
      content: `import React from 'react'

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to ${variables.projectName}
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          ${variables.description}
        </p>
        <div className="space-x-4">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Get Started
          </button>
          <button className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
            Learn More
          </button>
        </div>
      </div>
    </div>
  )
}

export default App`
    },
    {
      path: 'src/index.css',
      type: 'file',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`
    },
    {
      path: 'tailwind.config.js',
      type: 'file',
      content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`
    },
    {
      path: 'tsconfig.json',
      type: 'file',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true
        },
        include: ['src'],
        references: [{ path: './tsconfig.node.json' }]
      }, null, 2)
    },
    {
      path: 'vite.config.ts',
      type: 'file',
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`
    },
    {
      path: 'README.md',
      type: 'file',
      content: `# ${variables.projectName}

${variables.description}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run preview\` - Preview production build
- \`npm run lint\` - Run ESLint
- \`npm run format\` - Format code with Prettier

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite

## Author

${variables.author}

## License

${variables.license}
`
    },
    {
      path: '.env.example',
      type: 'file',
      content: `VITE_APP_TITLE=${variables.projectName}
VITE_APP_VERSION=0.0.0`
    },
    {
      path: '.gitignore',
      type: 'file',
      content: `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local`
    }
  ]
}

async function generateNextJsFiles(variables: TemplateVariables): Promise<TemplateFile[]> {
  return [
    {
      path: 'package.json',
      type: 'file',
      content: JSON.stringify({
        name: variables.packageName,
        version: '0.1.0',
        description: variables.description,
        author: variables.author,
        license: variables.license,
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint'
        },
        dependencies: {
          next: '^14.0.0',
          react: '^18',
          'react-dom': '^18'
        },
        devDependencies: {
          typescript: '^5',
          '@types/node': '^20',
          '@types/react': '^18',
          '@types/react-dom': '^18',
          autoprefixer: '^10.0.1',
          postcss: '^8',
          tailwindcss: '^3.3.0',
          eslint: '^8',
          'eslint-config-next': '14.0.0'
        }
      }, null, 2)
    },
    {
      path: 'app/layout.tsx',
      type: 'file',
      content: `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '${variables.projectName}',
  description: '${variables.description}',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}`
    },
    {
      path: 'app/page.tsx',
      type: 'file',
      content: `export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to ${variables.projectName}
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          ${variables.description}
        </p>
        <div className="space-x-4">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Get Started
          </button>
          <button className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
            Learn More
          </button>
        </div>
      </div>
    </main>
  )
}`
    },
    {
      path: 'app/globals.css',
      type: 'file',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;`
    }
  ]
}

// Placeholder implementations for other template generators
async function generateExpressApiFiles(variables: TemplateVariables): Promise<TemplateFile[]> {
  return [
    {
      path: 'package.json',
      type: 'file',
      content: JSON.stringify({
        name: variables.packageName,
        version: '1.0.0',
        description: variables.description,
        main: 'dist/server.js',
        scripts: {
          dev: 'nodemon src/server.ts',
          build: 'tsc',
          start: 'node dist/server.js',
          test: 'jest'
        }
      }, null, 2)
    }
  ]
}

async function generateFastApiFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return [
    {
      path: 'requirements.txt',
      type: 'file',
      content: `fastapi==0.103.0
uvicorn==0.23.0
sqlalchemy==2.0.0
alembic==1.12.0
psycopg2-binary==2.9.0
pydantic==2.3.0`
    }
  ]
}

async function generateVueFiles(variables: TemplateVariables): Promise<TemplateFile[]> {
  return [
    {
      path: 'package.json',
      type: 'file',
      content: JSON.stringify({
        name: variables.packageName,
        version: '0.0.0',
        description: variables.description
      }, null, 2)
    }
  ]
}

async function generateMernStackFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return []
}

async function generateNextJsSupabaseFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return []
}

async function generateReactNativeFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return []
}

async function generateDataScienceFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return []
}

async function generateMicroservicesFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return []
}

async function generateElectronFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return []
}

async function generateGraphQLFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return []
}

async function generateFlutterFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return []
}

async function generateServerlessFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return []
}

async function generateBlockchainFiles(_variables: TemplateVariables): Promise<TemplateFile[]> {
  return []
}

async function generateGenericFiles(template: ProjectTemplate, variables: TemplateVariables): Promise<TemplateFile[]> {
  return [
    {
      path: 'README.md',
      type: 'file',
      content: `# ${variables.projectName}

${variables.description}

## Setup

${template.documentation.setup.map(step => `- ${step}`).join('\n')}

## Usage

${template.documentation.usage.map(step => `- ${step}`).join('\n')}

## Deployment

${template.documentation.deployment.map(step => `- ${step}`).join('\n')}
`
    }
  ]
}