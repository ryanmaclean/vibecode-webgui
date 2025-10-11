#!/usr/bin/env tsx
/**
 * API Validation Audit Script
 *
 * Scans all API routes and identifies which ones lack Zod validation
 * Categorizes routes by risk level and validation status
 */

import * as fs from 'fs'
import * as path from 'path'
import { glob } from 'glob'

interface RouteInfo {
  path: string
  relativePath: string
  methods: string[]
  hasZodImport: boolean
  hasValidation: boolean
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  category: string
  lineCount: number
}

interface AuditReport {
  totalRoutes: number
  validatedRoutes: number
  unvalidatedRoutes: number
  highRiskUnvalidated: number
  mediumRiskUnvalidated: number
  lowRiskUnvalidated: number
  routesByCategory: Record<string, RouteInfo[]>
  highPriorityRoutes: RouteInfo[]
}

/** Determine route category from path */
function categorizeRoute(routePath: string): string {
  if (routePath.includes('/auth/')) return 'authentication'
  if (routePath.includes('/user/')) return 'user-management'
  if (routePath.includes('/admin/')) return 'admin'
  if (routePath.includes('/workspace')) return 'workspace'
  if (routePath.includes('/file')) return 'files'
  if (routePath.includes('/container')) return 'containers'
  if (routePath.includes('/ai/') || routePath.includes('/claude/')) return 'ai-services'
  if (routePath.includes('/monitoring/')) return 'monitoring'
  if (routePath.includes('/health')) return 'health'
  return 'other'
}

/** Determine risk level based on route category and methods */
function assessRiskLevel(category: string, methods: string[]): 'HIGH' | 'MEDIUM' | 'LOW' {
  // High risk: authentication, user management, admin, data modification
  if (
    category === 'authentication' ||
    category === 'admin' ||
    category === 'user-management' ||
    methods.includes('POST') ||
    methods.includes('PUT') ||
    methods.includes('DELETE')
  ) {
    return 'HIGH'
  }

  // Medium risk: workspace operations, AI services, file operations
  if (
    category === 'workspace' ||
    category === 'ai-services' ||
    category === 'files' ||
    category === 'containers'
  ) {
    return 'MEDIUM'
  }

  // Low risk: health checks, monitoring (read-only)
  return 'LOW'
}

/** Extract HTTP methods from route file */
function extractMethods(content: string): string[] {
  const methods: string[] = []
  const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS)\s*\(/g

  let match
  while ((match = methodRegex.exec(content)) !== null) {
    methods.push(match[1])
  }

  return methods
}

