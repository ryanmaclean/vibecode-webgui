#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const repoRoot = join(__dirname, '..')
const env = {
  ...process.env,
  CODEX_HOME: join(repoRoot, '.codex')
}

const args = process.argv.slice(2)

const child = spawn('codex', args, {
  stdio: 'inherit',
  env
})

child.on('exit', code => {
  if (typeof code === 'number') {
    process.exit(code)
  } else {
    process.exit(1)
  }
})
