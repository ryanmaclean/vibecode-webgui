'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Wand2,
  Download,
  Copy,
  CheckCircle,
  AlertCircle,
  FileText,
  Folder,
  Code,
  Package,
  Settings,
  Play
} from 'lucide-react'
import { ProjectTemplate, FileTemplate } from '@/lib/project-templates'

interface ProjectScaffolderProps {
  template: ProjectTemplate
  projectName: string
  onGenerate?: (files: GeneratedFile[]) => void
  onDownload?: (projectData: ProjectData) => void
}

interface GeneratedFile {
  path: string
  content: string
  type: 'file' | 'directory'
}

interface ProjectData {
  name: string
  template: ProjectTemplate
  files: GeneratedFile[]
  packageJson: any
  envFile: string
  dockerFile?: string
  readmeContent: string
}

export function ProjectScaffolder({
  template,
  projectName,
  onGenerate,
  onDownload
}: ProjectScaffolderProps) {
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [projectConfig, setProjectConfig] = useState({
    includeDocker: true,
    includeTests: true,
    includeCI: true,
    includeDocs: true,
    setupDatabase: template.envVars?.some(env => env.name.includes('DATABASE')),
    setupAuth: template.envVars?.some(env => env.name.includes('AUTH')),
  })
  const [customVariables, setCustomVariables] = useState<Record<string, string>>({
    projectName: projectName,
    description: `A ${template.name} project built with VibeCode`,
    author: 'Your Name',
    license: 'MIT'
  })

  const generateProjectFiles = async () => {
    setIsGenerating(true)
    setGenerationProgress(0)

    const files: GeneratedFile[] = []
    const totalSteps = 8

    // Step 1: Generate core files from template
    setGenerationProgress(12)
    for (const fileTemplate of template.fileStructure) {
      let content = fileTemplate.content

      // Replace template variables
      if (fileTemplate.isTemplate && fileTemplate.variables) {
        for (const variable of fileTemplate.variables) {
          const value = customVariables[variable] || variable
          content = content.replace(new RegExp(`{{${variable}}}`, 'g'), value)
        }
      }

      files.push({
        path: fileTemplate.path,
        content,
        type: 'file'
      })
    }

    // Step 2: Generate package.json
    setGenerationProgress(25)
    const packageJson = {
      name: projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: customVariables.description,
      author: customVariables.author,
      license: customVariables.license,
      scripts: template.scripts,
      dependencies: template.dependencies,
      devDependencies: template.devDependencies || {}
    }

    files.push({
      path: 'package.json',
      content: JSON.stringify(packageJson, null, 2),
      type: 'file'
    })

    // Step 3: Generate environment file
    setGenerationProgress(37)
    let envContent = '# Environment Variables\n'
    envContent += `# ${template.name} Configuration\n\n`

    if (template.envVars) {
      for (const envVar of template.envVars) {
        envContent += `# ${envVar.description}\n`
        if (envVar.required) {
          envContent += `${envVar.name}=${envVar.example || ''}\n\n`
        } else {
          envContent += `# ${envVar.name}=${envVar.example || ''}\n\n`
        }
      }
    }

    files.push({
      path: '.env.example',
      content: envContent,
      type: 'file'
    })

    // Step 4: Generate README.md
    setGenerationProgress(50)
    const readmeContent = generateReadme(template, projectName, customVariables)
    files.push({
      path: 'README.md',
      content: readmeContent,
      type: 'file'
    })

    // Step 5: Generate Docker files (if enabled)
    setGenerationProgress(62)
    if (projectConfig.includeDocker) {
      const dockerFiles = generateDockerFiles(template, packageJson)
      files.push(...dockerFiles)
    }

    // Step 6: Generate test files (if enabled)
    setGenerationProgress(75)
    if (projectConfig.includeTests) {
      const testFiles = generateTestFiles(template)
      files.push(...testFiles)
    }

    // Step 7: Generate CI/CD files (if enabled)
    setGenerationProgress(87)
    if (projectConfig.includeCI) {
      const ciFiles = generateCIFiles(template)
      files.push(...ciFiles)
    }

    // Step 8: Generate additional documentation
    setGenerationProgress(100)
    if (projectConfig.includeDocs) {
      const docFiles = generateDocumentationFiles(template)
      files.push(...docFiles)
    }

    setGeneratedFiles(files)
    onGenerate?.(files)

    setTimeout(() => {
      setIsGenerating(false)
    }, 500)
  }

  const downloadProject = () => {
    const projectData: ProjectData = {
      name: projectName,
      template,
      files: generatedFiles,
      packageJson: JSON.parse(generatedFiles.find(f => f.path === 'package.json')?.content || '{}'),
      envFile: generatedFiles.find(f => f.path === '.env.example')?.content || '',
      dockerFile: generatedFiles.find(f => f.path === 'Dockerfile')?.content,
      readmeContent: generatedFiles.find(f => f.path === 'README.md')?.content || ''
    }

    onDownload?.(projectData)
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">AI-Powered Project Scaffolder</h2>
        <p className="text-gray-600">
          Customize your <strong>{template.name}</strong> project and generate production-ready code.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Project Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Settings */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    value={customVariables.projectName}
                    onChange={(e) => setCustomVariables(prev => ({
                      ...prev,
                      projectName: e.target.value
                    }))}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={customVariables.description}
                    onChange={(e) => setCustomVariables(prev => ({
                      ...prev,
                      description: e.target.value
                    }))}
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="author">Author</Label>
                  <Input
                    id="author"
                    value={customVariables.author}
                    onChange={(e) => setCustomVariables(prev => ({
                      ...prev,
                      author: e.target.value
                    }))}
                  />
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-sm font-medium">Features</Label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="docker" className="text-sm">Docker Support</Label>
                    <Switch
                      id="docker"
                      checked={projectConfig.includeDocker}
                      onCheckedChange={(checked) => setProjectConfig(prev => ({
                        ...prev,
                        includeDocker: checked
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="tests" className="text-sm">Test Setup</Label>
                    <Switch
                      id="tests"
                      checked={projectConfig.includeTests}
                      onCheckedChange={(checked) => setProjectConfig(prev => ({
                        ...prev,
                        includeTests: checked
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="ci" className="text-sm">CI/CD Pipeline</Label>
                    <Switch
                      id="ci"
                      checked={projectConfig.includeCI}
                      onCheckedChange={(checked) => setProjectConfig(prev => ({
                        ...prev,
                        includeCI: checked
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="docs" className="text-sm">Documentation</Label>
                    <Switch
                      id="docs"
                      checked={projectConfig.includeDocs}
                      onCheckedChange={(checked) => setProjectConfig(prev => ({
                        ...prev,
                        includeDocs: checked
                      }))}
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={generateProjectFiles}
                disabled={isGenerating}
                className="w-full"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate Project'}
              </Button>

              {isGenerating && (
                <div className="space-y-2">
                  <Progress value={generationProgress} className="w-full" />
                  <p className="text-sm text-gray-600 text-center">
                    {generationProgress}% complete
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-2">
          {generatedFiles.length > 0 ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Generated Project Files
                  </CardTitle>
                  <Button onClick={downloadProject} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Download Project
                  </Button>
                </div>
                <CardDescription>
                  {generatedFiles.length} files generated successfully
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="files" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="files">File Tree</TabsTrigger>
                    <TabsTrigger value="preview">File Preview</TabsTrigger>
                    <TabsTrigger value="summary">Project Summary</TabsTrigger>
                  </TabsList>

                  <TabsContent value="files" className="mt-4">
                    <FileTree files={generatedFiles} />
                  </TabsContent>

                  <TabsContent value="preview" className="mt-4">
                    <FilePreview files={generatedFiles} />
                  </TabsContent>

                  <TabsContent value="summary" className="mt-4">
                    <ProjectSummary
                      template={template}
                      projectName={projectName}
                      config={projectConfig}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Code className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ready to Generate</h3>
                <p className="text-gray-600 text-center mb-4">
                  Configure your project settings and click &quot;Generate Project&quot; to create your files.
                </p>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Play className="w-3 h-3" />
                  {template.name} Template
                </Badge>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper functions for generating different types of files
function generateReadme(template: ProjectTemplate, projectName: string, variables: Record<string, string>): string {
  return `# ${projectName}

${variables.description}

## Features

${template.features.map(feature => `- ${feature}`).join('\n')}

## Getting Started

### Prerequisites

- Node.js 18+ (for ${template.language} projects)
${template.framework ? `- ${template.framework} knowledge` : ''}

### Installation

${template.setupInstructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n')}

## Environment Variables

${template.envVars?.map(env => `- \`${env.name}\`: ${env.description}${env.required ? ' (required)' : ''}`).join('\n') || 'No environment variables required.'}

## Scripts

${Object.entries(template.scripts).map(([script, command]) => `- \`npm run ${script}\`: ${command}`).join('\n')}

## Tech Stack

- **Language**: ${template.language}
${template.framework ? `- **Framework**: ${template.framework}` : ''}
- **Category**: ${template.category}

## License

${variables.license} © ${variables.author}

---

Built with ❤️ using [VibeCode](https://vibecode.dev)
`
}

function generateDockerFiles(template: ProjectTemplate, packageJson: any): GeneratedFile[] {
  const dockerfile = `# Multi-stage Docker build for ${template.name}
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
`

  const dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${packageJson.name}
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  db_data:
`

  return [
    { path: 'Dockerfile', content: dockerfile, type: 'file' },
    { path: 'docker-compose.yml', content: dockerCompose, type: 'file' },
    { path: '.dockerignore', content: 'node_modules\n.git\n.env.local\n', type: 'file' }
  ]
}

function generateTestFiles(template: ProjectTemplate): GeneratedFile[] {
  const jestConfig = `module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.{js,ts,tsx}',
    '!src/**/*.d.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
}
`

  const sampleTest = `describe('${template.name} Tests', () => {
  test('should pass sample test', () => {
    expect(true).toBe(true)
  })
})
`

  return [
    { path: 'jest.config.js', content: jestConfig, type: 'file' },
    { path: '__tests__/sample.test.js', content: sampleTest, type: 'file' },
    { path: 'jest.setup.js', content: '// Jest setup file\n', type: 'file' }
  ]
}

function generateCIFiles(template: ProjectTemplate): GeneratedFile[] {
  const githubWorkflow = `name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Build
      run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v4
    - name: Deploy to production
      run: echo "Deploy step here"
`

  return [
    { path: '.github/workflows/ci.yml', content: githubWorkflow, type: 'file' }
  ]
}

function generateDocumentationFiles(template: ProjectTemplate): GeneratedFile[] {
  const contributing = `# Contributing to ${template.name}

Thank you for your interest in contributing! Here's how you can help:

## Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: \`npm install\`
4. Start development server: \`npm run dev\`

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Add tests if applicable
4. Ensure all tests pass
5. Submit a pull request

## Code Style

- Follow the existing code style
- Use TypeScript for type safety
- Write meaningful commit messages
`

  return [
    { path: 'CONTRIBUTING.md', content: contributing, type: 'file' },
    { path: 'docs/api.md', content: '# API Documentation\n\nAPI documentation goes here.\n', type: 'file' }
  ]
}

// UI Components for file preview
function FileTree({ files }: { files: GeneratedFile[] }) {
  return (
    <div className="space-y-1 max-h-96 overflow-y-auto">
      {files.map((file, index) => (
        <div key={index} className="flex items-center gap-2 text-sm p-2 hover:bg-gray-50 rounded">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="font-mono">{file.path}</span>
        </div>
      ))}
    </div>
  )
}

function FilePreview({ files }: { files: GeneratedFile[] }) {
  const [selectedFile, setSelectedFile] = useState(files[0])

  return (
    <div className="grid grid-cols-3 gap-4 h-96">
      <div className="col-span-1 border-r pr-4">
        <div className="space-y-1 max-h-full overflow-y-auto">
          {files.map((file, index) => (
            <div
              key={index}
              className={`flex items-center gap-2 text-sm p-2 cursor-pointer rounded ${
                selectedFile.path === file.path ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
              }`}
              onClick={() => setSelectedFile(file)}
            >
              <FileText className="w-4 h-4" />
              <span className="font-mono text-xs">{file.path}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <div className="bg-gray-900 text-gray-100 p-4 rounded h-full overflow-auto">
          <pre className="text-xs">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}

function ProjectSummary({
  template,
  projectName,
  config
}: {
  template: ProjectTemplate
  projectName: string
  config: any
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold mb-2">Project Overview</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Name:</span> {projectName}
          </div>
          <div>
            <span className="text-gray-600">Template:</span> {template.name}
          </div>
          <div>
            <span className="text-gray-600">Language:</span> {template.language}
          </div>
          <div>
            <span className="text-gray-600">Framework:</span> {template.framework || 'None'}
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Enabled Features</h4>
        <div className="flex flex-wrap gap-2">
          {config.includeDocker && <Badge variant="secondary">Docker</Badge>}
          {config.includeTests && <Badge variant="secondary">Testing</Badge>}
          {config.includeCI && <Badge variant="secondary">CI/CD</Badge>}
          {config.includeDocs && <Badge variant="secondary">Documentation</Badge>}
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Next Steps</h4>
        <ol className="text-sm space-y-1">
          <li>1. Download the project files</li>
          <li>2. Extract to your development directory</li>
          <li>3. Run <code className="bg-gray-100 px-1 rounded">npm install</code></li>
          <li>4. Configure your environment variables</li>
          <li>5. Start development with <code className="bg-gray-100 px-1 rounded">npm run dev</code></li>
        </ol>
      </div>
    </div>
  )
}
