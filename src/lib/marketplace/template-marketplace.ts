/**
 * Template marketplace for sharing and discovering project templates
 */

import { z } from 'zod'
import type { ProjectTemplate } from '@/lib/templates/index'
import { templateRegistry } from '@/lib/templates/versioning'

// Marketplace template metadata
export interface MarketplaceTemplate extends ProjectTemplate {
  marketplaceId: string
  author: {
    id: string
    name: string
    email: string
    avatar?: string
    verified: boolean
  }
  stats: {
    downloads: number
    rating: number
    reviewCount: number
    forks: number
    stars: number
  }
  marketplace: {
    publishedAt: string
    lastUpdated: string
    featured: boolean
    category: string[]
    pricing: 'free' | 'paid'
    price?: number
    license: string
    supportUrl?: string
    demoUrl?: string
  }
  compatibility: {
    nextjsVersion: string[]
    nodeVersion: string[]
    platforms: string[]
  }
  reviews: TemplateReview[]
}

export interface TemplateReview {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  rating: number
  title: string
  content: string
  createdAt: string
  helpful: number
  verified: boolean
}

export interface TemplateSubmission {
  template: ProjectTemplate
  author: {
    name: string
    email: string
    githubUrl?: string
  }
  marketplace: {
    category: string[]
    pricing: 'free' | 'paid'
    price?: number
    license: string
    supportUrl?: string
    demoUrl?: string
  }
  submission: {
    notes?: string
    requestedFeature?: boolean
  }
}

// Search and filter options
export interface MarketplaceSearchOptions {
  query?: string
  category?: string
  tags?: string[]
  author?: string
  pricing?: 'free' | 'paid' | 'all'
  rating?: number
  sortBy?: 'popularity' | 'rating' | 'recent' | 'downloads' | 'alphabetical'
  featured?: boolean
  verified?: boolean
  limit?: number
  offset?: number
}

const templateReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(1).max(100),
  content: z.string().min(10).max(2000),
  templateId: z.string()
})

/**
 * Template marketplace service
 */
export class TemplateMarketplace {
  private templates: Map<string, MarketplaceTemplate> = new Map()
  private categories: Set<string> = new Set()
  private featuredTemplates: string[] = []

  constructor() {
    this.initializeMarketplace()
  }

  private initializeMarketplace(): void {
    // Initialize with sample marketplace templates
    this.loadSampleTemplates()
    this.setupCategories()
  }