/** Check if route has Zod validation */
function hasValidation(content: string, hasZodImport: boolean): boolean {
  if (!hasZodImport) return false

  // Check for common validation patterns
  const validationPatterns = [
    /\.parse\s*\(/,
    /\.safeParse\s*\(/,
    /validateRequestBody/,
    /validateQueryParams/,
    /validatePathParams/,
    /createValidatedHandler/,
    /Schema\.parse/
  ]

  return validationPatterns.some((pattern) => pattern.test(content))
}

/** Analyze a single route file */
function analyzeRoute(filePath: string, projectRoot: string): RouteInfo {
  const content = fs.readFileSync(filePath, 'utf-8')
  const relativePath = path.relative(projectRoot, filePath)
  const methods = extractMethods(content)
  const hasZodImport = /from\s+['"]zod['"]/.test(content) || /import.*zod/.test(content)
  const hasValidationCheck = hasValidation(content, hasZodImport)
  const category = categorizeRoute(relativePath)
  const riskLevel = assessRiskLevel(category, methods)
  const lineCount = content.split('\n').length

  return {
    path: filePath,
    relativePath,
    methods,
    hasZodImport,
    hasValidation: hasValidationCheck,
    riskLevel,
    category,
    lineCount
  }
}

/** Generate audit report */
async function auditApiRoutes(): Promise<AuditReport> {
  const projectRoot = process.cwd()
  const apiRoutesPattern = 'src/app/api/**/route.ts'

  console.log('🔍 Scanning API routes...\n')

  const routeFiles = await glob(apiRoutesPattern, { cwd: projectRoot })
  console.log(`Found ${routeFiles.length} API route files\n`)

  const routes: RouteInfo[] = []

  for (const routeFile of routeFiles) {
    const fullPath = path.join(projectRoot, routeFile)
    const routeInfo = analyzeRoute(fullPath, projectRoot)
    routes.push(routeInfo)
  }

  // Calculate statistics
  const validatedRoutes = routes.filter((r) => r.hasValidation)
  const unvalidatedRoutes = routes.filter((r) => !r.hasValidation)

  const highRiskUnvalidated = unvalidatedRoutes.filter((r) => r.riskLevel === 'HIGH')
  const mediumRiskUnvalidated = unvalidatedRoutes.filter((r) => r.riskLevel === 'MEDIUM')
  const lowRiskUnvalidated = unvalidatedRoutes.filter((r) => r.riskLevel === 'LOW')

  // Group by category
  const routesByCategory: Record<string, RouteInfo[]> = {}
  routes.forEach((route) => {
    if (!routesByCategory[route.category]) {
      routesByCategory[route.category] = []
    }
    routesByCategory[route.category].push(route)
  })

  // High priority routes (high risk + unvalidated)
  const highPriorityRoutes = highRiskUnvalidated.sort((a, b) => {
    // Prioritize auth > admin > user > other
    const categoryPriority: Record<string, number> = {
      authentication: 1,
      admin: 2,
      'user-management': 3,
      workspace: 4,
      'ai-services': 5
    }
    return (categoryPriority[a.category] || 99) - (categoryPriority[b.category] || 99)
  })

  return {
    totalRoutes: routes.length,
    validatedRoutes: validatedRoutes.length,
    unvalidatedRoutes: unvalidatedRoutes.length,
    highRiskUnvalidated: highRiskUnvalidated.length,
    mediumRiskUnvalidated: mediumRiskUnvalidated.length,
    lowRiskUnvalidated: lowRiskUnvalidated.length,
    routesByCategory,
    highPriorityRoutes
  }
}

/** Print audit report */
function printReport(report: AuditReport): void {
  console.log('━'.repeat(80))
  console.log('API VALIDATION SECURITY AUDIT REPORT')
  console.log('━'.repeat(80))
  console.log()

  // Summary
  console.log('📊 SUMMARY')
  console.log('─'.repeat(80))
  console.log(`Total API Routes:            ${report.totalRoutes}`)
  console.log(`Validated Routes:            ${report.validatedRoutes} (${Math.round((report.validatedRoutes / report.totalRoutes) * 100)}%)`)
  console.log(`Unvalidated Routes:          ${report.unvalidatedRoutes} (${Math.round((report.unvalidatedRoutes / report.totalRoutes) * 100)}%)`)
  console.log()
  console.log('🚨 RISK BREAKDOWN (Unvalidated)')
  console.log(`  HIGH Risk:                 ${report.highRiskUnvalidated}`)
  console.log(`  MEDIUM Risk:               ${report.mediumRiskUnvalidated}`)
  console.log(`  LOW Risk:                  ${report.lowRiskUnvalidated}`)
  console.log()

  // Category breakdown
  console.log('📂 BY CATEGORY')
  console.log('─'.repeat(80))
  Object.keys(report.routesByCategory)
    .sort()
    .forEach((category) => {
      const routes = report.routesByCategory[category]
      const validated = routes.filter((r) => r.hasValidation).length
      const unvalidated = routes.length - validated
      const percentage = Math.round((validated / routes.length) * 100)

      console.log(
        `${category.padEnd(20)} Total: ${routes.length.toString().padStart(2)}  Validated: ${validated.toString().padStart(2)}  Unvalidated: ${unvalidated.toString().padStart(2)}  (${percentage}%)`
      )
    })
  console.log()

  // High priority routes
  if (report.highPriorityRoutes.length > 0) {
    console.log('🎯 TOP 20 HIGH-PRIORITY ROUTES (Highest Risk + Unvalidated)')
    console.log('─'.repeat(80))
    report.highPriorityRoutes.slice(0, 20).forEach((route, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. [${route.riskLevel}] ${route.category}`)
      console.log(`    ${route.relativePath}`)
      console.log(`    Methods: ${route.methods.join(', ')}`)
      console.log()
    })
  }

  // Recommendations
  console.log('💡 RECOMMENDATIONS')
  console.log('─'.repeat(80))
  console.log('1. Prioritize validation for HIGH risk routes (auth, admin, user management)')
  console.log('2. Implement validation middleware using src/lib/api/validation/middleware.ts')
  console.log('3. Use reusable schemas from src/lib/api/validation/schemas.ts')
  console.log('4. Target: 100% validation coverage for HIGH and MEDIUM risk routes')
  console.log('5. Estimated work: ~20 routes per session, 4-5 sessions to complete')
  console.log()

  console.log('━'.repeat(80))
}

/** Save report to JSON file */
function saveReportToFile(report: AuditReport): void {
  const outputPath = path.join(process.cwd(), 'claudedocs', 'api-validation-audit.json')
  const outputDir = path.dirname(outputPath)

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))
  console.log(`\n📄 Full report saved to: ${outputPath}`)
}

/** Main execution */
async function main() {
  try {
    const report = await auditApiRoutes()
    printReport(report)
    saveReportToFile(report)
    process.exit(0)
  } catch (error) {
    console.error('Error running audit:', error)
    process.exit(1)
  }
}

main()
