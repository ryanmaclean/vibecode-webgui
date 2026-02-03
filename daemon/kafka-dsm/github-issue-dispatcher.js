'use strict';

require('dd-trace').init({
  service: process.env.DD_SERVICE || 'gastown-github-dispatcher',
  env: process.env.DD_ENV || 'local',
  version: process.env.DD_VERSION || '0.1.0',
  logInjection: true
});

const fs = require('fs');
const https = require('https');
const { execFileSync } = require('child_process');
const { Kafka } = require('kafkajs');

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const OWNER = process.env.GITHUB_OWNER || '';
const REPO = process.env.GITHUB_REPO || '';
// GitHub CLI (gh) is preferred over raw tokens per 2026 recommendations
const USE_GH_CLI = (process.env.GITHUB_USE_GH_CLI || 'true').toLowerCase() === 'true';
const GH_CMD = process.env.GH_CMD || 'gh';
const TOKEN = process.env.GITHUB_TOKEN || '';
const API_BASE = process.env.GITHUB_API || 'https://api.github.com';
const STATE_PATH = process.env.GITHUB_STATE_PATH || '/Users/studio/gt/logs/github-issues.state.json';
const SINCE_DAYS = parseInt(process.env.GITHUB_SINCE_DAYS || '7', 10);
const BD_CMD = process.env.BD_CMD || 'bd';
const GT_CMD = process.env.GT_CMD || 'gt';
const GT_AUTO_SLING = (process.env.GT_AUTO_SLING || '').toLowerCase() === 'true';
const GT_AUTO_SLING_TARGET = process.env.GT_AUTO_SLING_TARGET || 'mayor';
const DRY_RUN = (process.env.GITHUB_DRY_RUN || '').toLowerCase() === 'true';

const LANE_CRITICAL = (process.env.GITHUB_LABEL_LANE_CRITICAL || 'critical,sev1,p0').split(',').map((s) => s.trim()).filter(Boolean);
const LANE_STANDARD = (process.env.GITHUB_LABEL_LANE_STANDARD || 'standard,sev2,p1').split(',').map((s) => s.trim()).filter(Boolean);
const LANE_EXPERIMENTAL = (process.env.GITHUB_LABEL_LANE_EXPERIMENTAL || 'experimental,spike,idea').split(',').map((s) => s.trim()).filter(Boolean);

const PRIORITY_MAP = (process.env.GITHUB_PRIORITY_MAP || 'p0:0,p1:1,p2:2,p3:3,p4:4,critical:0,high:1,medium:2,low:3').split(',')
  .map((pair) => pair.trim())
  .filter(Boolean)
  .reduce((acc, pair) => {
    const [label, value] = pair.split(':');
    if (!label || value === undefined) return acc;
    acc[label.toLowerCase()] = value;
    return acc;
  }, {});

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { since: null, seen: [] };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function requestJsonViaGh(endpoint) {
  // Use GitHub CLI (gh api) which inherits auth from `gh auth login`
  // This follows GitHub's 2026 recommendations for CLI apps
  try {
    const output = execFileSync(GH_CMD, ['api', endpoint], { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (err) {
    throw new Error(`gh api error: ${err.message || err}`);
  }
}

function requestJsonViaHttps(url) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const headers = {
      'User-Agent': 'gastown-github-dispatcher',
      'Accept': 'application/vnd.github+json'
    };
    if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

    const req = https.request({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
          return;
        }
        reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function requestJson(urlOrEndpoint) {
  if (USE_GH_CLI) {
    // Convert full URL to API endpoint for gh cli
    const url = new URL(urlOrEndpoint);
    const endpoint = url.pathname + url.search;
    return requestJsonViaGh(endpoint);
  }
  return requestJsonViaHttps(urlOrEndpoint);
}

function issueLane(labels) {
  const set = new Set(labels.map((l) => l.toLowerCase()));
  if (LANE_CRITICAL.some((label) => set.has(label))) return 'critical';
  if (LANE_EXPERIMENTAL.some((label) => set.has(label))) return 'experimental';
  if (LANE_STANDARD.some((label) => set.has(label))) return 'standard';
  return 'standard';
}

function issuePriority(labels) {
  for (const label of labels) {
    const mapped = PRIORITY_MAP[label.toLowerCase()];
    if (mapped !== undefined) return mapped;
  }
  return '2';
}

function buildDescription(issue) {
  const body = issue.body ? issue.body.trim() : '';
  const link = issue.html_url || '';
  const meta = [
    `GitHub: ${link}`,
    `Repo: ${OWNER}/${REPO}`,
    `Issue: #${issue.number}`,
    `Author: ${issue.user ? issue.user.login : 'unknown'}`
  ].join('\n');
  if (!body) return meta;
  return `${meta}\n\n${body}`;
}

function createBead(issue, priority, labels) {
  const title = issue.title || `GitHub issue #${issue.number}`;
  const description = buildDescription(issue);
  const externalRef = `gh-${issue.number}`;
  const args = [
    'create',
    '--title', title,
    '--description', description,
    '--external-ref', externalRef,
    '--priority', String(priority),
    '--labels', labels.join(','),
    '--silent'
  ];
  const output = execFileSync(BD_CMD, args, { encoding: 'utf8' }).trim();
  return output || null;
}

function sendKafka(topic, payload) {
  const kafka = new Kafka({ clientId: 'gastown-github-dispatcher', brokers: BROKERS });
  const producer = kafka.producer();
  return producer.connect()
    .then(() => producer.send({ topic, messages: [{ value: JSON.stringify(payload) }] }))
    .then(() => producer.disconnect());
}

async function run() {
  if (!OWNER || !REPO) throw new Error('GITHUB_OWNER and GITHUB_REPO are required');
  if (!USE_GH_CLI && !TOKEN) throw new Error('GITHUB_TOKEN is required when GITHUB_USE_GH_CLI=false');

  const state = loadState();
  const since = state.since || new Date(Date.now() - SINCE_DAYS * 86400000).toISOString();

  const url = `${API_BASE}/repos/${OWNER}/${REPO}/issues?state=open&per_page=100&since=${encodeURIComponent(since)}`;
  const issues = await requestJson(url);
  const seen = new Set(state.seen || []);
  let newest = state.since || since;

  for (const issue of issues) {
    if (issue.pull_request) continue;
    if (seen.has(issue.id)) continue;
    const labels = (issue.labels || []).map((label) => label.name || '').filter(Boolean);
    const lane = issueLane(labels);
    const priority = issuePriority(labels);
    if (DRY_RUN) {
      seen.add(issue.id);
      if (issue.updated_at && issue.updated_at > newest) newest = issue.updated_at;
      continue;
    }

    const beadId = createBead(issue, priority, labels);
    if (!beadId) continue;

    await sendKafka(`tundra-lane-${lane}-beads`, {
      ts: new Date().toISOString(),
      type: 'issue',
      action: 'created',
      lane,
      priority,
      bead: beadId,
      issue: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        labels
      }
    });

    if (GT_AUTO_SLING) {
      try {
        execFileSync(GT_CMD, ['sling', beadId, GT_AUTO_SLING_TARGET], { stdio: 'ignore' });
      } catch {
        // ignore sling errors
      }
    }

    seen.add(issue.id);
    if (issue.updated_at && issue.updated_at > newest) newest = issue.updated_at;
  }

  state.since = newest;
  state.seen = Array.from(seen).slice(-2000);
  saveState(state);
}

run().catch((err) => {
  console.error('github-issue-dispatcher error', err.message || err);
  process.exit(1);
});
