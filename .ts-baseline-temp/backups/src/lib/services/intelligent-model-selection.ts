import { datadogMetrics } from '../monitoring/datadog-metrics'

export interface ModelCapability {
  id: string
  name: string
  provider: 'openrouter' | 'huggingface'
  contextLength: number
  strengths: ModelStrength[]
  costTier: 'free' | 'low' | 'medium' | 'high'
  speedTier: 'slow' | 'medium' | 'fast'
  qualityTier: 'basic' | 'good' | 'excellent'
  maxTokens: number
  supportsStreaming: boolean
  supportsImages: boolean
  supportsCode: boolean
  supportsFunctionCalling: boolean
}

export type ModelStrength = 
  | 'reasoning' 
  | 'coding' 
  | 'creative' 
  | 'conversational' 
  | 'mathematical' 
  | 'analysis' 
  | 'summarization'
  | 'translation'
  | 'instruction-following'

export interface PromptAnalysis {
  type: 'coding' | 'creative' | 'analytical' | 'conversational' | 'mathematical' | 'translation' | 'complex'
  complexity: 'simple' | 'medium' | 'complex'
  length: number
  language?: string
  codeLanguages: string[]
  requiresReasoning: boolean
  requiresCreativity: boolean
  requiresAccuracy: boolean
  hasImages: boolean
  hasFiles: boolean
  contextRequired: boolean
  urgency: 'low' | 'medium' | 'high'
  keywords: string[]
}

export interface ModelSelection {
  selectedModel: string
  confidence: number
  reasoning: string
  alternatives: Array<{ model: string; score: number; reason: string }>
  fallbackModel: string
}

