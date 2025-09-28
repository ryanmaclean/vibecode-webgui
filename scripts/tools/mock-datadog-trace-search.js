#!/usr/bin/env node

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

function parseArgs() {
  const args = process.argv.slice(2)
  const parsed = { port: 5005, file: null }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--port' && args[i + 1]) {
      parsed.port = Number(args[++i])
    } else if (arg === '--file' && args[i + 1]) {
      parsed.file = args[++i]
    }
  }
  if (!parsed.file) {
    throw new Error('Required argument --file <path-to-json> missing')
  }
  return parsed
}

function loadPayload(file) {
  const resolved = path.resolve(file)
  const contents = fs.readFileSync(resolved, 'utf8')
  const payload = JSON.parse(contents)
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Invalid JSON payload in ${resolved}`)
  }
  return { resolved, payload }
}

function main() {
  const { port, file } = parseArgs()
  const { resolved, payload } = loadPayload(file)

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/v2/spans/events/search') {
      let body = ''
      req.on('data', chunk => {
        body += chunk
      })
      req.on('end', () => {
        const now = new Date().toISOString()
        const response = {
          meta: {
            mocked: true,
            generated_at: now,
            source_file: resolved
          },
          ...payload
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(response))
      })
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  })

  server.listen(port, () => {
    console.log(`Mock Datadog Trace Search server running on http://127.0.0.1:${port}`)
    console.log(`Serving payload from ${resolved}`)
  })
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
