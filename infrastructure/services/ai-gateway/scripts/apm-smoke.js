#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const http = require("http");
const https = require("https");
const path = require("path");

function log(msg, obj) {
  const ts = new Date().toISOString();
  if (obj !== undefined) {
    console.log(`[${ts}] ${msg}`, obj);
  } else {
    console.log(`[${ts}] ${msg}`);
  }
}

function runCmd(cmd, args, opts = {}) {
  const { timeoutMs = 15000, cwd = process.cwd(), env = process.env, capture = true } = opts;
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, shell: false });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const to = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGKILL"); } catch {}
    }, timeoutMs);

    if (capture) {
      child.stdout.on("data", (d) => { stdout += d.toString(); });
      child.stderr.on("data", (d) => { stderr += d.toString(); });
    }

    child.on("close", (code) => {
      clearTimeout(to);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

function get(urlStr, { timeoutMs = 4000, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + (u.search || ""),
      method: "GET",
      headers
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      try { req.destroy(new Error("timeout")); } catch {}
      reject(new Error("timeout"));
    });
    req.end();
  });
}

async function waitForHealth(url, { timeoutMs = 12000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await get(url, { timeoutMs: 1500 });
      if (r.status >= 200 && r.status < 500) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

function mapDatadogSite(siteEnv) {
  // Returns { apiHost, otlp } for a given DD_SITE
  switch (siteEnv) {
    case "datadoghq.eu": return { apiHost: "api.datadoghq.eu", otlp: "https://otel-intake.datadoghq.eu" };
    case "us3.datadoghq.com": return { apiHost: "api.us3.datadoghq.com", otlp: "https://otel-intake.us3.datadoghq.com" };
    case "us5.datadoghq.com": return { apiHost: "api.us5.datadoghq.com", otlp: "https://otel-intake.us5.datadoghq.com" };
    case "ap1.datadoghq.com": return { apiHost: "api.ap1.datadoghq.com", otlp: "https://otel-intake.ap1.datadoghq.com" };
    default: return { apiHost: "api.datadoghq.com", otlp: "https://otel-intake.datadoghq.com" };
  }
}

async function ddAPMSearch({ apiHost, ddApiKey, ddAppKey, service, env }) {
  const payload = JSON.stringify({
    filter: { from: "now-10m", to: "now", query: `service:${service} env:${env}` },
    page: { limit: 5 },
    sort: "-timestamp"
  });
  const opts = {
    method: "POST",
    hostname: apiHost,
    path: "/api/v2/apm/events/search",
    headers: {
      "DD-API-KEY": ddApiKey,
      "DD-APPLICATION-KEY": ddAppKey,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode || 0, body });
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => {
      try { req.destroy(new Error("timeout")); } catch {}
      reject(new Error("timeout"));
    });
    req.write(payload);
    req.end();
  });
}

