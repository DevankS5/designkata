import http from 'node:http';
import path from 'node:path';
import express from 'express';

const isDev = process.argv.includes('--dev');
const port = Number(process.env.PORT ?? 3000);

const app = express();
const server = http.createServer(app);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

if (isDev) {
  // One process in development: Vite serves the React app with hot reload.
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const dist = path.resolve('web/dist');
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

server.listen(port, () => {
  console.log(`DesignKata running on http://localhost:${port}`);
});
