/**
 * @license
 * Copyright 2025
 * SPDX-License-Identifier: Apache-2.0
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { router: proxyRouter, handleWsUpgrade } = require('./routes/proxy');
const pdfRouter = require('./routes/pdf');
const { startCleanupTask } = require('./services/cleanup');

const app = express();
const port = Number.parseInt(process.env.PORT || '8080', 10);

if (pdfRouter.uploadDir) {
  startCleanupTask(pdfRouter.uploadDir);
}

app.set('trust proxy', 1);

// Permissive CORS with exposed headers
// CORS: permissive in dev, allowlist in production via PPP_ALLOWED_ORIGINS env
const allowedOrigins = process.env.PPP_ALLOWED_ORIGINS ? process.env.PPP_ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : null;
app.use(cors({
  origin: (origin, cb) => {
    if (process.env.NODE_ENV !== 'production') return cb(null, true);
    if (!allowedOrigins || allowedOrigins.length === 0) return cb(null, false);
    if (!origin) return cb(null, false);
    return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS origin denied'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-PPP-Autofix-Report'],
  exposedHeaders: ['Content-Disposition', 'X-PPP-Autofix-Report', 'Content-Length']
}));

// Disable buffering header for proxies; do not override CORS header here
app.use((req, res, next) => {
  res.setHeader('X-Accel-Buffering', 'no');
  next();
});

// Rate limiting for heavy endpoints (configurable)
const convertWindowMs = Number(process.env.PPP_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000; // 1h
const convertMax = Number(process.env.PPP_RATE_LIMIT_MAX) || 30; // default 30 requests per window per IP
const convertLimiter = rateLimit({
  windowMs: convertWindowMs,
  max: convertMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to conversion endpoints. Try later.' }
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api-proxy', proxyRouter);
// Apply convert rate limiter to protect heavy endpoints
app.use('/api/convert', convertLimiter, pdfRouter);

const staticPath = path.resolve(__dirname, '..', 'dist');
app.use(
  express.static(staticPath, {
    setHeaders(res, filePath) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.js' || ext === '.mjs') res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      else if (ext === '.css') res.setHeader('Content-Type', 'text/css; charset=utf-8');
    },
  })
);

app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Readiness: checks critical runtime deps (Ghostscript) and writable upload dir
app.get('/ready', async (_req, res) => {
  const { spawn } = require('child_process');
  const uploadDir = pdfRouter.uploadDir || null;
  const gsCmd = process.platform === 'win32' ? 'gswin64c' : 'gs';

  const checks = { ok: true, details: {} };

  // 1) Ghostscript availability
  try {
    await new Promise((resolve, reject) => {
      const p = spawn(gsCmd, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      const to = setTimeout(() => { try { p.kill(); } catch (_) {} ; reject(new Error('gs_timeout')); }, 3000);
      p.on('error', (e) => { clearTimeout(to); reject(e); });
      p.stdout.on('data', () => {});
      p.on('close', (code) => { clearTimeout(to); if (code === 0 || code === null) resolve(); else reject(new Error('gs_exit_' + code)); });
    });
    checks.details.ghostscript = { ok: true };
  } catch (e) {
    checks.ok = false;
    checks.details.ghostscript = { ok: false, message: e.message };
  }

  // 2) Upload dir writable
  if (uploadDir) {
    try {
      const testPath = require('path').join(uploadDir, `.ppp_ready_test_${Date.now()}`);
      await fs.promises.mkdir(uploadDir, { recursive: true });
      await fs.promises.writeFile(testPath, 'ok');
      await fs.promises.unlink(testPath);
      checks.details.uploadDir = { ok: true, path: uploadDir };
    } catch (e) {
      checks.ok = false;
      checks.details.uploadDir = { ok: false, message: e.message, path: uploadDir };
    }
  } else {
    checks.details.uploadDir = { ok: false, message: 'no_upload_dir_configured' };
    checks.ok = false;
  }

  if (checks.ok) return res.status(200).json({ ok: true, details: checks.details });
  return res.status(503).json({ ok: false, details: checks.details });
});

app.get(/^\/(?!api-proxy\/|api\/).*/, (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Not built');
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on :${port}`);
});

server.timeout = 600000; // 10 minutes

const wss = new WebSocket.Server({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname.startsWith('/api-proxy')) handleWsUpgrade(wss, request, socket, head);
  else socket.destroy();
});

module.exports = app;
