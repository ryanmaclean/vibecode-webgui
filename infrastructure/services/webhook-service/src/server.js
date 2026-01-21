'use strict';

const crypto = require('crypto');
const express = require('express');

const PORT = parseInt(process.env.PORT || '5001', 10);
const JSON_LIMIT = process.env.JSON_LIMIT || '1mb';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

const app = express();

app.use(express.json({
  limit: JSON_LIMIT,
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

function getSignatureHeader(req) {
  return req.get('x-webhook-signature') || req.get('x-hub-signature-256') || '';
}

function normalizeSignature(signature) {
  if (!signature) {
    return '';
  }

  if (signature.startsWith('sha256=')) {
    return signature.slice('sha256='.length);
  }

  return signature;
}

function signaturesMatch(expected, received) {
  if (!expected || !received) {
    return false;
  }

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(received, 'hex');

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

app.post('/webhook', (req, res) => {
  if (WEBHOOK_SECRET) {
    const signature = normalizeSignature(getSignatureHeader(req));
    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(req.rawBody || Buffer.from(''))
      .digest('hex');

    if (!signaturesMatch(expected, signature)) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid webhook signature'
      });
    }
  }

  const event = {
    headers: req.headers,
    body: req.body,
    receivedAt: new Date().toISOString()
  };

  console.log(JSON.stringify({
    message: 'Webhook received',
    event
  }));

  return res.status(200).json({
    status: 'accepted'
  });
});

app.listen(PORT, () => {
  console.log(JSON.stringify({
    message: 'Webhook service listening',
    port: PORT
  }));
});
