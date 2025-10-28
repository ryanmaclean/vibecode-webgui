#!/usr/bin/env node
import { promises as fs } from 'fs'
import path from 'path'

const templatePath = path.resolve('reports/nightly/template.md')
const outputDir = path.resolve('reports/nightly/generated')

const now = new Date()
const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outFile = path.join(outputDir, `report-${timestamp}.md`)

async function main() {
  const template = await fs.readFile(templatePath, 'utf8')
  await fs.mkdir(outputDir, { recursive: true })

  const filled = template.replace('Date:', `Date: ${now.toISOString().slice(0, 10)}`)
  await fs.writeFile(outFile, filled)
  console.log(`Nightly report stub written to ${outFile}`)
}

main().catch((error) => {
  console.error('Failed to generate nightly report stub', error)
  process.exit(1)
})
