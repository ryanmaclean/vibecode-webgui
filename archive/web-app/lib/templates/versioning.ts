/**
 * Template versioning and update management system
 */

import { z } from 'zod'
import type { ProjectTemplate } from './index'

export interface TemplateVersion {
  version: string
  releaseDate: string
  changelog: string[]
  breaking: boolean
  deprecated: boolean
  template: ProjectTemplate
}

export interface TemplateMetadata {
  id: string
  name: string
  description: string
  author: string
  repository?: string
  license: string
  tags: string[]
  versions: TemplateVersion[]
  currentVersion: string
  latestStableVersion: string
  maintainers: string[]
  communityScore: number // 0-10 rating
  downloadCount: number
  lastUpdated: string
  createdAt: string
}

export interface TemplateUpdate {
  templateId: string
  fromVersion: string
  toVersion: string
  updateType: 'major' | 'minor' | 'patch'
  breaking: boolean
  changelog: string[]
  migrationGuide?: string
  automatedMigration: boolean
}

const templateVersionSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  releaseDate: z.string().datetime(),
  changelog: z.array(z.string()),
  breaking: z.boolean(),
  deprecated: z.boolean()
})

/**
 * Template registry for managing versioned templates
 */
export class TemplateRegistry {
  private templates: Map<string, TemplateMetadata> = new Map()
  private versionCache: Map<string, ProjectTemplate> = new Map()

  constructor() {
    this.initializeBuiltInTemplates()
  }

  private initializeBuiltInTemplates(): void {
    // Initialize with built-in templates from the main index
    // This would typically load from a database or API
  }

  /**
   * Register a new template or version
   */
  async registerTemplate(
    template: ProjectTemplate,
    metadata: Partial<TemplateMetadata>,
    version: string = '1.0.0'
  ): Promise<void> {
    const templateId = template.id
    const existingTemplate = this.templates.get(templateId)

    if (existingTemplate) {
      // Add new version to existing template
      await this.addVersion(templateId, template, version)
    } else {
      // Create new template entry
      const newMetadata: TemplateMetadata = {
        id: templateId,
        name: template.name,
        description: template.description,
        author: metadata.author || 'VibeCode Team',
        repository: metadata.repository,
        license: metadata.license || 'MIT',
        tags: template.tags,
        versions: [{
          version,
          releaseDate: new Date().toISOString(),
          changelog: ['Initial release'],
          breaking: false,
          deprecated: false,
          template
        }],
        currentVersion: version,
        latestStableVersion: version,
        maintainers: metadata.maintainers || ['VibeCode Team'],
        communityScore: 0,
        downloadCount: 0,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }

      this.templates.set(templateId, newMetadata)
      this.versionCache.set(`${templateId}@${version}`, template)
    }
  }

  /**
   * Add a new version to an existing template
   */
  async addVersion(
    templateId: string,
    template: ProjectTemplate,
    version: string,
    changelog: string[] = [],
    breaking: boolean = false
  ): Promise<void> {
    const metadata = this.templates.get(templateId)
    if (!metadata) {
      throw new Error(`Template ${templateId} not found`)
    }

    // Validate version format
    templateVersionSchema.parse({
      version,
      releaseDate: new Date().toISOString(),
      changelog,
      breaking,
      deprecated: false
    })

    // Check if version already exists
    if (metadata.versions.some(v => v.version === version)) {
      throw new Error(`Version ${version} already exists for template ${templateId}`)
    }

    const newVersion: TemplateVersion = {
      version,
      releaseDate: new Date().toISOString(),
      changelog,
      breaking,
      deprecated: false,
      template
    }

    metadata.versions.push(newVersion)
    metadata.versions.sort((a, b) => this.compareVersions(b.version, a.version))
    metadata.currentVersion = version
    metadata.lastUpdated = new Date().toISOString()

    // Update latest stable version if not breaking
    if (!breaking && !this.isPreRelease(version)) {
      metadata.latestStableVersion = version
    }

    this.templates.set(templateId, metadata)
    this.versionCache.set(`${templateId}@${version}`, template)
  }

