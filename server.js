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
const apiKeyMiddleware = require('./server/middleware/apiKey');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const pino = require('pino-http')({
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
});

// Simple logger without file-system writes to avoid PM2 watch-loop crashes
const debugLog = (msg) => {
  console.log(`[${new Date().toISOString()}] ${msg}`);
};

// Global Process Guards to prevent 502 Gateway errors on unexpected crashes
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

debugLog('Server starting environment diagnostic...');
try {
  const os = require('os');
  debugLog(`OS: ${os.platform()} ${os.release()} (${os.arch()})`);
  debugLog(`Memory: ${Math.round(os.freemem() / 1024 / 1024)}MB free of ${Math.round(os.totalmem() / 1024 / 1024)}MB`);
  debugLog(`CPU Load: ${os.loadavg().join(', ')}`);
  debugLog(`Uptime: ${Math.round(os.uptime() / 60)} mins`);
} catch (e) {
  console.error('Diagnostic error:', e.message);
}

const app = express();
const port = Number.parseInt(process.env.PORT || '8080', 10);

if (pdfRouter.uploadDir) {
  startCleanupTask(pdfRouter.uploadDir);
}

app.use(pino);

app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "wss:", "ws:"],
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      workerSrc: ["'self'", "blob:", "data:"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
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
app.use('/api/gemini-proxy', apiKeyMiddleware, proxyRouter);
console.log('Mounting /api/convert routes...');
app.use('/api/convert', (req, res, next) => {
  console.log(`[ROUTE-DEBUG] ${req.method} ${req.url}`);
  next();
}, pdfRouter);

// -------- Static Files --------
const staticPath = path.resolve(__dirname, 'dist');
debugLog(`Serving static files from: ${staticPath}`);

app.use(
  express.static(staticPath, {
    setHeaders(res, filePath) {
      const ext = path.extname(filePath).toLowerCase();
      // Force correct MIME types for ESM modules and workers
      if (ext === '.js' || ext === '.mjs') {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (ext === '.css') {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      }
      // Critical for preventing "Strict MIME type checking" errors in the browser
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

app.get('/healthz', (_req, res) => res.status(200).send('ok'));

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

app.get('/ready', async (_req, res) => {
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);

  const status = {
    status: 'ok',
    version: require('./package.json').version || '1.0.0',
    details: {
      ghostscript: { ok: false, message: 'checking' },
      uploadDir: { ok: false, path: pdfRouter.uploadDir }
    },
    timestamp: new Date().toISOString()
  };

  try {
    const gsCmd = process.env.GS_PATH || (process.platform === 'win32' ? 'gswin64c' : 'gs');
    const { stdout } = await execFileAsync(gsCmd, ['--version'], { timeout: 3000 });
    status.details.ghostscript = { ok: true, version: stdout.trim() };
  } catch (err) {
    status.status = 'error';
    status.details.ghostscript = { ok: false, message: err.message };
  }

  try {
    if (pdfRouter.uploadDir) {
      fs.accessSync(pdfRouter.uploadDir, fs.constants.W_OK);
      status.details.uploadDir.ok = true;
    }
  } catch (err) {
    status.status = 'error';
    status.details.uploadDir.message = err.message;
  }

  res.status(status.status === 'ok' ? 200 : 503).json(status);
});

app.get('/metrics', (_req, res) => {
  const usage = process.memoryUsage();
  res.json({
    uptime: process.uptime(),
    memory: {
      rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      external: Math.round(usage.external / 1024 / 1024) + 'MB',
    },
    cpu: process.cpuUsage(),
    version: require('./package.json').version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get(/^\/(?!api\/).*/, (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('<h1>App not built</h1><p>Run npm run build first.</p>');
  }
});

// -------- Server & WebSocket --------
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`[SERVER-START] OK: Listening on 0.0.0.0:${port}`);
  console.log(`[SERVER-START] Upload context: ${pdfRouter.uploadDir || 'Not set'}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[CRITICAL] Port ${port} is already in use. App cannot start.`);
  } else {
    console.error(`[CRITICAL] Server failed to start:`, err);
  }
  process.exit(1);
});

server.timeout = 600000; // 10 minutes

const wss = new WebSocket.Server({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname.startsWith('/api/gemini-proxy')) {
    handleWsUpgrade(wss, request, socket, head);
  } else {
    socket.destroy();
  }
});

module.exports = app;
