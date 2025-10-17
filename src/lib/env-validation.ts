/**
 * Environment Variable Validation
 * Validates and provides type-safe access to environment variables
 */

import { z } from '@/lib/zod-compat'
import { logger } from '@/lib/logger';
// Define environment variable schemas
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // App configuration
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  
  // Database
  DATABASE_URL: z.string().url().optional(),
  
  // Redis
  REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // AI Services
  OPENROUTER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  CLAUDE_API_KEY: z.string().optional(),
  
  // OAuth
  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // Datadog
  DD_API_KEY: z.string().optional(),
  DD_SITE: z.string().default('datadoghq.com'),
  DD_ENV: z.string().default('development'),
  DD_SERVICE: z.string().default('vibecode-webgui'),
  DD_VERSION: z.string().default('1.0.0'),
  
  // Frontend RUM (public variables)
  NEXT_PUBLIC_DD_APPLICATION_ID: z.string().optional(),
  NEXT_PUBLIC_DD_CLIENT_TOKEN: z.string().optional(),
  NEXT_PUBLIC_DD_SITE: z.string().default('datadoghq.com'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').optional(),
  
  // Rate limiting
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).transform(Number).default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default('900000'),
  
  // API keys for validation
  VALID_API_KEYS: z.string().optional(),
  
  // Default admin user (development only)
  DEFAULT_ADMIN_EMAIL: z.string().email().optional(),
  DEFAULT_ADMIN_PASSWORD: z.string().min(8).optional(),
  
  // Platform configuration
  PLATFORM_DOMAIN: z.string().default('vibecode.dev'),
  KUBERNETES_NAMESPACE: z.string().default('vibecode-platform'),
  
  // Feature flags
  ENABLE_MONITORING: z.string().transform(val => val === 'true').default('true'),
  ENABLE_PERFORMANCE_TRACKING: z.string().transform(val => val === 'true').default('true'),
  ENABLE_ERROR_TRACKING: z.string().transform(val => val === 'true').default('true'),
  ENABLE_AI_ANALYTICS: z.string().transform(val => val === 'true').default('true'),
  
  // Health check configuration
  HEALTH_CHECK_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('5000'),
  HEALTH_CHECK_INTERVAL: z.string().regex(/^\d+$/).transform(Number).default('30000'),
  
  // AI configuration
  DEFAULT_LLM_MODEL: z.string().default('gpt-4-turbo'),
  MAX_TOKENS: z.string().regex(/^\d+$/).transform(Number).default('4000'),
  TEMPERATURE: z.string().regex(/^\d*\.?\d+$/).transform(Number).default('0.7'),
  
  // Storage and sizing
  AI_REQUEST_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('30000'),
  AI_MAX_TOKENS: z.string().regex(/^\d+$/).transform(Number).default('4096'),
})

// Type for validated environment variables
export type Env = z.infer<typeof envSchema>

// Validate environment variables
let validatedEnv: Env | null = null

export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv
  }

  try {
    validatedEnv = envSchema.parse(process.env)
    // Debug log removed
    
    // Log warnings for missing optional but recommended variables
    const warnings: string[] = []
    
    if (!validatedEnv.DATABASE_URL) {
      warnings.push('DATABASE_URL not set - database features will be limited')
    }
    
    if (!validatedEnv.REDIS_URL && !validatedEnv.UPSTASH_REDIS_REST_URL) {
      warnings.push('Redis not configured - rate limiting and caching will use in-memory store')
    }
    
    if (!validatedEnv.OPENROUTER_API_KEY && !validatedEnv.OPENAI_API_KEY && !validatedEnv.CLAUDE_API_KEY) {
      warnings.push('No AI API keys configured - AI features will be limited to mock responses')
    }
    
    if (!validatedEnv.DD_API_KEY) {
      warnings.push('Datadog API key not set - monitoring features will be limited')
    }
    
    if (validatedEnv.NODE_ENV === 'production') {
      if (!validatedEnv.JWT_SECRET) {
        warnings.push('JWT_SECRET not set in production - this is a security risk')
      }
      
      if (!validatedEnv.SESSION_SECRET) {
        warnings.push('SESSION_SECRET not set in production - this is a security risk')
      }
      
      if (validatedEnv.DEFAULT_ADMIN_PASSWORD) {
        warnings.push('DEFAULT_ADMIN_PASSWORD should not be set in production')
      }
    }
    
    if (warnings.length > 0) {
      logger.warn('⚠️  Environment variable warnings:')
      warnings.forEach(warning => logger.warn(`  - ${warning}`))
    }
    
    return validatedEnv
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('❌ Environment variable validation failed:')
      error.errors.forEach(err => {
        logger.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
      
      // In development, provide helpful suggestions
      if (process.env.NODE_ENV === 'development') {
        logger.error('\n💡 To fix these issues:')
        logger.error('  1. Copy .env.example to .env')
        logger.error('  2. Fill in the required values')
        logger.error('  3. Restart the development server')
      }
    } else {
      logger.error('❌ Unexpected error validating environment variables:', error)
    }
    
    // Exit in production, continue with warnings in development
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    } else {
      logger.warn('⚠️  Continuing with invalid environment in development mode')
      return envSchema.parse({}) // Use defaults
    }
  }
}

