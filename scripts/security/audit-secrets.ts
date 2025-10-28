#!/usr/bin/env tsx
/**
 * Security Audit: Scan for Plaintext Secrets
 * Agent 12: Security Engineer
 *
 * Identifies all plaintext secrets in the codebase and generates migration report.
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

interface SecretPattern {
  name: string
  pattern: RegExp
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: 'api_key' | 'password' | 'token' | 'connection_string'
}

const SECRET_PATTERNS: SecretPattern[] = [
  // API Keys
  {
    name: 'Hardcoded API Key',
    pattern: /['"](sk-[a-zA-Z0-9]{48})['"]/g,
    severity: 'critical',
    category: 'api_key',
  },
  {
    name: 'Generic API Key Assignment',
    pattern: /apiKey\s*[:=]\s*['"](?!your-|test-|mock-|example-)[^'"]{20,}['"]/gi,
    severity: 'high',
    category: 'api_key',
  },
  // Passwords
  {
    name: 'Hardcoded Password',
    pattern: /password\s*[:=]\s*['"](?!dev123|test|password|changeme)[^'"]{8,}['"]/gi,
    severity: 'critical',
    category: 'password',
  },
  // Tokens
  {
    name: 'JWT Token',
    pattern: /['"](eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)['"]/g,
    severity: 'critical',
    category: 'token',
  },
  {
    name: 'Generic Token',
    pattern: /token\s*[:=]\s*['"](?!your-|test-|mock-)[^'"]{20,}['"]/gi,
    severity: 'high',
    category: 'token',
  },
  // Connection Strings
  {
    name: 'Database Connection String',
    pattern: /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@[^'"]+/gi,
    severity: 'critical',
    category: 'connection_string',
  },
  // Environment Variable Access (not a leak, but should use Keychain)
  {
    name: 'Direct process.env Access',
    pattern: /process\.env\.(?:API_KEY|SECRET|PASSWORD|TOKEN|DATABASE_URL)/g,
    severity: 'medium',
    category: 'api_key',
  },
]

interface SecretFinding {
  file: string
  line: number
  pattern: string
  severity: string
  category: string
  context: string
}

async function scanFile(filePath: string): Promise<SecretFinding[]> {
  const findings: SecretFinding[] = []

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    for (const pattern of SECRET_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const matches = line.matchAll(pattern.pattern)

        for (const match of matches) {
          // Skip test files, examples, and documentation
          if (
            filePath.includes('/tests/') ||
            filePath.includes('/examples/') ||
            filePath.includes('.test.') ||
            filePath.includes('.spec.') ||
            filePath.includes('node_modules') ||
            filePath.includes('.md')
          ) {
            continue
          }

          findings.push({
            file: filePath,
            line: i + 1,
            pattern: pattern.name,
            severity: pattern.severity,
            category: pattern.category,
            context: line.trim().substring(0, 100),
          })
        }
      }
    }
  } catch (error) {
    console.error(`Failed to scan ${filePath}: ${error}`)
  }

  return findings
}

async function main() {
  console.log('🔍 Security Audit: Scanning for Plaintext Secrets')
  console.log('================================================\n')

  const rootDir = process.cwd()
  const srcDir = path.join(rootDir, 'src')

  // Find all TypeScript and JavaScript files
  const files: string[] = []
  const extensions = ['.ts', '.tsx', '.js', '.jsx']

  function walkDir(dir: string) {
    if (dir.includes('node_modules') || dir.includes('.next')) return

    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walkDir(fullPath)
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath)
      }
    }
  }

  walkDir(srcDir)

  console.log(`Found ${files.length} files to scan\n`)

  // Scan all files
  const allFindings: SecretFinding[] = []
  for (const file of files) {
    const findings = await scanFile(file)
    allFindings.push(...findings)
  }

  // Group by severity
  const bySeverity = {
    critical: allFindings.filter((f) => f.severity === 'critical'),
    high: allFindings.filter((f) => f.severity === 'high'),
    medium: allFindings.filter((f) => f.severity === 'medium'),
    low: allFindings.filter((f) => f.severity === 'low'),
  }

  // Group by category
  const byCategory = {
    api_key: allFindings.filter((f) => f.category === 'api_key'),
    password: allFindings.filter((f) => f.category === 'password'),
    token: allFindings.filter((f) => f.category === 'token'),
    connection_string: allFindings.filter((f) => f.category === 'connection_string'),
  }

  // Print report
  console.log('📊 SECURITY AUDIT RESULTS')
  console.log('========================\n')

  console.log(`Total Findings: ${allFindings.length}`)
  console.log(`  🔴 Critical: ${bySeverity.critical.length}`)
  console.log(`  🟠 High: ${bySeverity.high.length}`)
  console.log(`  🟡 Medium: ${bySeverity.medium.length}`)
  console.log(`  🟢 Low: ${bySeverity.low.length}\n`)

  console.log('By Category:')
  console.log(`  🔑 API Keys: ${byCategory.api_key.length}`)
  console.log(`  🔒 Passwords: ${byCategory.password.length}`)
  console.log(`  🎫 Tokens: ${byCategory.token.length}`)
  console.log(`  📡 Connection Strings: ${byCategory.connection_string.length}\n`)

  // Print top 20 critical findings
  console.log('🔴 TOP 20 CRITICAL FINDINGS')
  console.log('===========================\n')

  const criticalFindings = bySeverity.critical.slice(0, 20)
  for (const finding of criticalFindings) {
    const relativePath = finding.file.replace(rootDir, '.')
    console.log(`${relativePath}:${finding.line}`)
    console.log(`  Pattern: ${finding.pattern}`)
    console.log(`  Context: ${finding.context}`)
    console.log('')
  }

  // Count process.env access patterns
  console.log('\n🔧 ENVIRONMENT VARIABLE ACCESS PATTERNS')
  console.log('=======================================\n')

  const envPatterns = allFindings.filter((f) => f.pattern === 'Direct process.env Access')
  const uniqueKeys = new Set(envPatterns.map((f) => f.context.match(/process\.env\.(\w+)/)?.[1]))

  console.log(`Total process.env accesses: ${envPatterns.length}`)
  console.log(`Unique environment variables: ${uniqueKeys.size}\n`)

  const topKeys = Array.from(uniqueKeys)
    .map((key) => ({
      key,
      count: envPatterns.filter((f) => f.context.includes(`process.env.${key}`)).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  console.log('Top 20 Environment Variables:')
  for (const { key, count } of topKeys) {
    console.log(`  ${key}: ${count} usages`)
  }

  // Generate migration recommendations
  console.log('\n📋 MIGRATION RECOMMENDATIONS')
  console.log('============================\n')

  const secretsToMigrate = Array.from(uniqueKeys)
    .filter((key) => key?.match(/(API_KEY|SECRET|PASSWORD|TOKEN|DATABASE_URL)/))
    .slice(0, 20)

  console.log('Priority secrets to migrate to Keychain:')
  for (const key of secretsToMigrate) {
    console.log(`  - ${key}`)
  }

  // Save detailed report
  const reportPath = path.join(rootDir, 'claudedocs', 'security-audit-report.json')
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          total: allFindings.length,
          critical: bySeverity.critical.length,
          high: bySeverity.high.length,
          medium: bySeverity.medium.length,
          low: bySeverity.low.length,
        },
        categories: {
          api_key: byCategory.api_key.length,
          password: byCategory.password.length,
          token: byCategory.token.length,
          connection_string: byCategory.connection_string.length,
        },
        findings: allFindings,
        secretsToMigrate,
      },
      null,
      2
    )
  )

  console.log(`\n✅ Detailed report saved to: ${reportPath}`)

  // Exit with error if critical findings exist
  if (bySeverity.critical.length > 0) {
    console.log('\n⚠️  CRITICAL: Plaintext secrets detected!')
    console.log('Run migration: npm run security:migrate-keychain')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Audit failed:', error)
  process.exit(1)
})