class IntelligentModelSelectionService {
  private models: ModelCapability[] = [
    // OpenRouter Models
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'openrouter',
      contextLength: 200000,
      strengths: ['reasoning', 'coding', 'analysis', 'instruction-following'],
      costTier: 'high',
      speedTier: 'medium',
      qualityTier: 'excellent',
      maxTokens: 8192,
      supportsStreaming: true,
      supportsImages: true,
      supportsCode: true,
      supportsFunctionCalling: true
    },
    {
      id: 'anthropic/claude-3-haiku',
      name: 'Claude 3 Haiku',
      provider: 'openrouter',
      contextLength: 200000,
      strengths: ['conversational', 'summarization', 'instruction-following'],
      costTier: 'low',
      speedTier: 'fast',
      qualityTier: 'good',
      maxTokens: 4096,
      supportsStreaming: true,
      supportsImages: true,
      supportsCode: true,
      supportsFunctionCalling: false
    },
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      provider: 'openrouter',
      contextLength: 128000,
      strengths: ['reasoning', 'coding', 'creative', 'analysis'],
      costTier: 'high',
      speedTier: 'medium',
      qualityTier: 'excellent',
      maxTokens: 4096,
      supportsStreaming: true,
      supportsImages: true,
      supportsCode: true,
      supportsFunctionCalling: true
    },
    {
      id: 'openai/gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openrouter',
      contextLength: 128000,
      strengths: ['conversational', 'coding', 'instruction-following'],
      costTier: 'medium',
      speedTier: 'fast',
      qualityTier: 'good',
      maxTokens: 16384,
      supportsStreaming: true,
      supportsImages: true,
      supportsCode: true,
      supportsFunctionCalling: true
    },
    {
      id: 'meta-llama/llama-3.1-405b-instruct',
      name: 'Llama 3.1 405B',
      provider: 'openrouter',
      contextLength: 128000,
      strengths: ['reasoning', 'mathematical', 'coding', 'analysis'],
      costTier: 'high',
      speedTier: 'slow',
      qualityTier: 'excellent',
      maxTokens: 4096,
      supportsStreaming: true,
      supportsImages: false,
      supportsCode: true,
      supportsFunctionCalling: false
    },
    {
      id: 'google/gemini-pro-1.5',
      name: 'Gemini Pro 1.5',
      provider: 'openrouter',
      contextLength: 2000000,
      strengths: ['analysis', 'summarization', 'reasoning', 'creative'],
      costTier: 'medium',
      speedTier: 'medium',
      qualityTier: 'excellent',
      maxTokens: 8192,
      supportsStreaming: true,
      supportsImages: true,
      supportsCode: true,
      supportsFunctionCalling: false
    },
    // Hugging Face Models
    {
      id: 'microsoft/DialoGPT-medium',
      name: 'DialoGPT Medium',
      provider: 'huggingface',
      contextLength: 1024,
      strengths: ['conversational'],
      costTier: 'free',
      speedTier: 'fast',
      qualityTier: 'basic',
      maxTokens: 1024,
      supportsStreaming: false,
      supportsImages: false,
      supportsCode: false,
      supportsFunctionCalling: false
    },
    {
      id: 'microsoft/DialoGPT-large',
      name: 'DialoGPT Large',
      provider: 'huggingface',
      contextLength: 1024,
      strengths: ['conversational'],
      costTier: 'free',
      speedTier: 'medium',
      qualityTier: 'good',
      maxTokens: 1024,
      supportsStreaming: false,
      supportsImages: false,
      supportsCode: false,
      supportsFunctionCalling: false
    },
    {
      id: 'google/flan-t5-large',
      name: 'FLAN-T5 Large',
      provider: 'huggingface',
      contextLength: 512,
      strengths: ['instruction-following', 'summarization'],
      costTier: 'free',
      speedTier: 'fast',
      qualityTier: 'good',
      maxTokens: 512,
      supportsStreaming: false,
      supportsImages: false,
      supportsCode: true,
      supportsFunctionCalling: false
    }
  ]

  analyzePrompt(prompt: string, metadata?: {
    hasImages?: boolean
    hasFiles?: boolean
    fileTypes?: string[]
    conversationHistory?: number
    urgency?: 'low' | 'medium' | 'high'
  }): PromptAnalysis {
    const promptLower = prompt.toLowerCase()
    
    // Detect code languages
    const codeLanguages = this.detectCodeLanguages(prompt)
    
    // Analyze prompt type
    const type = this.determinePromptType(promptLower, codeLanguages, metadata)
    
    // Assess complexity
    const complexity = this.assessComplexity(prompt, metadata)
    
    // Check requirements
    const requiresReasoning = this.requiresReasoning(promptLower)
    const requiresCreativity = this.requiresCreativity(promptLower)
    const requiresAccuracy = this.requiresAccuracy(promptLower)
    
    // Extract keywords
    const keywords = this.extractKeywords(promptLower)
    
    // Detect language
    const language = this.detectLanguage(prompt)

    return {
      type,
      complexity,
      length: prompt.length,
      language,
      codeLanguages,
      requiresReasoning,
      requiresCreativity,
      requiresAccuracy,
      hasImages: metadata?.hasImages || false,
      hasFiles: metadata?.hasFiles || false,
      contextRequired: (metadata?.conversationHistory || 0) > 3,
      urgency: metadata?.urgency || 'medium',
      keywords
    }
  }

  selectBestModel(analysis: PromptAnalysis, preferences?: {
    prioritizeCost?: boolean
    prioritizeSpeed?: boolean
    prioritizeQuality?: boolean
    allowHuggingFace?: boolean
    maxCostTier?: 'free' | 'low' | 'medium' | 'high'
  }): ModelSelection {
    const startTime = Date.now()
    
    // Score each model based on the analysis
    const modelScores = this.models.map(model => ({
      model: model.id,
      score: this.scoreModel(model, analysis, preferences),
      details: this.getModelScoreDetails(model, analysis)
    }))

    // Sort by score (descending)
    modelScores.sort((a, b) => b.score - a.score)
    
    const bestModel = modelScores[0]
    const alternatives = modelScores.slice(1, 4).map(m => ({
      model: m.model,
      score: m.score,
      reason: m.details.primaryReason
    }))

    // Select fallback (fast, reliable model)
    const fallbackModel = this.selectFallbackModel(analysis, preferences)
    
    const confidence = Math.min(0.95, bestModel.score / 100)
    const modelInfo = this.models.find(m => m.id === bestModel.model)!
    
    const reasoning = this.generateReasoning(modelInfo, analysis, bestModel.details)

    // Record metrics
    const _selectionTime = Date.now() - startTime
    datadogMetrics.recordUserAction('model_selection', 'intelligent_selector', 'auto', {
      tags: {
        selected_model: bestModel.model.replace('/', '_'),
        prompt_type: analysis.type,
        complexity: analysis.complexity,
        confidence_tier: confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low'
      }
    })

    return {
      selectedModel: bestModel.model,
      confidence,
      reasoning,
      alternatives,
      fallbackModel
    }
  }

  private determinePromptType(
    promptLower: string, 
    codeLanguages: string[], 
    metadata?: any
  ): PromptAnalysis['type'] {
    // Code-related keywords
    const codeKeywords = ['code', 'function', 'class', 'variable', 'debug', 'error', 'bug', 'algorithm', 'implement', 'refactor']
    
    // Creative keywords
    const creativeKeywords = ['write', 'story', 'poem', 'creative', 'imagine', 'fiction', 'character', 'plot', 'generate']
    
    // Mathematical keywords
    const mathKeywords = ['calculate', 'solve', 'equation', 'formula', 'math', 'statistics', 'probability', 'integral', 'derivative']
    
    // Translation keywords
    const translationKeywords = ['translate', 'translation', 'language', 'español', 'français', 'deutsch', '中文', '日本語']
    
    // Analytical keywords
    const analyticalKeywords = ['analyze', 'compare', 'evaluate', 'assess', 'review', 'critique', 'examine', 'research']

    if (codeLanguages.length > 0 || codeKeywords.some(k => promptLower.includes(k))) {
      return 'coding'
    }
    
    if (mathKeywords.some(k => promptLower.includes(k))) {
      return 'mathematical'
    }
    
    if (creativeKeywords.some(k => promptLower.includes(k))) {
      return 'creative'
    }
    
    if (translationKeywords.some(k => promptLower.includes(k))) {
      return 'translation'
    }
    
    if (analyticalKeywords.some(k => promptLower.includes(k))) {
      return 'analytical'
    }

    // Check for complex multi-step tasks
    if (promptLower.includes('step') || promptLower.includes('process') || promptLower.includes('plan')) {
      return 'complex'
    }
    
    return 'conversational'
  }

  private detectCodeLanguages(prompt: string): string[] {
    const languages: string[] = []
    const codePatterns = {
      javascript: /\b(javascript|js|node|react|vue|angular|typescript|ts)\b/i,
      python: /\b(python|py|django|flask|pandas|numpy)\b/i,
      java: /\b(java|spring|android)\b/i,
      cpp: /\b(c\+\+|cpp|c\+\+|iostream|std::)\b/i,
      csharp: /\b(c#|csharp|\.net|dotnet)\b/i,
      go: /\b(golang|go\b|goroutine)\b/i,
      rust: /\b(rust|cargo|rustc)\b/i,
      php: /\b(php|laravel|wordpress)\b/i,
      ruby: /\b(ruby|rails|gem)\b/i,
      sql: /\b(sql|database|query|select|insert|update|delete)\b/i
    }

    for (const [lang, pattern] of Object.entries(codePatterns)) {
      if (pattern.test(prompt)) {
        languages.push(lang)
      }
    }

    return languages
  }

  private assessComplexity(prompt: string, metadata?: any): PromptAnalysis['complexity'] {
    let complexityScore = 0

    // Length-based complexity
    if (prompt.length > 500) complexityScore += 2
    else if (prompt.length > 200) complexityScore += 1

    // Multi-step indicators
    const multiStepWords = ['first', 'then', 'next', 'finally', 'step', 'process', 'workflow']
    complexityScore += multiStepWords.filter(word => prompt.toLowerCase().includes(word)).length

    // Technical indicators
    const technicalWords = ['algorithm', 'optimize', 'performance', 'architecture', 'framework', 'integration']
    complexityScore += technicalWords.filter(word => prompt.toLowerCase().includes(word)).length

    // Context requirements
    if (metadata?.hasFiles) complexityScore += 2
    if (metadata?.hasImages) complexityScore += 1
    if ((metadata?.conversationHistory || 0) > 5) complexityScore += 1

    if (complexityScore >= 5) return 'complex'
    if (complexityScore >= 2) return 'medium'
    return 'simple'
  }

  private requiresReasoning(promptLower: string): boolean {
    const reasoningKeywords = ['why', 'how', 'explain', 'analyze', 'compare', 'evaluate', 'reason', 'logic', 'because', 'therefore']
    return reasoningKeywords.some(k => promptLower.includes(k))
  }

  private requiresCreativity(promptLower: string): boolean {
    const creativityKeywords = ['create', 'generate', 'write', 'design', 'invent', 'imagine', 'brainstorm', 'innovative']
    return creativityKeywords.some(k => promptLower.includes(k))
  }

  private requiresAccuracy(promptLower: string): boolean {
    const accuracyKeywords = ['precise', 'exact', 'accurate', 'correct', 'fact', 'data', 'calculate', 'measure']
    return accuracyKeywords.some(k => promptLower.includes(k))
  }

  private extractKeywords(promptLower: string): string[] {
    // Simple keyword extraction
    const words = promptLower.match(/\b\w{4,}\b/g) || []
    const stopWords = new Set(['this', 'that', 'with', 'from', 'they', 'been', 'have', 'their', 'said', 'each', 'which'])
    return words.filter(word => !stopWords.has(word)).slice(0, 10)
  }

  private detectLanguage(prompt: string): string {
    // Simple language detection based on character patterns
    if (/[\u4e00-\u9fff]/.test(prompt)) return 'zh'
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(prompt)) return 'ja'
    if (/[а-яё]/i.test(prompt)) return 'ru'
    if (/[ñáéíóúü]/i.test(prompt)) return 'es'
    if (/[àâäçéèêëïîôöùûüÿ]/i.test(prompt)) return 'fr'
    return 'en'
  }

  private scoreModel(
    model: ModelCapability, 
    analysis: PromptAnalysis, 
    preferences?: any
  ): number {
    let score = 0

    // Base score from model quality
    switch (model.qualityTier) {
      case 'excellent': score += 40; break
      case 'good': score += 25; break
      case 'basic': score += 10; break
    }

    // Strength matching
    const requiredStrengths = this.getRequiredStrengths(analysis)
    const matchingStrengths = model.strengths.filter(s => requiredStrengths.includes(s))
    score += matchingStrengths.length * 15

    // Feature requirements
    if (analysis.hasImages && !model.supportsImages) score -= 30
    if (analysis.codeLanguages.length > 0 && !model.supportsCode) score -= 20
    if (analysis.complexity === 'complex' && !model.supportsFunctionCalling) score -= 10

    // Context length requirements
    const estimatedTokens = analysis.length * 0.75 + (analysis.contextRequired ? 2000 : 0)
    if (estimatedTokens > model.contextLength) score -= 25

    // Preferences
    if (preferences?.prioritizeSpeed && model.speedTier === 'fast') score += 10
    if (preferences?.prioritizeCost && model.costTier === 'free') score += 15
    if (preferences?.prioritizeQuality && model.qualityTier === 'excellent') score += 10
    if (!preferences?.allowHuggingFace && model.provider === 'huggingface') score -= 20

    // Cost filtering
    if (preferences?.maxCostTier) {
      const costOrder = { free: 0, low: 1, medium: 2, high: 3 }
      const maxCost = costOrder[preferences.maxCostTier]
      const modelCost = costOrder[model.costTier]
      if (modelCost > maxCost) score -= 50
    }

    return Math.max(0, score)
  }

  private getRequiredStrengths(analysis: PromptAnalysis): ModelStrength[] {
    const strengths: ModelStrength[] = []

    switch (analysis.type) {
      case 'coding':
        strengths.push('coding', 'reasoning')
        break
      case 'creative':
        strengths.push('creative', 'conversational')
        break
      case 'mathematical':
        strengths.push('mathematical', 'reasoning')
        break
      case 'analytical':
        strengths.push('analysis', 'reasoning')
        break
      case 'translation':
        strengths.push('translation', 'instruction-following')
        break
      case 'conversational':
        strengths.push('conversational', 'instruction-following')
        break
      case 'complex':
        strengths.push('reasoning', 'analysis', 'instruction-following')
        break
    }

    if (analysis.requiresReasoning) strengths.push('reasoning')
    if (analysis.requiresCreativity) strengths.push('creative')

    return [...new Set(strengths)] // Remove duplicates
  }

  private getModelScoreDetails(model: ModelCapability, analysis: PromptAnalysis) {
    const reasons: string[] = []
    
    if (model.strengths.includes('coding') && analysis.type === 'coding') {
      reasons.push('excellent coding capabilities')
    }
    if (model.qualityTier === 'excellent') {
      reasons.push('highest quality responses')
    }
    if (model.speedTier === 'fast') {
      reasons.push('fast response times')
    }
    if (model.costTier === 'free') {
      reasons.push('free to use')
    }

    return {
      primaryReason: reasons[0] || 'general capability match',
      allReasons: reasons
    }
  }

  private selectFallbackModel(analysis: PromptAnalysis, preferences?: any): string {
    // Always return a fast, reliable model as fallback
    if (preferences?.allowHuggingFace && analysis.type === 'conversational') {
      return 'microsoft/DialoGPT-medium'
    }
    return 'anthropic/claude-3-haiku'
  }

  private generateReasoning(model: ModelCapability, analysis: PromptAnalysis, details: any): string {
    const reasons: string[] = [
      `Selected ${model.name} for ${analysis.type} task`,
      `Quality: ${model.qualityTier}, Speed: ${model.speedTier}, Cost: ${model.costTier}`,
    ]

    if (details.allReasons.length > 0) {
      reasons.push(`Key strengths: ${details.allReasons.join(', ')}`)
    }

    if (analysis.complexity === 'complex') {
      reasons.push('Complex task requires advanced reasoning capabilities')
    }

    return reasons.join('. ')
  }

  // Get model by ID
  getModelById(modelId: string): ModelCapability | undefined {
    return this.models.find(m => m.id === modelId)
  }

  // Get all available models
  getAllModels(): ModelCapability[] {
    return [...this.models]
  }

  // Get models by provider
  getModelsByProvider(provider: 'openrouter' | 'huggingface'): ModelCapability[] {
    return this.models.filter(m => m.provider === provider)
  }
}

// Export singleton instance
export const intelligentModelSelection = new IntelligentModelSelectionService()

// Types are already exported above with interface declarations
