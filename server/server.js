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

const { router: proxyRouter, handleWsUpgrade } = require('./routes/proxy');
const pdfRouter = require('./routes/pdf');
const { startCleanupTask } = require('./services/cleanup');

const app = express();
const port = Number.parseInt(process.env.PORT || '8080', 10);

if (pdfRouter.uploadDir) {
  startCleanupTask(pdfRouter.uploadDir);
}

app.set('trust proxy', 1);

// Permissive CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-PPP-Autofix-Report']
}));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.json({ limit: '70mb' }));
app.use(express.urlencoded({ extended: true, limit: '70mb' }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api-proxy', proxyRouter);
app.use('/api/convert', pdfRouter);

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
