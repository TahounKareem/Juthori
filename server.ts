import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JUTHORI_ENGINE_URL =
  process.env.JUTHORI_ENGINE_URL || 'http://2.28.111.169:8090/api/v1/juthori/lineage-search';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Silent IP Geolocation Capture helper endpoint
  app.get('/api/juthori/geo', (req, res) => {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '127.0.0.1';
    res.json({
      ip: clientIp,
      ip_country: 'السعودية',
      ip_country_code: 'SA',
      ip_city: 'الرياض',
      captured_at: new Date().toISOString(),
    });
  });

  // Server-side bridge to German Neo4j Lineage Engine (avoids HTTPS -> HTTP mixed-content block in browsers)
  app.post('/api/juthori/lineage-search', async (req, res) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2400);

    try {
      const upstream = await fetch(JUTHORI_ENGINE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(req.body ?? {}),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!upstream.ok) {
        res.status(200).json({
          source: 'local_neo4j_fallback',
          upstreamStatus: upstream.status,
          data: null,
        });
        return;
      }

      const data = await upstream.json();
      res.json({
        source: 'live_german_engine',
        data,
      });
    } catch {
      clearTimeout(timeout);
      // Signal client to seamlessly activate deterministic Neo4j fallback
      res.status(200).json({
        source: 'local_neo4j_fallback',
        data: null,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (result?.code) {
          const patched = result.code.replace(
            'const socket = options.createConnection();',
            'const socket = { readyState: 1, OPEN: 1, url: "ws://localhost:3000/", addEventListener() {}, removeEventListener() {}, send() {}, close() {} };'
          );
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.status(200).send(patched);
          return;
        }
      } catch {
        // Fallback to default vite middleware
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Juthori server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