  /**
   * Get a specific template version
   */
  getTemplate(templateId: string, version?: string): ProjectTemplate | undefined {
    const metadata = this.templates.get(templateId)
    if (!metadata) return undefined

    const targetVersion = version || metadata.currentVersion
    const cacheKey = `${templateId}@${targetVersion}`
    
    if (this.versionCache.has(cacheKey)) {
      return this.versionCache.get(cacheKey)
    }

    const versionData = metadata.versions.find(v => v.version === targetVersion)
    if (versionData) {
      this.versionCache.set(cacheKey, versionData.template)
      return versionData.template
    }

    return undefined
  }

  /**
   * Get template metadata
   */
  getTemplateMetadata(templateId: string): TemplateMetadata | undefined {
    return this.templates.get(templateId)
  }

  /**
   * List all available templates
   */
  listTemplates(options: {
    category?: string
    tags?: string[]
    maintainer?: string
    minScore?: number
    includeDeprecated?: boolean
  } = {}): TemplateMetadata[] {
    let templates = Array.from(this.templates.values())

    if (options.category) {
      templates = templates.filter(t => {
        const currentTemplate = this.getTemplate(t.id)
        return currentTemplate?.category === options.category
      })
    }

    if (options.tags) {
      templates = templates.filter(t => 
        options.tags!.some(tag => t.tags.includes(tag))
      )
    }

    if (options.maintainer) {
      templates = templates.filter(t => 
        t.maintainers.includes(options.maintainer!)
      )
    }

    if (options.minScore !== undefined) {
      templates = templates.filter(t => t.communityScore >= options.minScore!)
    }

    if (!options.includeDeprecated) {
      templates = templates.filter(t => {
        const currentVersion = t.versions.find(v => v.version === t.currentVersion)
        return !currentVersion?.deprecated
      })
    }

    return templates.sort((a, b) => b.communityScore - a.communityScore)
  }

  /**
   * Check for available updates
   */
  checkUpdates(templateId: string, currentVersion: string): TemplateUpdate[] {
    const metadata = this.templates.get(templateId)
    if (!metadata) return []

    const updates: TemplateUpdate[] = []
    const currentIndex = metadata.versions.findIndex(v => v.version === currentVersion)
    
    if (currentIndex === -1) return updates

    // Check for newer versions
    for (let i = 0; i < currentIndex; i++) {
      const version = metadata.versions[i]
      if (!version.deprecated) {
        const updateType = this.getUpdateType(currentVersion, version.version)
        updates.push({
          templateId,
          fromVersion: currentVersion,
          toVersion: version.version,
          updateType,
          breaking: version.breaking,
          changelog: version.changelog,
          migrationGuide: this.getMigrationGuide(templateId, currentVersion, version.version),
          automatedMigration: this.hasAutomatedMigration(templateId, currentVersion, version.version)
        })
      }
    }

    return updates
  }

  /**
   * Get migration guide between versions
   */
  private getMigrationGuide(templateId: string, fromVersion: string, toVersion: string): string | undefined {
    // In a real implementation, this would fetch from a migration guide database
    return `Migration guide for ${templateId} from v${fromVersion} to v${toVersion} would be provided here.`
  }

  /**
   * Check if automated migration is available
   */
  private hasAutomatedMigration(_templateId: string, fromVersion: string, toVersion: string): boolean {
    // In a real implementation, this would check for available migration scripts
    const updateType = this.getUpdateType(fromVersion, toVersion)
    return updateType === 'patch' || updateType === 'minor'
  }

