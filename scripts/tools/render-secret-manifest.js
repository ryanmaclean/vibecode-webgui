#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const envFile = path.resolve('.env.local')
if (!fs.existsSync(envFile)) {
  console.error('Missing .env.local')
  process.exit(1)
}

const contents = fs.readFileSync(envFile, 'utf8')
const entries = {}
for (const line of contents.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  const key = trimmed.slice(0, eq)
  const value = trimmed.slice(eq + 1).replace(/^"|"$/g, '')
  entries[key] = value
}

const keyMap = {
  OPENROUTER_API_KEY: 'openrouter-api-key',
  OPENAI_API_KEY: 'openai-api-key',
  DD_API_KEY: 'dd-api-key',
  DD_APP_KEY: 'dd-app-key'
}

const data = {}
for (const [envKey, secretKey] of Object.entries(keyMap)) {
  if (entries[envKey]) {
    data[secretKey] = Buffer.from(entries[envKey]).toString('base64')
  }
}

const manifest = {
  apiVersion: 'v1',
  kind: 'Secret',
  metadata: { name: 'vibecode-app-secrets', namespace: 'vibecode-platform' },
  type: 'Opaque',
  data
}

console.log(JSON.stringify(manifest, null, 2))
