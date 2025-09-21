#!/usr/bin/env node

import { spawn } from 'child_process'

const NAMESPACE = process.env.NAMESPACE || 'vibecode-platform'
const SERVICE = process.env.SERVICE || 'svc/vibecode-app'
const LOCAL_PORT = process.env.LOCAL_PORT || '38080'
const TARGET_PORT = process.env.TARGET_PORT || '80'
const BASE_URL = `http://127.0.0.1:${LOCAL_PORT}`
const EMAIL = process.env.TEST_EMAIL || 'developer@vibecode.dev'
const PASSWORD = process.env.TEST_PASSWORD || 'dev123'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForPortForward(proc) {
  return new Promise((resolve, reject) => {
    let resolved = false
    const handler = chunk => {
      const text = chunk.toString()
      process.stderr.write(`[port-forward] ${text}`)
      if (!resolved && /Forwarding from/.test(text)) {
        resolved = true
        clearTimeout(timer)
        resolve(undefined)
      }
    }

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        reject(new Error('Timeout waiting for kubectl port-forward to be ready'))
      }
    }, 10000)

    proc.stderr.on('data', handler)
    proc.stdout.on('data', handler)

    proc.once('exit', code => {
      if (!resolved) {
        clearTimeout(timer)
        reject(new Error(`kubectl port-forward exited early with code ${code}`))
      }
    })
  })
}

function parseCookies(setCookieHeaders = []) {
  const jar = new Map()
  for (const header of setCookieHeaders) {
    const [cookie] = header.split(';', 1)
    if (!cookie) continue
    const [name, ...rest] = cookie.split('=')
    if (!name || rest.length === 0) continue
    jar.set(name.trim(), rest.join('='))
  }
  return jar
}

function mergeCookies(jar, setCookieHeaders) {
  const updates = parseCookies(setCookieHeaders)
  for (const [key, value] of updates.entries()) {
    jar.set(key, value)
  }
}

function cookieHeader(jar) {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

async function fetchWithCookies(url, options = {}, jar) {
  const headers = new Headers(options.headers || {})
  if (jar && jar.size > 0) {
    headers.set('cookie', cookieHeader(jar))
  }
  const response = await fetch(url, { ...options, headers })
  const getSetCookie = response.headers.getSetCookie ? response.headers.getSetCookie.bind(response.headers) : null
  const setCookie = getSetCookie ? getSetCookie() : []
  if (jar) {
    mergeCookies(jar, setCookie)
  }
  return response
}

async function run() {
  const portForward = spawn('kubectl', [
    'port-forward',
    SERVICE,
    `${LOCAL_PORT}:${TARGET_PORT}`,
    '-n',
    NAMESPACE
  ])

  try {
    await waitForPortForward(portForward)

    // Wait briefly to ensure port is ready
    await sleep(500)

    // Health check with retries
    let healthOk = false
    for (let i = 0; i < 10; i++) {
      try {
        const res = await fetch(`${BASE_URL}/api/health`)
        if (res.ok) {
          healthOk = true
          break
        }
      } catch (err) {
        await sleep(300)
      }
    }

    if (!healthOk) {
      throw new Error('Failed to reach /api/health after port-forward')
    }

    const jar = new Map()

    // Obtain CSRF token
    const csrfRes = await fetchWithCookies(`${BASE_URL}/api/auth/csrf`, {}, jar)
    if (!csrfRes.ok) {
      throw new Error(`Failed to fetch CSRF token: ${csrfRes.status}`)
    }
    const csrfJson = await csrfRes.json()
    const csrfToken = csrfJson.csrfToken
    if (!csrfToken) {
      throw new Error('Missing csrfToken in response')
    }

    // Perform credentials login
    const loginBody = new URLSearchParams({
      csrfToken,
      callbackUrl: '/',
      json: 'true',
      email: EMAIL,
      password: PASSWORD
    }).toString()

    const loginRes = await fetchWithCookies(
      `${BASE_URL}/api/auth/callback/credentials?json=true`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: loginBody
      },
      jar
    )

    if (!loginRes.ok) {
      const text = await loginRes.text()
      throw new Error(`Login failed: ${loginRes.status} ${text}`)
    }

    const sessionCookie = Array.from(jar.keys()).find(name => name.includes('session'))
    if (!sessionCookie) {
      throw new Error('Session cookie not returned after login')
    }

    // Invoke AI chat endpoint
const TEST_MODEL = process.env.TEST_MODEL || 'mistralai/mistral-small-3.2-24b-instruct:free'

const chatPayload = {
  model: TEST_MODEL,
  messages: [
    {
      role: 'user',
      content: 'Please respond with a short greeting for Datadog LLM observability validation.'
    }
  ],
  includeRag: false
}

    const chatRes = await fetchWithCookies(
      `${BASE_URL}/api/ai/chat`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(chatPayload)
      },
      jar
    )

    const chatBody = await chatRes.text()
    console.log('Chat response status:', chatRes.status)
    console.log('Chat response body:', chatBody)

    if (!chatRes.ok) {
      process.exitCode = 1
    }
  } finally {
    if (!portForward.killed) {
      portForward.kill('SIGINT')
      await sleep(500)
    }
  }
}

run().catch(err => {
  console.error('AI chat test failed:', err)
  process.exit(1)
})
