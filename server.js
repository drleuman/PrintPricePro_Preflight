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

// File-based logger for Plesk debugging
const debugLog = (msg) => {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(path.resolve(__dirname, 'server_debug.log'), entry);
  } catch (e) { }
  console.log(msg);
};

debugLog('Server starting with relaxed security...');

const app = express();
// Cloud Run (and most PaaS) inject PORT=8080. Default to 8080 for local runs.
const port = Number.parseInt(process.env.PORT || '8080', 10);

// -------- Services Init --------
if (pdfRouter.uploadDir) {
  startCleanupTask(pdfRouter.uploadDir);
}

// -------- Middlewares base --------
app.set('trust proxy', 1);

// Super permissive CORS for debugging
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-PPP-Autofix-Report']
}));

// Basic headers without Helmet's strictness
app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'PrintPricePro');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

// Request Logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// -------- Routes --------
app.use('/api-proxy', proxyRouter);
app.use('/api/convert', pdfRouter);

app.use('/api/*path', (req, res) => {
  console.warn(`[404] API Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
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

// Increase timeout for long Ghostscript tasks
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
