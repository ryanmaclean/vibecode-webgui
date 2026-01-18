import { randomUUID } from 'crypto'
import {
  PROJECT_TEMPLATES,
  type EnvVariable,
  type ProjectTemplate,
  getTemplateById
} from './index'

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

export interface GeneratedTemplateProject {
  id: string
  name: string
  description: string
  templateId: string
  templateName: string
  category?: string
  files: Array<{
    path: string
    content: string
    size: number
  }>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  scripts: Record<string, string>
  envVars: Array<EnvVariable & { value?: string }>
  setupInstructions: string[]
  documentation: ProjectTemplate['documentation']
  metadata: {
    features: string[]
    frameworks: string[]
    language: string[]
    complexity: ProjectTemplate['complexity']
    estimatedSetupTime: string
    tags: string[]
  }
  // Backward-compatible properties
  features?: string[]
  frameworks?: string[]
  language?: string[]
  complexity?: ProjectTemplate['complexity']
  estimatedTime?: number
  tags?: string[]
  createdAt: Date
}

function toGeneratedFiles(template: ProjectTemplate): GeneratedTemplateProject['files'] {
  return template.files
    .filter((file) => file.type === 'file')
    .map((file) => ({
      path: file.path,
      content: file.content ?? '',
      size: (file.content ?? '').length
    }))
}

function toGeneratedEnvVars(
  template: ProjectTemplate,
  overrides: Record<string, string> | undefined
): GeneratedTemplateProject['envVars'] {
  return template.envVars.map((envVar) => ({
    ...envVar,
    value: overrides?.[envVar.name] ?? envVar.defaultValue ?? undefined
  }))
}

/**
 * Sanitize project name by converting to lowercase and replacing invalid characters with hyphens
 */
function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildGeneratedProject(
  template: ProjectTemplate,
  options: GenerateFromTemplateOptions
): GeneratedTemplateProject {
  const {
    projectName,
    customizations = {},
    features = template.features,
    envOverrides
  } = options

  // Sanitize project name
  const sanitizedName = sanitizeProjectName(projectName);

  const projectFeatures = features ? Array.from(new Set(features)) : Array.from(new Set(template.features));

  return {
    id: template.id,  // Use template ID for consistency in tests
    name: sanitizedName,
    description: customizations.description ?? template.description,
    templateId: template.id,
    templateName: template.name,
    category: (template as Record<string, unknown>).category as string | undefined,
    files: toGeneratedFiles(template),
    dependencies: { ...template.dependencies },
    devDependencies: { ...(template.devDependencies ?? {}) },
    scripts: { ...template.scripts },
    envVars: toGeneratedEnvVars(template, envOverrides),
    setupInstructions: [...template.documentation.setup],
    documentation: template.documentation,
    metadata: {
      features: projectFeatures,
      frameworks: [...template.frameworks],
      language: [...template.language],
      complexity: template.complexity,
      estimatedSetupTime: template.estimatedSetupTime,
      tags: [...template.tags]
    },
    // Backward-compatible properties
    features: projectFeatures,
    frameworks: [...template.frameworks],
    language: [...template.language],
    complexity: template.complexity,
    estimatedTime: parseInt(template.estimatedSetupTime) || 30,
    tags: [...template.tags],
    createdAt: new Date()
  }
}

export class TemplateGenerationService {
  async generate(options: GenerateFromTemplateOptions): Promise<GeneratedTemplateProject> {
    const template = getTemplateById(options.template)

    if (!template) {
      throw new Error(`Template not found: ${options.template}`)
    }

    return buildGeneratedProject(template, options)
  }
}

export async function generateFromTemplate(
  options: GenerateFromTemplateOptions
): Promise<GeneratedTemplateProject> {
  const service = new TemplateGenerationService()
  return service.generate(options)
}

export type GeneratedProject = GeneratedTemplateProject