  private loadSampleTemplates(): void {
    const sampleTemplates: Partial<MarketplaceTemplate>[] = [
      {
        marketplaceId: 'mp-next-ai-saas',
        name: 'AI SaaS Starter',
        description: 'Complete AI-powered SaaS application with authentication, payments, and AI integration',
        author: {
          id: 'vibecode-team',
          name: 'VibeCode Team',
          email: 'team@vibecode.dev',
          verified: true
        },
        stats: {
          downloads: 15420,
          rating: 4.8,
          reviewCount: 127,
          forks: 89,
          stars: 542
        },
        marketplace: {
          publishedAt: '2025-06-15T10:00:00Z',
          lastUpdated: '2025-08-12T14:30:00Z',
          featured: true,
          category: ['AI/ML', 'SaaS', 'Enterprise'],
          pricing: 'free',
          license: 'MIT'
        },
        compatibility: {
          nextjsVersion: ['14.x', '15.x'],
          nodeVersion: ['18.x', '20.x', '22.x'],
          platforms: ['vercel', 'netlify', 'aws']
        },
        reviews: []
      },
      {
        marketplaceId: 'mp-react-dashboard',
        name: 'Enterprise Dashboard',
        description: 'Professional admin dashboard with charts, analytics, and user management',
        author: {
          id: 'community-dev',
          name: 'Community Developer',
          email: 'dev@example.com',
          verified: false
        },
        stats: {
          downloads: 8730,
          rating: 4.6,
          reviewCount: 64,
          forks: 45,
          stars: 231
        },
        marketplace: {
          publishedAt: '2025-07-01T09:00:00Z',
          lastUpdated: '2025-08-10T11:20:00Z',
          featured: false,
          category: ['Dashboard', 'Enterprise', 'Analytics'],
          pricing: 'free',
          license: 'Apache-2.0'
        },
        compatibility: {
          nextjsVersion: ['14.x', '15.x'],
          nodeVersion: ['18.x', '20.x'],
          platforms: ['vercel', 'netlify']
        },
        reviews: []
      }
    ]

    // Convert sample templates to full marketplace templates
    sampleTemplates.forEach((template, index) => {
      const fullTemplate: MarketplaceTemplate = {
        id: `marketplace-${index}`,
        name: template.name || 'Unnamed Template',
        description: template.description || '',
        category: 'frontend',
        complexity: 'intermediate',
        tags: [],
        language: [],
        frameworks: [],
<<<<<<< HEAD
        features: [],
        files: [],
=======
        features: [],        files: [],
>>>>>>> fix/consolidated-dependency-updates
        dependencies: {},
        scripts: {},
        envVars: [],
        dockerSupport: false,
        kubernetesSupport: false,
        cicdTemplate: false,
        testingSetup: false,
        monitoringSetup: false,
        estimatedSetupTime: '10 minutes',
        documentation: {
          setup: ['Setup instructions'],
          usage: ['Usage instructions', 'Template documentation'],
<<<<<<< HEAD
          deployment: ['Deployment guide']
        },
=======
          deployment: ['Deployment guide']        },
>>>>>>> fix/consolidated-dependency-updates
        ...template,
        marketplaceId: template.marketplaceId || `mp-${index}`,
        author: template.author!,
        stats: template.stats!,
        marketplace: template.marketplace!,
        compatibility: template.compatibility!,
        reviews: template.reviews || []
      }
      
      this.templates.set(fullTemplate.marketplaceId, fullTemplate)
    })
  }

  private setupCategories(): void {
    const categories = [
      'AI/ML', 'SaaS', 'Enterprise', 'Dashboard', 'Analytics',
      'E-commerce', 'Blog', 'Portfolio', 'Landing Page', 'Mobile',
      'Desktop', 'API', 'Microservices', 'DevOps', 'Education',
      'Healthcare', 'Finance', 'Gaming', 'Social', 'Productivity'
    ]
    
    categories.forEach(category => this.categories.add(category))
  }

  /**
   * Search templates in marketplace
   */
  searchTemplates(options: MarketplaceSearchOptions = {}): {
    templates: MarketplaceTemplate[]
    total: number
    hasMore: boolean
  } {
    let templates = Array.from(this.templates.values())

    // Apply filters
    if (options.query) {
      const query = options.query.toLowerCase()
      templates = templates.filter(template => 
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    if (options.category) {
      templates = templates.filter(template => 
        template.marketplace.category.includes(options.category!)
      )
    }

    if (options.tags && options.tags.length > 0) {
      templates = templates.filter(template =>
        options.tags!.some(tag => template.tags.includes(tag))
      )
    }

    if (options.author) {
      templates = templates.filter(template =>
        template.author.id === options.author ||
        template.author.name.toLowerCase().includes(options.author!.toLowerCase())
      )
    }

    if (options.pricing && options.pricing !== 'all') {
      templates = templates.filter(template =>
        template.marketplace.pricing === options.pricing
      )
    }

    if (options.rating) {
      templates = templates.filter(template =>
        template.stats.rating >= options.rating!
      )
    }

    if (options.featured) {
      templates = templates.filter(template => template.marketplace.featured)
    }

    if (options.verified) {
      templates = templates.filter(template => template.author.verified)
    }

    // Apply sorting
    switch (options.sortBy) {
      case 'popularity':
        templates.sort((a, b) => b.stats.downloads - a.stats.downloads)
        break
      case 'rating':
        templates.sort((a, b) => b.stats.rating - a.stats.rating)
        break
      case 'recent':
        templates.sort((a, b) => 
          new Date(b.marketplace.lastUpdated).getTime() - 
          new Date(a.marketplace.lastUpdated).getTime()
        )
        break
      case 'downloads':
        templates.sort((a, b) => b.stats.downloads - a.stats.downloads)
        break
      case 'alphabetical':
        templates.sort((a, b) => a.name.localeCompare(b.name))
        break
      default:
        // Default to featured first, then by popularity
        templates.sort((a, b) => {
          if (a.marketplace.featured && !b.marketplace.featured) return -1
          if (!a.marketplace.featured && b.marketplace.featured) return 1
          return b.stats.downloads - a.stats.downloads
        })
    }

    // Apply pagination
    const limit = options.limit || 20
    const offset = options.offset || 0
    const total = templates.length
    const paginatedTemplates = templates.slice(offset, offset + limit)
    const hasMore = offset + limit < total

    return {
      templates: paginatedTemplates,
      total,
      hasMore
    }
  }

  /**
   * Get template by marketplace ID
   */
  getTemplate(marketplaceId: string): MarketplaceTemplate | null {
    return this.templates.get(marketplaceId) || null
  }

  /**
   * Get featured templates
   */
  getFeaturedTemplates(limit: number = 6): MarketplaceTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.marketplace.featured)
      .sort((a, b) => b.stats.downloads - a.stats.downloads)
      .slice(0, limit)
  }

  /**
   * Get popular templates
   */
  getPopularTemplates(limit: number = 10): MarketplaceTemplate[] {
    return Array.from(this.templates.values())
      .sort((a, b) => b.stats.downloads - a.stats.downloads)
      .slice(0, limit)
  }

  /**
   * Get recent templates
   */
  getRecentTemplates(limit: number = 10): MarketplaceTemplate[] {
    return Array.from(this.templates.values())
      .sort((a, b) => 
        new Date(b.marketplace.publishedAt).getTime() - 
        new Date(a.marketplace.publishedAt).getTime()
      )
      .slice(0, limit)
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories).sort()
  }

  /**
   * Submit template for review
   */
  async submitTemplate(submission: TemplateSubmission): Promise<{
    success: boolean
    submissionId?: string
    error?: string
  }> {
    try {
      // Validate template
      const validation = this.validateTemplateSubmission(submission)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        }
      }

      // Generate submission ID
      const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // In a real implementation, this would save to database
      // Debug log removed

      return {
        success: true,
        submissionId
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Submission failed'
      }
    }
  }

  /**
   * Add review to template
   */
  async addReview(templateId: string, review: Omit<TemplateReview, 'id' | 'createdAt' | 'helpful'>): Promise<{
    success: boolean
    reviewId?: string
    error?: string
  }> {
    try {
      // Validate review
      const validatedReview = templateReviewSchema.parse({
        rating: review.rating,
        title: review.title,
        content: review.content,
        templateId
      })

      const template = this.templates.get(templateId)
      if (!template) {
        return {
          success: false,
          error: 'Template not found'
        }
      }

      const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const newReview: TemplateReview = {
        id: reviewId,
        userId: review.userId,
        userName: review.userName,
        userAvatar: review.userAvatar,
        rating: review.rating,
        title: review.title,
        content: review.content,
        createdAt: new Date().toISOString(),
        helpful: 0,
        verified: review.verified
      }

      template.reviews.push(newReview)
      
      // Update template rating
      const totalRating = template.reviews.reduce((sum, r) => sum + r.rating, 0)
      template.stats.rating = totalRating / template.reviews.length
      template.stats.reviewCount = template.reviews.length

      this.templates.set(templateId, template)

      return {
        success: true,
        reviewId
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add review'
      }
    }
  }

  /**
   * Record template download
   */
  async recordDownload(marketplaceId: string): Promise<void> {
    const template = this.templates.get(marketplaceId)
    if (template) {
      template.stats.downloads++
      this.templates.set(marketplaceId, template)
    }
  }

  /**
   * Fork template (create new version)
   */
  async forkTemplate(marketplaceId: string, userId: string): Promise<{
    success: boolean
    forkId?: string
    error?: string
  }> {
    try {
      const originalTemplate = this.templates.get(marketplaceId)
      if (!originalTemplate) {
        return {
          success: false,
          error: 'Template not found'
        }
      }

      // Create fork
      const forkId = `fork_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Update original template fork count
      originalTemplate.stats.forks++
      this.templates.set(marketplaceId, originalTemplate)

      return {
        success: true,
        forkId
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fork template'
      }
    }
  }

  /**
   * Star/unstar template
   */
  async toggleStar(marketplaceId: string, userId: string, starred: boolean): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const template = this.templates.get(marketplaceId)
      if (!template) {
        return {
          success: false,
          error: 'Template not found'
        }
      }

      // Update star count (simplified - no user tracking in this implementation)
      if (starred) {
        template.stats.stars++
      } else {
        template.stats.stars = Math.max(0, template.stats.stars - 1)
      }

      this.templates.set(marketplaceId, template)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update star'
      }
    }
  }

  private validateTemplateSubmission(submission: TemplateSubmission): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Validate template
    if (!submission.template.name || submission.template.name.trim().length === 0) {
      errors.push('Template name is required')
    }

    if (!submission.template.description || submission.template.description.trim().length < 20) {
      errors.push('Template description must be at least 20 characters')
    }

    if (!submission.template.files || submission.template.files.length === 0) {
      errors.push('Template must include at least one file')
    }

    // Validate author
    if (!submission.author.name || submission.author.name.trim().length === 0) {
      errors.push('Author name is required')
    }

    if (!submission.author.email || !this.isValidEmail(submission.author.email)) {
      errors.push('Valid author email is required')
    }

    // Validate marketplace info
    if (!submission.marketplace.category || submission.marketplace.category.length === 0) {
      errors.push('At least one category is required')
    }

    if (submission.marketplace.pricing === 'paid' && !submission.marketplace.price) {
      errors.push('Price is required for paid templates')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}

// Export singleton instance
export const templateMarketplace = new TemplateMarketplace()

// Types are already exported above with interface declarations