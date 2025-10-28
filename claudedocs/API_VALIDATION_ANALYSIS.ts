/**
 * API Route Validation Analysis Script
 * Analyzes all API routes to identify which have Zod validation
 */

import * as fs from 'fs'
import * as path from 'path'

interface RouteAnalysis {
  path: string
  hasValidation: boolean
  methods: string[]
  criticality: 'critical' | 'high' | 'medium' | 'low'
  securityRisk: string[]
  validationPatterns: string[]
}

// Critical routes that handle sensitive data
const CRITICAL_ROUTES = [
  '/api/auth/',
  '/api/user/',
  '/api/claude/',
  '/api/agents/',
  '/api/containers/',
  '/api/workspace/',
  '/api/files/',
  '/api/chat/',
]

const HIGH_RISK_ROUTES = [
  '/api/ai/',
  '/api/code-server/',
  '/api/terminal/',
  '/api/uploads/',
]

function analyzeRouteFile(filePath: string): RouteAnalysis {
  const content = fs.readFileSync(filePath, 'utf-8')
  const relativePath = filePath.replace('/Users/string/vibecode-webgui/', '')

  // Check for validation patterns
  const hasZodImport = /import.*zod|from ['"]zod['"]/.test(content)
  const hasParseMethod = /\.parse\(|\.safeParse\(/.test(content)
  const hasValidateMiddleware = /validateRequestBody|validatePathParams/.test(content)
  const hasValidation = hasZodImport && (hasParseMethod || hasValidateMiddleware)

  // Detect HTTP methods
  const methods: string[] = []
  if (/export async function GET/.test(content)) methods.push('GET')
  if (/export async function POST/.test(content)) methods.push('POST')
  if (/export async function PUT/.test(content)) methods.push('PUT')
  if (/export async function PATCH/.test(content)) methods.push('PATCH')
  if (/export async function DELETE/.test(content)) methods.push('DELETE')

  // Determine criticality
  let criticality: 'critical' | 'high' | 'medium' | 'low' = 'low'
  if (CRITICAL_ROUTES.some(route => relativePath.includes(route))) {
    criticality = 'critical'
  } else if (HIGH_RISK_ROUTES.some(route => relativePath.includes(route))) {
    criticality = 'high'
  } else if (methods.includes('POST') || methods.includes('PUT') || methods.includes('DELETE')) {
    criticality = 'medium'
  }

  // Identify security risks
  const securityRisk: string[] = []
  if (/await request\.json\(\)/.test(content) && !hasValidation) {
    securityRisk.push('Unvalidated JSON input')
  }
  if (/searchParams\.get/.test(content) && !hasValidation) {
    securityRisk.push('Unvalidated query parameters')
  }
  if (/params\[/.test(content) && !hasValidation) {
    securityRisk.push('Unvalidated path parameters')
  }
  if (/formData/.test(content) && !hasValidation) {
    securityRisk.push('Unvalidated form data')
  }

  // Detect validation patterns
  const validationPatterns: string[] = []
  if (hasParseMethod) validationPatterns.push('zod.parse()')
  if (hasValidateMiddleware) validationPatterns.push('validation middleware')

  return {
    path: relativePath,
    hasValidation,
    methods,
    criticality,
    securityRisk,
    validationPatterns,
  }
}

function findRouteFiles(dir: string): string[] {
  const routes: string[] = []

  function traverse(currentDir: string) {
    const items = fs.readdirSync(currentDir)

    for (const item of items) {
      const fullPath = path.join(currentDir, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        traverse(fullPath)
      } else if (item === 'route.ts' || item === 'route.tsx') {
        routes.push(fullPath)
      }
    }
  }

  traverse(dir)
  return routes
}

// Main analysis
const apiDir = '/Users/string/vibecode-webgui/src/app/api'
const routeFiles = findRouteFiles(apiDir)

console.log(`Found ${routeFiles.length} API route files\n`)

const analyses = routeFiles.map(analyzeRouteFile)

// Group by validation status
const validated = analyses.filter(a => a.hasValidation)
const unvalidated = analyses.filter(a => !a.hasValidation)

// Group by criticality
const critical = analyses.filter(a => a.criticality === 'critical')
const criticalUnvalidated = critical.filter(a => !a.hasValidation)

console.log('=== SUMMARY ===')
console.log(`Total routes: ${analyses.length}`)
console.log(`Validated: ${validated.length} (${Math.round(validated.length / analyses.length * 100)}%)`)
console.log(`Unvalidated: ${unvalidated.length} (${Math.round(unvalidated.length / analyses.length * 100)}%)`)
console.log(`\nCritical routes: ${critical.length}`)
console.log(`Critical unvalidated: ${criticalUnvalidated.length}\n`)

console.log('=== TOP 10 CRITICAL UNVALIDATED ROUTES ===')
const top10 = analyses
  .filter(a => !a.hasValidation)
  .sort((a, b) => {
    const criticalityScore = { critical: 4, high: 3, medium: 2, low: 1 }
    return criticalityScore[b.criticality] - criticalityScore[a.criticality]
  })
  .slice(0, 10)

top10.forEach((route, idx) => {
  console.log(`\n${idx + 1}. ${route.path}`)
  console.log(`   Criticality: ${route.criticality.toUpperCase()}`)
  console.log(`   Methods: ${route.methods.join(', ')}`)
  console.log(`   Security Risks: ${route.securityRisk.join(', ') || 'None detected'}`)
})

console.log('\n=== ALL UNVALIDATED ROUTES BY CRITICALITY ===')
;['critical', 'high', 'medium', 'low'].forEach(level => {
  const routes = unvalidated.filter(a => a.criticality === level)
  if (routes.length > 0) {
    console.log(`\n${level.toUpperCase()} (${routes.length}):`)
    routes.forEach(r => console.log(`  - ${r.path}`))
  }
})
