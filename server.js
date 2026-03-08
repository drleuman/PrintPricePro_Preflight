/**
 * @license
 * Copyright 2025
 * SPDX-License-Identifier: Apache-2.0
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
console.log(`[BOOTSTRAP] Starting PrintPrice Engine at ${new Date().toISOString()}`);
const fs = require('fs');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Global state for boot diagnostics (P0: Define before first use)
let startupErrors = [];
let isReady = false;

const { router: proxyRouter, handleWsUpgrade } = require('./routes/proxy');
const pdfRouter = require('./routes/pdf');
const preflightV2Router = require('./routes/preflightV2');
const apiV2Router = require('./routes/apiV2');
const batchV2Router = require('./routes/batchV2');
const analyticsV2Router = require('./routes/analyticsV2');
const adminRoutes = require('./routes/admin');
const adminControlRoutes = require('./routes/adminControl');
const connectRouter = require('./routes/connect');
const connectAdminRouter = require('./routes/connectAdmin');
const routingAdminRouter = require('./routes/routingAdmin');
const printerSyncRouter = require('./routes/printerSync');
const reservationsRouter = require('./routes/reservations');
const printerDispatchRouter = require('./routes/printerDispatch');
const pricingAdminRouter = require('./routes/pricingAdmin');
const economicRoutingAdminRouter = require('./routes/economicRoutingAdmin');
const printerOffersRouter = require('./routes/printerOffers');
const offersAdminRouter = require('./routes/offersAdmin');
const marketplaceAdminRouter = require('./routes/marketplaceAdmin');
const negotiationAdminRouter = require('./routes/negotiationAdmin');
const commercialCommitmentAdminRouter = require('./routes/commercialCommitmentAdmin');
const autonomyAdminRouter = require('./routes/autonomyAdmin');
const autonomyFinanceRouter = require('./routes/autonomyFinanceAdmin');
const settlementWorker = require('./services/settlementWorker');
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
const dbService = require('./services/db');


const isProd = process.env.NODE_ENV === 'production';
const shouldAutoMigrate = process.env.AUTO_MIGRATE === '1';

// P0: Mandatory check - Add to startupErrors if missing DATABASE_URL in production
if (isProd && !process.env.DATABASE_URL) {
  const msg = '[CRITICAL] DATABASE_URL missing in environment.';
  console.error(msg);
  startupErrors.push(msg);
}

// Initialize V2 Workers (BE-005) - Moved to listen callback for production safety
const initWorkers = () => {
  if (process.env.NODE_ENV !== 'test') {
    debugLog('Starting background workers...');
    require('./workers/v2-worker');
    require('./workers/batch-orchestrator');
    require('./workers/webhook-worker');
  }
};


// Simple logger without file-system writes to avoid PM2 watch-loop crashes
const debugLog = (msg) => {
  console.log(`[${new Date().toISOString()}] ${msg}`);
};

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
  // Give time for logs to flush, then exit with failure
  setTimeout(() => process.exit(1), 500);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
  // Exit with failure to allow process manager to restart
  setTimeout(() => process.exit(1), 500);
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
// Port can be a number or a pipe string (Plesk/Passenger)
const rawPort = process.env.PORT || '8080';
const port = /^\d+$/.test(rawPort) ? Number.parseInt(rawPort, 10) : rawPort;

if (pdfRouter.uploadDir) {
  startCleanupTask(pdfRouter.uploadDir);
}

// Ensure V2 Temporary Upload Dir
const v2TempDir = path.join(__dirname, 'uploads-v2-temp');
if (!fs.existsSync(v2TempDir)) {
  fs.mkdirSync(v2TempDir, { recursive: true });
}

app.use(pino);

app.set('trust proxy', true); // P2: Flexible for Plesk/Nginx/Apache multi-layer proxying

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
  'https://demo.printprice.pro',
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
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-PPP-Autofix-Report',
    'x-ppp-api-key',
    'X-Admin-Api-Key',
    'x-admin-api-key'
  ],
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
const v2UploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'V2 Engine: Too many upload requests. Limit is 10 per minute.' }
});

const v2ReadLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'V2 Engine: Too many status requests. Limit is 100 per minute.' }
});

const readyHandler = async (_req, res) => {
  const { ok: depsOk, deps } = checkAllDependencies();
  const dbConnected = await dbService.checkConnection();
  const isHealthy = depsOk && startupErrors.length === 0 && dbConnected;

  const response = {
    status: isHealthy ? 'READY' : 'BOOT_ERROR',
    version: require('./package.json').version || '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production',
    database: dbConnected ? 'CONNECTED' : 'DISCONNECTED',
    startup_errors: startupErrors,
    dependencies: deps,
    uploadDirWritable: false
  };

  try {
    if (pdfRouter.uploadDir && fs.existsSync(pdfRouter.uploadDir)) {
      fs.accessSync(pdfRouter.uploadDir, fs.constants.W_OK);
      response.uploadDirWritable = true;
    }
  } catch (err) {
    response.uploadDirWritable = false;
  }

  // Return 503 if not ready, for load balancer awareness
  res.status(response.status === 'READY' ? 200 : 503).json(response);
};

const healthDepsHandler = (_req, res) => {
  const result = checkAllDependencies();
  res.status(result.ok ? 200 : 503).json(result);
};

// -------- Routes --------
app.use('/api/gemini-proxy', apiKeyMiddleware, proxyRouter);

// Diagnostic Routes (No limiter for /ready to ensure health-checks pass during startup load)
app.get(['/healthz', '/api/healthz'], (_req, res) => res.status(200).send('ok'));
app.get(['/ready', '/api/ready'], readyHandler);
app.get(['/health/deps', '/api/health/deps'], healthDepsHandler);

app.use(['/version', '/api/version', '/metrics', '/api/metrics'], diagnosticLimiter);
app.use('/api/convert', convertLimiter);
console.log('Mounting /api/convert routes...');
app.use('/api/convert', (req, res, next) => {
  console.log(`[ROUTE-DEBUG][${req.id || '-'}] ${req.method} ${req.url}`);
  next();
}, pdfRouter);

// V2 Asynchronous Routes (Internal)
debugLog('Mounting /api/v2/preflight routes...');
app.use('/api/v2/preflight', v2UploadLimiter, preflightV2Router);

// Public API v2 (External, API-Key Authenticated)
// Mount specific endpoints to avoid middleware duplication and ambiguity (P1)
debugLog('Mounting /api/v2 public routes...');
app.use('/api/v2/jobs', apiV2Router);
app.use('/api/v2/batches', batchV2Router);
app.use('/api/v2/analytics', analyticsV2Router);

// PrintPrice Connect (Printer Onboarding & Network)
debugLog('Mounting /api/connect routes...');
app.use('/api/connect', connectRouter);

// --- Unified Admin API Registration ---
const requireAdmin = require('./middleware/requireAdmin');

const adminMasterRouter = express.Router();
adminMasterRouter.use(requireAdmin);

// Mount Sub-Routers to the master admin router
adminMasterRouter.use('/network', connectAdminRouter);
adminMasterRouter.use('/routing/economic', economicRoutingAdminRouter);
adminMasterRouter.use('/routing', routingAdminRouter);
adminMasterRouter.use('/pricing', pricingAdminRouter);
adminMasterRouter.use('/offers', offersAdminRouter);
adminMasterRouter.use('/marketplace/ready', negotiationAdminRouter);
adminMasterRouter.use('/marketplace', marketplaceAdminRouter);
adminMasterRouter.use('/commercial', commercialCommitmentAdminRouter);
adminMasterRouter.use('/autonomy', autonomyAdminRouter);
adminMasterRouter.use('/finance', autonomyFinanceRouter);
adminMasterRouter.use('/control', adminControlRoutes);

// Root admin routes (metrics, tenants, queue, etc)
adminMasterRouter.use('/', adminRoutes);

app.use('/api/admin', adminMasterRouter);

// Public/Open Network Routes (Non-admin)
app.use('/api/printer-sync', printerSyncRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/printer-dispatch', printerDispatchRouter);

// Start Background Workers
if (process.env.NODE_ENV !== 'test') {
  require('./workers/offer-expiry-worker');
  require('./workers/marketplace-expiry-worker');
}

// Start autonomous workers
settlementWorker.start();
app.use('/api/printer-offers', printerOffersRouter);

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

// Handlers moved up near mounting to avoid hoisting errors.

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

// -------- 404 & Error Handlers --------

// API 404
app.all('/api/*', (req, res) => {
  console.warn(`[404] API Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: `[V2-ADMIN] Route not found: ${req.originalUrl}`,
    method: req.method,
    path: req.path
  });
});

// SPA Fallback (Non-API routes)
app.get(/^\/(?!api\/).*/, (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('<h1>App not built</h1><p>Run npm run build first.</p>');
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[SERVER-ERROR] ${req.method} ${req.url}:`, err);
  if (res.headersSent) return next(err);

  const statusCode = err.status || err.statusCode || 500;
  if (req.path.startsWith('/api')) {
    return res.status(statusCode).json({
      error: err.message || 'Internal Server Error',
      code: err.code || 'UNKNOWN_ERROR',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }

  res.status(statusCode).send(`<h1>Error ${statusCode}</h1><p>${err.message}</p>`);
});

// -------- Server & WebSocket Initialization --------
if (!global.__SERVER_STARTED) {
  global.__SERVER_STARTED = true;

  // -------- Early Initialization (Non-blocking) --------
  const runDiagnostics = () => {
    debugLog('Verifying system dependencies...');
    const { ok, deps } = checkAllDependencies();

    // P1: Capture missing dependencies
    if (isProd && !ok) {
      const missing = Object.entries(deps)
        .filter(([_, d]) => !d.installed)
        .map(([name]) => name);
      const msg = `[CRITICAL] Missing dependencies: ${missing.join(', ')}.`;
      console.error(msg);
      startupErrors.push(msg);
    }

    if (!ok) {
      console.warn('[WARNING] Missing dependencies detected!');
    }

    // Abort further init if we have critical boot errors (like missing DB_URL)
    if (startupErrors.length > 0) {
      debugLog('Postponing schema init/workers due to startup errors.');
      return;
    }

    // P0: Only auto-migrate if explicitly enabled (usually NOT in production)
    if (shouldAutoMigrate) {
      debugLog('Initializing database schema (AUTO_MIGRATE=1)...');
      initSchema()
        .then(() => {
          debugLog('Database schema initialized.');
          initWorkers();
        })
        .catch(err => {
          const msg = `[CRITICAL][DB-SCHEMA-INIT] ${err.message}`;
          console.error(msg, err);
          startupErrors.push(msg);
        });
    } else {
      debugLog('Skipping auto-migration (AUTO_MIGRATE=0).');
      initWorkers();
    }
  };

  // Start server
  const server = (typeof port === 'number'
    ? app.listen(port, '0.0.0.0', () => {
      console.log(`[SERVER-START] OK: Listening on 0.0.0.0:${port}`);
      runDiagnostics();
    })
    : app.listen(port, () => {
      console.log(`[SERVER-START] OK: Listening on socket/pipe: ${port}`);
      runDiagnostics();
    })
  ).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[CRITICAL] Port/Socket ${port} is already in use.`);
    } else {
      console.error(`[CRITICAL] Server failed to start:`, err);
    }
    // We keep this exit because if it can't bind, we are truly dead.
    // However, we give it a tiny delay to allow logs to flush.
    setTimeout(() => process.exit(1), 100);
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
    setTimeout(() => {
      console.error('[SERVER-SHUTDOWN] Forced exit after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;

