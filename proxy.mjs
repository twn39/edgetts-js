#!/usr/bin/env node
/**
 * Local WebSocket proxy for edge-tts browser demo.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The Microsoft TTS WebSocket endpoint (speech.platform.bing.com) may be
 * unreachable from browsers in certain network environments (e.g. when the
 * local proxy/VPN applies different routing rules to browser traffic vs.
 * Node.js traffic, or when a firewall resets browser WebSocket upgrades).
 *
 * Node.js connections bypass these restrictions because they have a different
 * TLS fingerprint and do not carry browser-specific HTTP headers that network
 * devices use for traffic classification.
 *
 * This proxy:
 *   1. Accepts WS connections from the local browser (no auth — localhost only)
 *   2. Opens an upstream WSS connection to the Microsoft TTS server, using
 *      Node.js networking which is unaffected by the browser's restrictions
 *   3. Bidirectionally relays all frames between the two sockets
 *
 * USAGE
 * ─────
 *   node proxy.mjs          # listens on ws://localhost:3001
 *   node proxy.mjs 8080     # listens on a custom port
 *
 * Then open demo.html via a local HTTP server (e.g. npx serve . -p 3000).
 * The demo auto-detects the proxy and routes WebSocket traffic through it.
 */

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createHash } from 'crypto';

const PORT = Number(process.argv[2]) || 3001;

// ── Constants (mirror src/constants.ts) ────────────────────────────────────
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split('.')[0];
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;

const WSS_HEADERS = {
  'User-Agent':
    `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ` +
    `(KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 ` +
    `Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'en-US,en;q=0.9',
  'Pragma': 'no-cache',
  'Cache-Control': 'no-cache',
  'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'Sec-WebSocket-Version': '13',
};

// ── GEC token (BigInt to avoid float precision loss in the 10^17 range) ────
let clockSkewSeconds = 0n;

function generateSecMsGec() {
  const nowSec = BigInt(Math.floor(Date.now() / 1000)) + clockSkewSeconds;
  let ticks = nowSec + 11644473600n;
  ticks -= ticks % 300n;
  ticks *= 10_000_000n;
  const str = `${ticks}${TRUSTED_CLIENT_TOKEN}`;
  return createHash('sha256').update(str, 'ascii').digest('hex').toUpperCase();
}

function generateMuid() {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('').toUpperCase();
}

function connectId() {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
}

function buildUpstreamUrl() {
  return (
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud` +
    `/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&ConnectionId=${connectId()}` +
    `&Sec-MS-GEC=${generateSecMsGec()}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`
  );
}

async function adjustClockSkew() {
  try {
    const r = await fetch(
      `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud` +
      `/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}` +
      `&Sec-MS-GEC=${generateSecMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`
    );
    const d = r.headers.get('date');
    if (d) {
      clockSkewSeconds = BigInt(Math.round(new Date(d).getTime() / 1000)) -
        BigInt(Math.floor(Date.now() / 1000));
      console.log(`[proxy] clock skew adjusted: ${clockSkewSeconds}s`);
    }
  } catch { /* ignore */ }
}

// ── Proxy server ─────────────────────────────────────────────────────────────
const httpServer = createServer((req, res) => {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  });
  res.end('edge-tts proxy OK');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (browser) => {
  console.log('[proxy] browser connected');

  let upstream = new WebSocket(buildUpstreamUrl(), {
    headers: { ...WSS_HEADERS, Cookie: `muid=${generateMuid()};` },
  });
  let pending = [];
  let retried = false;

  upstream.on('open', () => {
    console.log('[proxy] upstream connected');
    for (const { data, binary } of pending) upstream.send(data, { binary });
    pending = [];
  });

  upstream.on('message', (data, isBinary) => {
    if (browser.readyState === WebSocket.OPEN) browser.send(data, { binary: isBinary });
  });

  upstream.on('close', (code) => {
    if (browser.readyState === WebSocket.OPEN) browser.close(code || 1000);
  });

  upstream.on('error', async (err) => {
    console.error('[proxy] upstream error:', err.message);
    if (!retried) {
      retried = true;
      await adjustClockSkew();
      upstream = new WebSocket(buildUpstreamUrl(), {
        headers: { ...WSS_HEADERS, Cookie: `muid=${generateMuid()};` },
      });
      upstream.on('open', () => {
        for (const { data, binary } of pending) upstream.send(data, { binary });
        pending = [];
      });
      upstream.on('message', (data, isBinary) => {
        if (browser.readyState === WebSocket.OPEN) browser.send(data, { binary: isBinary });
      });
      upstream.on('close', (code) => {
        if (browser.readyState === WebSocket.OPEN) browser.close(code || 1000);
      });
      upstream.on('error', () => {
        if (browser.readyState === WebSocket.OPEN) browser.close(1011, 'Upstream error');
      });
    } else {
      if (browser.readyState === WebSocket.OPEN) browser.close(1011, 'Upstream error');
    }
  });

  browser.on('message', (data, isBinary) => {
    if (upstream.readyState === WebSocket.OPEN) upstream.send(data, { binary: isBinary });
    else pending.push({ data, binary: isBinary });
  });

  browser.on('close', () => {
    if (upstream.readyState === WebSocket.OPEN) upstream.close(1000);
  });

  browser.on('error', (err) => console.error('[proxy] browser error:', err.message));
});

httpServer.listen(PORT, () => {
  console.log(`\n  ✦ edge-tts proxy  →  ws://localhost:${PORT}\n`);
});