  /**
   * Deprecate a template version
   */
  async deprecateVersion(templateId: string, version: string, reason?: string): Promise<void> {
    const metadata = this.templates.get(templateId)
    if (!metadata) {
      throw new Error(`Template ${templateId} not found`)
    }

    const versionIndex = metadata.versions.findIndex(v => v.version === version)
    if (versionIndex === -1) {
      throw new Error(`Version ${version} not found for template ${templateId}`)
    }

    metadata.versions[versionIndex].deprecated = true
    if (reason) {
      metadata.versions[versionIndex].changelog.push(`DEPRECATED: ${reason}`)
    }

    // Update current version if the deprecated version was current
    if (metadata.currentVersion === version) {
      const latestNonDeprecated = metadata.versions.find(v => !v.deprecated)
      if (latestNonDeprecated) {
        metadata.currentVersion = latestNonDeprecated.version
      }
    }

    metadata.lastUpdated = new Date().toISOString()
    this.templates.set(templateId, metadata)
  }

  /**
   * Update community score
   */
  async updateCommunityScore(templateId: string, score: number): Promise<void> {
    const metadata = this.templates.get(templateId)
    if (!metadata) {
      throw new Error(`Template ${templateId} not found`)
    }

    metadata.communityScore = Math.max(0, Math.min(10, score))
    metadata.lastUpdated = new Date().toISOString()
    this.templates.set(templateId, metadata)
  }

  /**
   * Increment download count
   */
  async recordDownload(templateId: string, _version?: string): Promise<void> {
    const metadata = this.templates.get(templateId)
    if (!metadata) return

    metadata.downloadCount++
    metadata.lastUpdated = new Date().toISOString()
    this.templates.set(templateId, metadata)
  }

  /**
   * Compare version strings
   */
  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number)
    const partsB = b.split('.').map(Number)

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0
      const partB = partsB[i] || 0

      if (partA > partB) return 1
      if (partA < partB) return -1
    }

    return 0
  }

  /**
   * Determine update type between versions
   */
  private getUpdateType(fromVersion: string, toVersion: string): 'major' | 'minor' | 'patch' {
    const fromParts = fromVersion.split('.').map(Number)
    const toParts = toVersion.split('.').map(Number)

    if (toParts[0] > fromParts[0]) return 'major'
    if (toParts[1] > fromParts[1]) return 'minor'
    return 'patch'
  }

  /**
   * Check if version is a pre-release
   */
  private isPreRelease(version: string): boolean {
    return version.includes('-') || version.includes('+')
  }

  /**
   * Export template configuration
   */
  exportTemplate(templateId: string, version?: string): string {
    const template = this.getTemplate(templateId, version)
    const metadata = this.getTemplateMetadata(templateId)
    
    if (!template || !metadata) {
      throw new Error(`Template ${templateId} not found`)
    }

    return JSON.stringify({
      metadata,
      template
    }, null, 2)
  }

  /**
   * Import template configuration
   */
  async importTemplate(configJson: string): Promise<void> {
    const config = JSON.parse(configJson)
    const { metadata, template } = config

    await this.registerTemplate(
      template,
      metadata,
      metadata.currentVersion
    )
  }

  /**
   * Batch update templates
   */
  async batchUpdate(updates: Array<{
    templateId: string
    template: ProjectTemplate
    version: string
    changelog: string[]
    breaking?: boolean
  }>): Promise<void> {
    for (const update of updates) {
      try {
        await this.addVersion(
          update.templateId,
          update.template,
          update.version,
          update.changelog,
          update.breaking || false
        )
      } catch (error) {
        console.error(`Failed to update template ${update.templateId}:`, error)
      }
    }
  }

  /**
   * Validate template compatibility
   */
  validateCompatibility(templateId: string, fromVersion: string, toVersion: string): {
    compatible: boolean
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []

    const metadata = this.templates.get(templateId)
    
    if (!metadata) {
      issues.push('Template not found')
      return { compatible: false, issues, recommendations }
    }

    const fromVersionData = metadata.versions.find(v => v.version === fromVersion)
    const toVersionData = metadata.versions.find(v => v.version === toVersion)

    if (!fromVersionData || !toVersionData) {
      issues.push('Version not found')
      return { compatible: false, issues, recommendations }
    }

    // Check for breaking changes
    if (toVersionData.breaking) {
      issues.push('Target version contains breaking changes')
      recommendations.push('Review migration guide before updating')
    }

    // Check if target version is deprecated
    if (toVersionData.deprecated) {
      issues.push('Target version is deprecated')
      recommendations.push('Consider updating to latest stable version')
    }

    // Check version gap
    const versionGap = this.compareVersions(toVersion, fromVersion)
    if (versionGap > 1) {
      recommendations.push('Large version jump detected - consider incremental updates')
    }

    return {
      compatible: issues.length === 0,
      issues,
      recommendations
    }
  }
}

