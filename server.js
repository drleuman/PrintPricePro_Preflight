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

const { router: proxyRouter, handleWsUpgrade } = require('./server/routes/proxy');
const pdfRouter = require('./server/routes/pdf');
const { startCleanupTask } = require('./server/services/cleanup');

// Simple logger without file-system writes to avoid PM2 watch-loop crashes
const debugLog = (msg) => {
  console.log(`[${new Date().toISOString()}] ${msg}`);
};

debugLog('Server starting with relaxed security...');

// Check Ghostscript presence
const { exec } = require('child_process');
const GS_CMD_LOG = process.env.GS_PATH || (process.platform === 'win32' ? 'gswin64c' : 'gs');
exec(`${GS_CMD_LOG} --version`, (err, stdout) => {
  if (err) {
    console.error(`[GS-CHECK] Ghostscript NOT found (${GS_CMD_LOG}). Conversion routes will fail.`);
  } else {
    console.log(`[GS-CHECK] Ghostscript found: ${stdout.trim()}`);
  }
});

const helmet = require('helmet');

const app = express();
const port = Number.parseInt(process.env.PORT || '8080', 10);

if (pdfRouter.uploadDir) {
  startCleanupTask(pdfRouter.uploadDir);
}

app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https:"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com"],
      "connect-src": ["'self'", "https://generativelanguage.googleapis.com"]
    },
  },
}));

// Restricted CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://preflight.printprice.pro',
  'https://print-price-pro-preflight.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-PPP-Autofix-Report', 'x-ppp-api-key'],
  exposedHeaders: ['Content-Disposition', 'X-PPP-Autofix-Report', 'Content-Length'],
  credentials: true
}));

app.use((req, res, next) => {
  res.setHeader('X-Accel-Buffering', 'no'); // Global disable for PDF streaming
  next();
});

app.use(express.json({ limit: '10mb' })); // Reduced from 100mb
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// -------- Routes --------
app.use('/api-proxy', proxyRouter);
console.log('Mounting /api/convert routes...');
app.use('/api/convert', (req, res, next) => {
  console.log(`[ROUTE-DEBUG] ${req.method} ${req.url}`);
  next();
}, pdfRouter);

app.all('/api/*', (req, res) => {
  console.warn(`[404] API Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: `Route not found: ${req.originalUrl}`,
    method: req.method,
    path: req.path
  });
});

// -------- Global Error Handler --------
app.use((err, req, res, next) => {
  console.error(`[SERVER-ERROR] ${req.method} ${req.url}:`, err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'UNKNOWN_ERROR',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// -------- Static Files --------
const staticPath = path.resolve(__dirname, 'dist');
debugLog(`Serving static files from: ${staticPath}`);

app.use(
  express.static(staticPath, {
    setHeaders(res, filePath) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.js' || ext === '.mjs') {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (ext === '.css') {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
    },
  })
);

app.get('/healthz', (_req, res) => res.status(200).send('ok'));

app.get(/^\/(?!api-proxy\/|api\/).*/, (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('<h1>App not built</h1><p>Run npm run build first.</p>');
  }
});

// -------- Server & WebSocket --------
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on :${port}`);
});

server.timeout = 600000; // 10 minutes

const wss = new WebSocket.Server({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname.startsWith('/api-proxy')) {
    handleWsUpgrade(wss, request, socket, head);
  } else {
    socket.destroy();
  }
});

module.exports = app;
