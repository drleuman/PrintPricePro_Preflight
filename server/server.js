/**
 * @license
 * Copyright 2025
 * SPDX-License-Identifier: Apache-2.0
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const WebSocket = require('ws');

const { router: proxyRouter, handleWsUpgrade } = require('./routes/proxy');
const pdfRouter = require('./routes/pdf');
const { startCleanupTask } = require('./services/cleanup');

const app = express();
// Cloud Run (and most PaaS) inject PORT=8080. Default to 8080 for local runs.
const port = Number.parseInt(process.env.PORT || '8080', 10);

// -------- Services Init --------
// Clean upload directory every 15 mins, delete files older than 1 hour
if (pdfRouter.uploadDir) {
  startCleanupTask(pdfRouter.uploadDir);
}

// -------- Middlewares base --------
app.set('trust proxy', 1);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request Logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// -------- Routes --------

// API Proxy (HTTP)
app.use('/api-proxy', proxyRouter);

// PDF Tools
app.use('/api/convert', pdfRouter);

// Catch-all for /api that didn't match
app.use('/api/*', (req, res) => {
  console.warn(`[404] API Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
});


// -------- Static Files (Vite Build) --------
// Try absolute paths first to be safe in Plesk environment
const possiblePaths = [
  path.resolve(__dirname, '..', 'dist'),
  path.resolve(__dirname, 'dist'),
  path.join(process.cwd(), 'dist')
];

let staticPath = possiblePaths[0];
for (const p of possiblePaths) {
  if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
    staticPath = p;
    break;
  }
}

console.log(`[INIT] Serving static files from final path: ${staticPath}`);

// Serve /dist with correct MIME types
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

// Healthcheck
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Debug endpoint to list all routes
app.get('/debug/routes', (_req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const path = middleware.regexp.source.replace('\\/?', '').replace('(?=\\/|$)', '');
          routes.push({
            path: path + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  res.json({ routes });
});

// SPA fallback
app.get(/^\/(?!api-proxy\/|api\/).*/, (req, res) => {
  const indexFile = 'index_dev.html'; // El nombre que genera Vite ahora
  const indexPath = path.join(staticPath, indexFile);
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Check fallback
    const fallbackIndex = path.resolve(__dirname, 'dist', indexFile);
    if (fs.existsSync(fallbackIndex)) {
      res.sendFile(fallbackIndex);
    } else {
      res.status(404).send(`
        <h1>App Configuration Error</h1>
        <p>Could not find index.html at ${indexPath}</p>
        <p>Current server dir: ${__dirname}</p>
        <p>Please ensure 'npm run build' has been executed.</p>
      `);
    }
  }
});

// -------- Server & WebSocket --------
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on :${port}`);
    console.log(`HTTP proxy active at /api-proxy/**`);
  });

  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith('/api-proxy')) {
      handleWsUpgrade(wss, request, socket, head);
    } else {
      socket.destroy();
    }
  });
}

module.exports = app;