/**
 * Get validated environment variable
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    return validateEnv()
  }
  return validatedEnv
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof Pick<Env, 
  'ENABLE_MONITORING' | 
  'ENABLE_PERFORMANCE_TRACKING' | 
  'ENABLE_ERROR_TRACKING' | 
  'ENABLE_AI_ANALYTICS'
>): boolean {
  const env = getEnv()
  return env[feature]
}

/**
 * Get database configuration
 */
export function getDatabaseConfig(): {
  url?: string
  available: boolean
} {
  const env = getEnv()
  return {
    url: env.DATABASE_URL,
    available: !!env.DATABASE_URL
  }
}

/**
 * Get Redis configuration
 */
export function getRedisConfig(): {
  url?: string
  upstashUrl?: string
  upstashToken?: string
  available: boolean
} {
  const env = getEnv()
  return {
    url: env.REDIS_URL,
    upstashUrl: env.UPSTASH_REDIS_REST_URL,
    upstashToken: env.UPSTASH_REDIS_REST_TOKEN,
    available: !!(env.REDIS_URL || (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN))
  }
}

/**
 * Get AI service configuration
 */
export function getAIConfig(): {
  openrouter?: string
  openai?: string
  claude?: string
  available: boolean
  defaultModel: string
  maxTokens: number
  temperature: number
  timeout: number
} {
  const env = getEnv()
  return {
    openrouter: env.OPENROUTER_API_KEY,
    openai: env.OPENAI_API_KEY,
    claude: env.CLAUDE_API_KEY,
    available: !!(env.OPENROUTER_API_KEY || env.OPENAI_API_KEY || env.CLAUDE_API_KEY),
    defaultModel: env.DEFAULT_LLM_MODEL,
    maxTokens: env.AI_MAX_TOKENS,
    temperature: env.TEMPERATURE,
    timeout: env.AI_REQUEST_TIMEOUT
  }
}

/**
 * Get Datadog configuration
 */
export function getDatadogConfig(): {
  apiKey?: string
  site: string
  env: string
  service: string
  version: string
  rumApplicationId?: string
  rumClientToken?: string
  available: boolean
} {
  const env = getEnv()
  return {
    apiKey: env.DD_API_KEY,
    site: env.DD_SITE,
    env: env.DD_ENV,
    service: env.DD_SERVICE,
    version: env.DD_VERSION,
    rumApplicationId: env.NEXT_PUBLIC_DD_APPLICATION_ID,
    rumClientToken: env.NEXT_PUBLIC_DD_CLIENT_TOKEN,
    available: !!env.DD_API_KEY
  }
}

/**
 * Get OAuth configuration
 */
export function getOAuthConfig(): {
  github: { id?: string; secret?: string; available: boolean }
  google: { id?: string; secret?: string; available: boolean }
} {
  const env = getEnv()
  return {
    github: {
      id: env.GITHUB_ID,
      secret: env.GITHUB_SECRET,
      available: !!(env.GITHUB_ID && env.GITHUB_SECRET)
    },
    google: {
      id: env.GOOGLE_CLIENT_ID,
      secret: env.GOOGLE_CLIENT_SECRET,
      available: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    }
  }
}

/**
 * Validate environment on startup
 */
if (typeof window === 'undefined') {
  // Only validate on server side
  validateEnv()
}