// Singleton instance
export const templateRegistry = new TemplateRegistry()

// Template migration utilities
export class TemplateMigrator {
  static async migrateTemplate(
    templateId: string,
    fromVersion: string,
    toVersion: string,
    projectFiles: any[]
  ): Promise<{
    success: boolean
    migratedFiles: any[]
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []
    const migratedFiles = [...projectFiles]

    try {
      const compatibility = templateRegistry.validateCompatibility(
        templateId, 
        fromVersion, 
        toVersion
      )

      if (!compatibility.compatible) {
        errors.push(...compatibility.issues)
        return { success: false, migratedFiles: [], errors, warnings }
      }

      warnings.push(...compatibility.recommendations)

      // Perform automated migrations based on update type
      const updateType = templateRegistry['getUpdateType'](fromVersion, toVersion)
      
      switch (updateType) {
        case 'patch':
          // Minimal changes, usually safe
          break
        case 'minor':
          // New features, backward compatible
          await this.performMinorMigration(templateId, fromVersion, toVersion, migratedFiles)
          break
        case 'major':
          // Breaking changes, requires manual intervention
          warnings.push('Major version update may require manual changes')
          await this.performMajorMigration(templateId, fromVersion, toVersion, migratedFiles)
          break
      }

      return { success: true, migratedFiles, errors, warnings }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown migration error')
      return { success: false, migratedFiles: [], errors, warnings }
    }
  }

  private static async performMinorMigration(
    _templateId: string,
    _fromVersion: string,
    _toVersion: string,
    _files: any[]
  ): Promise<void> {
    // Implement minor version migration logic
    // This might include updating dependencies, adding new config files, etc.
  }

  private static async performMajorMigration(
    _templateId: string,
    _fromVersion: string,
    _toVersion: string,
    _files: any[]
  ): Promise<void> {
    // Implement major version migration logic
    // This might include restructuring files, updating APIs, etc.
  }
}

// Template validation utilities
export class TemplateValidator {
  static validateTemplate(template: ProjectTemplate): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields validation
    if (!template.id || template.id.trim() === '') {
      errors.push('Template ID is required')
    }

    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required')
    }

    if (!template.description || template.description.trim() === '') {
      errors.push('Template description is required')
    }

    // Dependencies validation
    if (template.dependencies && typeof template.dependencies !== 'object') {
      errors.push('Dependencies must be an object')
    }

    // Scripts validation
    if (template.scripts && typeof template.scripts !== 'object') {
      errors.push('Scripts must be an object')
    }

    // Environment variables validation
    if (template.envVars && !Array.isArray(template.envVars)) {
      errors.push('Environment variables must be an array')
    }

    // Files validation
    if (!template.files || !Array.isArray(template.files)) {
      errors.push('Template must include files array')
    } else if (template.files.length === 0) {
      warnings.push('Template has no files defined')
    }

    // Documentation validation
    if (!template.documentation || typeof template.documentation !== 'object') {
      warnings.push('Template should include documentation')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  static validateTemplateVersion(version: string): boolean {
    const versionRegex = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/
    return versionRegex.test(version)
  }
}