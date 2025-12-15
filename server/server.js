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

// -------- Routes --------

// API Proxy (HTTP)
app.use('/api-proxy', proxyRouter);

// PDF Tools
app.use('/api/convert', pdfRouter);


// -------- Static Files (Vite Build) --------
const staticPath = path.join(__dirname, 'dist');
// Serve /dist with correct MIME for .mjs
app.use(
  express.static(staticPath, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
    },
  })
);

// Healthcheck
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// SPA fallback
app.get(/^\/(?!api-proxy\/|api\/).*/, (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// -------- Server & WebSocket --------
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
