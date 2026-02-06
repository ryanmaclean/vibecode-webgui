#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");

const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const path = require('path');
const { URL } = require('url');

// Initialize log aggregation
const logAggregation = new LogAggregation();


function parseArgs(argv) {
  const result = {
    target: 'http://127.0.0.1:3600',
    listen: 'https://127.0.0.1:3443',
    cert: '',
    key: '',
    verbose: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--target':
        result.target = argv[++i];
        break;
      case '--listen':
        result.listen = argv[++i];
        break;
      case '--cert':
        result.cert = argv[++i];
        break;
      case '--key':
        result.key = argv[++i];
        break;
      case '--verbose':
        result.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${arg}`);
        printHelp();
        process.exit(1);
    }
  }
  return result;
}

function printHelp() {
  console.log(`Usage: node openvscode-https-proxy.js --cert cert.pem --key key.pem [--target http://127.0.0.1:3600] [--listen https://127.0.0.1:3443] [--verbose]\n`);
}

const args = parseArgs(process.argv.slice(2));

function log(...parts) {
  if (!args.verbose) return;
  console.log('[https-proxy]', ...parts);
}

if (!args.cert || !args.key) {
  console.error('error: --cert and --key are required');
  printHelp();
  process.exit(1);
}

const certPath = path.resolve(process.cwd(), args.cert);
const keyPath = path.resolve(process.cwd(), args.key);
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error(`error: certificate files not found (cert=${certPath}, key=${keyPath})`);
  process.exit(1);
}

let listenUrl;
let targetUrl;
try {
  listenUrl = new URL(args.listen);
  targetUrl = new URL(args.target);
} catch (err) {
  console.error('error: invalid URL provided for --listen or --target');
  process.exit(1);
}

if (listenUrl.protocol !== 'https:') {
  console.error('error: --listen must be an https:// URL');
  process.exit(1);
}

if (targetUrl.protocol !== 'http:') {
  console.error('error: --target must be an http:// URL (the upstream microVM endpoint)');
  process.exit(1);
}

const cert = fs.readFileSync(certPath);
const key = fs.readFileSync(keyPath);

const server = https.createServer({ cert, key }, (req, res) => {
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: targetUrl.host },
  };

  const proxyReq = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', err => {
    log('proxy request error', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain' });
    }
    res.end('proxy error');
  });

  req.pipe(proxyReq);
});

server.on('upgrade', (req, socket, head) => {
  const targetSocket = net.connect(targetUrl.port, targetUrl.hostname, () => {
    log('upgrading connection to WebSocket');
    const requestLine = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    targetSocket.write(requestLine);
    for (const [name, value] of Object.entries(req.headers)) {
      targetSocket.write(`${name}: ${value}\r\n`);
    }
    targetSocket.write(`host: ${targetUrl.host}\r\n`);
    targetSocket.write('\r\n');
    if (head && head.length) {
      targetSocket.write(head);
    }
    targetSocket.pipe(socket);
    socket.pipe(targetSocket);
  });

  targetSocket.on('error', err => {
    log('websocket proxy error', err.message);
    socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    socket.destroy();
  });

  socket.on('error', err => {
    log('client socket error', err.message);
    targetSocket.destroy();
  });
});

server.listen(parseInt(listenUrl.port, 10), listenUrl.hostname, () => {
  console.log(`HTTPS proxy listening on ${listenUrl.href} -> ${targetUrl.href}`);
});

server.on('error', err => {
  console.error('proxy server error', err);
  process.exit(1);
});
