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
const helmet = require('helmet');
const compression = require('compression');

const { router: proxyRouter, handleWsUpgrade } = require('./routes/proxy');
const pdfRouter = require('./routes/pdf');
const preflightV2Router = require('./routes/preflightV2');
const { startCleanupTask } = require('./services/cleanup');
const apiKeyMiddleware = require('./middleware/apiKey');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const pino = require('pino-http')({
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
});
const { checkAllDependencies } = require('./services/dependencyChecker');
const { initSchema } = require('./services/dbSchema');

initSchema(); // Auto-create tables for V2 MySQL

// Initialize V2 Workers (BE-005)
if (process.env.NODE_ENV !== 'test') {
  require('./workers/v2-worker');
}

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

// Ensure V2 Temporary Upload Dir
const v2TempDir = path.join(__dirname, 'uploads-v2-temp');
if (!fs.existsSync(v2TempDir)) {
  fs.mkdirSync(v2TempDir, { recursive: true });
}

app.use(pino);

app.set('trust proxy', 1);

// Compression for large JSON/PDF responses
app.use(compression());

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

// -------- Production Guards --------
// 1) Reject oversized uploads early (before multer reads body)
const MAX_UPLOAD_BYTES = Number(process.env.PPP_MAX_UPLOAD_BYTES || 500 * 1024 * 1024);
app.use((req, res, next) => {
  const len = Number(req.headers['content-length'] || 0);
  if (len && len > MAX_UPLOAD_BYTES) {
    return res.status(413).json({ error: 'Payload too large', maxBytes: MAX_UPLOAD_BYTES });
  }
  next();
});

// 2) Response timeout — kill hung connections (Ghostscript safety net)
app.use((req, res, next) => {
  res.setTimeout(610_000, () => {
    if (!res.headersSent) res.status(504).json({ error: 'Request timeout' });
  });
  next();
});

// 3) Per-endpoint rate limits
const diagnosticLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const convertLimiter = rateLimit({ windowMs: 60_000, max: 5000, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many conversion requests, try again in a minute.' } });

// -------- Routes --------
app.use('/api/gemini-proxy', apiKeyMiddleware, proxyRouter);
app.use(['/ready', '/api/ready', '/healthz', '/api/healthz', '/version', '/api/version', '/metrics', '/api/metrics', '/health/deps', '/api/health/deps'], diagnosticLimiter);
app.use('/api/convert', convertLimiter);
console.log('Mounting /api/convert routes...');
app.use('/api/convert', (req, res, next) => {
  console.log(`[ROUTE-DEBUG][${req.id || '-'}] ${req.method} ${req.url}`);
  next();
}, pdfRouter);

// V2 Asynchronous Routes
debugLog('Mounting /api/v2/preflight routes...');
app.use('/api/v2/preflight', preflightV2Router);

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

const readyHandler = async (_req, res) => {
  const { ok, deps } = checkAllDependencies();

  const response = {
    status: ok ? 'ok' : 'error',
    version: require('./package.json').version || '1.0.0',
    dependencies: deps,
    uploadDirWritable: false,
    time: new Date().toISOString()
  };

  try {
    if (pdfRouter.uploadDir) {
      fs.accessSync(pdfRouter.uploadDir, fs.constants.W_OK);
      response.uploadDirWritable = true;
    }
  } catch (err) {
    response.status = 'error';
  }

  res.status(response.status === 'ok' ? 200 : 503).json(response);
};

const healthDepsHandler = (_req, res) => {
  const result = checkAllDependencies();
  res.status(result.ok ? 200 : 503).json(result);
};

// -------- Diagnostic Routes (BEFORE catch-all) --------
app.get(['/healthz', '/api/healthz'], (_req, res) => res.status(200).send('ok'));
app.get(['/ready', '/api/ready'], readyHandler);
app.get(['/health/deps', '/api/health/deps'], healthDepsHandler);

app.get(['/version', '/api/version'], (_req, res) => {
  const pkg = require('./package.json');
  res.json({
    version: pkg.version || '1.0.0',
    commit: process.env.GIT_COMMIT || 'unknown',
    node: process.version,
    env: process.env.NODE_ENV || 'production',
    uptime: Math.round(process.uptime())
  });
});

app.get(['/metrics', '/api/metrics'], (_req, res) => {
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

app.all('/api/*path', (req, res) => {
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

app.get(/^\/(?!api\/).*/, (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('<h1>App not built</h1><p>Run npm run build first.</p>');
  }
});

// -------- Server & WebSocket --------
if (!global.__SERVER_STARTED) {
  global.__SERVER_STARTED = true;

  // Run Startup Dependency Check (BE-001)
  debugLog('Verifying system dependencies core before listening...');
  const { ok, deps } = checkAllDependencies();
  if (!ok) {
    console.error('[CRITICAL] Missing hard dependencies! Server cannot start safely.');
    console.error(JSON.stringify(deps, null, 2));
    // In production, we exit. In dev, we might log and continue but here we enforce stability.
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('[WARNING] Continuing in DEV mode despite missing dependencies. AutoFix WILL fail.');
    }
  } else {
    debugLog('Dependencies verified: OK');
  }

  // Initialize DB Schema (BE-003)
  initSchema().catch(err => {
    console.error('[DB-SCHEMA-INIT-ERROR]', err);
  });

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[SERVER-START] OK: Listening on 0.0.0.0:${port}`);
    console.log(`[SERVER-START] Upload context: ${pdfRouter.uploadDir || 'Not set'}`);
    console.log(`[SERVER-START] Security Limits: Max Upload = ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB`);
    console.log(`[SERVER-START] Resource Limits: GS Concurrency = ${process.env.PPP_MAX_GS_CONCURRENCY || '4'}, Workers = ${process.env.PPP_MAX_WORKERS || '4'}`);
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

  // -------- Clean Shutdown (Release Port) --------
  const shutdown = (signal) => {
    console.log(`[SERVER-SHUTDOWN] Received ${signal}. Releasing port and closing...`);
    server.close(() => {
      console.log('[SERVER-SHUTDOWN] Port released. Process exit.');
      process.exit(0);
    });
    // Force exit after 10s if stuck
    setTimeout(() => {
      console.error('[SERVER-SHUTDOWN] Forced exit after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;