(async () => {
  const baseDir = path.resolve(__dirname, "..");
  const args = new Set(process.argv.slice(2));

  log("Step A1: node -v (8s)");
  const a1 = await runCmd("node", ["-v"], { timeoutMs: 8000, cwd: baseDir });
  log(`node -v exit=${a1.code}${a1.timedOut ? " (timeout)" : ""}`);

  log("Step A2: tsc --noEmit (25s)");
  const a2 = await runCmd("npx", ["-y", "tsc", "-p", path.join(baseDir, "tsconfig.json"), "--noEmit", "--pretty", "false"], { timeoutMs: 25000, cwd: baseDir });
  log(`tsc --noEmit exit=${a2.code}${a2.timedOut ? " (timeout)" : ""}`);
  if (a2.code !== 0 || a2.timedOut) {
    log("Type-check failed or timed out; aborting before runtime smoke.");
    process.exit(a2.code || 1);
  }

  if (args.has("--build")) {
    log("Step B: npm run build (40s)");
    const b = await runCmd("npm", ["run", "build"], { timeoutMs: 40000, cwd: baseDir });
    log(`build exit=${b.code}${b.timedOut ? " (timeout)" : ""}`);
    if (b.code !== 0 || b.timedOut) {
      log("Build failed or timed out; aborting before runtime smoke.");
      process.exit(b.code || 1);
    }
  }

  // Step C: start server with tracing, short window
  const site = process.env.DD_SITE || process.env.DATADOG_SITE || "datadoghq.com";
  const { apiHost, otlp } = mapDatadogSite(site);
  const ddApi = process.env.DD_API_KEY || process.env.DATADOG_API_KEY || "";
  const ddApp = process.env.DD_APP_KEY || process.env.DATADOG_APP_KEY || "";
  const ddEnv = process.env.DD_ENV || "dev";
  const ddService = process.env.DD_SERVICE || "vibecode-ai-gateway";
  const port = Number(process.env.PORT || 3001);
  const apiKey = (process.env.API_KEYS || "vbai_dev_key_1").split(",")[0];

  const childEnv = {
    ...process.env,
    ENABLE_TRACING: "true",
    TRACE_SAMPLE_RATE: "1",
    OTEL_SERVICE_NAME: ddService,
    OTEL_RESOURCE_ATTRIBUTES: `deployment.environment=${ddEnv}`,
    OTEL_EXPORTER_OTLP_ENDPOINT: otlp,
    OTEL_EXPORTER_OTLP_HEADERS: ddApi ? `DD-API-KEY=${ddApi}` : "",
    DD_ENV: ddEnv,
    DD_SERVICE: ddService,
    PORT: String(port),
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "test_key",
    JWT_SECRET: process.env.JWT_SECRET || "local_jwt_secret",
    API_KEYS: process.env.API_KEYS || "vbai_dev_key_1",
  };

  log("Step C1: starting server (max 12s)");
  const server = spawn("node", [path.join(baseDir, "dist", "server.js")], { cwd: baseDir, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
  const recent = [];
  function pushLine(prefix, data) {
    const l = `${prefix} ${data.toString()}`.trim();
    recent.push(l);
    if (recent.length > 120) recent.shift();
  }
  server.stdout.on("data", (d) => pushLine("stdout:", d));
  server.stderr.on("data", (d) => pushLine("stderr:", d));

  const ok = await waitForHealth(`http://127.0.0.1:${port}/health`, { timeoutMs: 12000 });
  if (!ok) {
    log("Server did not become healthy in time; recent logs:");
    recent.slice(-80).forEach((l) => console.log(l));
    try { server.kill("SIGKILL"); } catch {}
    process.exit(2);
  }
  log("Server is healthy");

  // Step C2: small requests with short timeouts
  try {
    const h = await get(`http://127.0.0.1:${port}/health`, { timeoutMs: 4000 });
    log(`GET /health -> ${h.status}`);
  } catch (e) {
    log("GET /health failed", String(e));
  }
  try {
    const m = await get(`http://127.0.0.1:${port}/api/v1/models`, { timeoutMs: 6000, headers: { "X-API-Key": apiKey } });
    log(`GET /api/v1/models -> ${m.status}`);
  } catch (e) {
    log("GET /api/v1/models failed", String(e));
  }

  // Step D: Datadog APM quick check
  if (ddApi && ddApp) {
    log("Step D: Datadog APM search (10s)");
    try {
      const r = await ddAPMSearch({ apiHost, ddApiKey: ddApi, ddAppKey: ddApp, service: ddService, env: ddEnv });
      log(`APM search status=${r.status}`);
      const trimmed = (r.body || "").slice(0, 2000);
      console.log(trimmed);
    } catch (e) {
      log("Datadog APM search failed", String(e));
    }
  } else {
    log("Datadog keys not set; skipping APM verification");
  }

  // Cleanup
  log("Stopping server");
  try { server.kill("SIGTERM"); } catch {}
  setTimeout(() => { try { server.kill("SIGKILL"); } catch {} }, 1500);

  log("Done");
  process.exit(0);
})().catch((e) => {
  log("Fatal error in apm-smoke", String(e));
  process.exit(1);
});
