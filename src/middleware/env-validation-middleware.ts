/**
 * Environment Validation Middleware
 * Validates environment variables during application startup
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateEnvironmentVariables, type ValidationResult } from '../lib/env-validation';
import { logger } from '../lib/logger';

let validationResult: ValidationResult | null = null;
let lastValidation = 0;
const VALIDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Validate environment on application startup
 */
export function validateEnvironmentOnStartup(): void {
  console.log('🔍 Validating environment configuration...');
  
  const result = validateEnvironmentVariables();
  validationResult = result;
  lastValidation = Date.now();
  
  if (result.isValid) {
    console.log('✅ Environment validation passed');
  } else {
    console.error('❌ Environment validation failed');
    
    if (result.missingRequired.length > 0) {
      console.error('Missing required variables:', result.missingRequired.join(', '));
      console.error('📖 Run: npm run setup:env to configure your environment');
      console.error('📋 Or copy .env.local.example to .env.local and update values');
    }
    
    if (result.invalidValues.length > 0) {
      console.error('Invalid values found:', result.invalidValues.map(v => v.name).join(', '));
    }
    
    // Don't exit in development, just warn
    if (process.env.NODE_ENV === 'production') {
      console.error('💥 Exiting due to environment validation failures in production');
      process.exit(1);
    } else {
      console.warn('⚠️  Continuing in development mode despite validation issues');
    }
  }
  
  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment warnings:');
    result.warnings.forEach(warning => console.warn(`  • ${warning}`));
  }
  
  if (result.suggestions.length > 0) {
    console.info('💡 Suggestions:');
    result.suggestions.forEach(suggestion => console.info(`  • ${suggestion}`));
  }
}

/**
 * Get cached validation result
 */
export function getCachedValidationResult(): ValidationResult | null {
  if (!validationResult || (Date.now() - lastValidation) > VALIDATION_CACHE_TTL) {
    validationResult = validateEnvironmentVariables();
    lastValidation = Date.now();
  }
  return validationResult;
}

/**
 * Middleware to check environment health
 */
export function environmentHealthMiddleware(req: NextRequest) {
  // Skip validation for static assets and API routes during development
  if (process.env.NODE_ENV === 'development' && 
      (req.nextUrl.pathname.startsWith('/_next/') || 
       req.nextUrl.pathname.startsWith('/api/health'))) {
    return NextResponse.next();
  }
  
  const result = getCachedValidationResult();
  
  if (!result?.isValid && process.env.NODE_ENV === 'production') {
    // In production, redirect to an error page for invalid environment
    return new NextResponse(
      JSON.stringify({
        error: 'Environment Configuration Error',
        message: 'Application is not properly configured.',
        details: {
          missingRequired: result?.missingRequired || [],
          invalidValues: result?.invalidValues || []
        }
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '300' // 5 minutes
        }
      }
    );
  }
  
  return NextResponse.next();
}

/**
 * Health check endpoint handler
 */
export function createEnvironmentHealthHandler() {
  return function handler(req: NextRequest) {
    const result = getCachedValidationResult();
    
    const healthStatus = {
      status: result?.isValid ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      validation: {
        isValid: result?.isValid || false,
        missingRequired: result?.missingRequired || [],
        invalidValues: result?.invalidValues?.map(v => ({ name: v.name, error: v.error })) || [],
        warnings: result?.warnings || [],
        suggestions: result?.suggestions || []
      },
      services: {
        database: !!process.env.DATABASE_URL,
        cache: !!(process.env.VALKEY_URL || process.env.REDIS_URL),
        mongodb: !!process.env.MONGODB_URL,
        ai: !!(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
        monitoring: !!process.env.DD_API_KEY
      }
    };
    
    const status = healthStatus.status === 'healthy' ? 200 : 503;
    
    return new NextResponse(
      JSON.stringify(healthStatus, null, 2),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    );
  };
}

/**
 * Express middleware for non-Next.js applications
 */
export function createExpressEnvironmentMiddleware() {
  return function(req: any, res: any, next: any) {
    const result = getCachedValidationResult();
    
    // Add environment status to request
    req.environmentStatus = {
      isValid: result?.isValid || false,
      issues: {
        missingRequired: result?.missingRequired || [],
        invalidValues: result?.invalidValues || []
      }
    };
    
    // In production, fail fast on invalid environment
    if (!result?.isValid && process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'Environment Configuration Error',
        message: 'Application is not properly configured.',
        details: req.environmentStatus.issues
      });
    }
    
    next();
  };
}

export default {
  validateEnvironmentOnStartup,
  getCachedValidationResult,
  environmentHealthMiddleware,
  createEnvironmentHealthHandler,
  createExpressEnvironmentMiddleware
};