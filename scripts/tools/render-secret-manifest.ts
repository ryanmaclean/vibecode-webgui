#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'

const envFile = path.resolve('.env.local')
if (!fs.existsSync(envFile)) {
  console.error('Missing .env.local')
  process.exit(1)
}
const lines = fs.readFileSync(envFile, 'utf8').split('\n')
const entries: Record<string, string> = {}
for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  const key = trimmed.slice(0, eq)
  const value = trimmed.slice(eq + 1)
  entries[key] = value.replace(/^"|"$/g, '')
}
const keyMap = {
  OPENROUTER_API_KEY: 'openrouter-api-key',
  OPENAI_API_KEY: 'openai-api-key',
  DD_API_KEY: 'dd-api-key',
  DD_APP_KEY: 'dd-app-key'
} as const
const kv: Record<string, string> = {}
for (const [envKey, secretKey] of Object.entries(keyMap)) {
  const value = entries[envKey]
  if (value) kv[secretKey] = Buffer.from(value).toString('base64')
}
const manifest = {
  apiVersion: 'v1',
  kind: 'Secret',
  metadata: { name: 'vibecode-app-secrets', namespace: 'vibecode-platform' },
  type: 'Opaque',
  data: kv
}
console.log(JSON.stringify(manifest, null, 2))
