const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { env } = require('./config');
const { connect, ensureIndexes, close } = require('./db');
const { attachNow } = require('./time');
const { ApiError, problem } = require('./errors');
const { loadSession, sameOriginOnly } = require('./auth');
const { seedIfEmpty, ensureAdmin } = require('./seed');

const root = path.join(__dirname, '..');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxyHops > 0) app.set('trust proxy', env.trustProxyHops);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ['https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use('/vendor/gsap', express.static(path.join(root, 'node_modules', 'gsap', 'dist')));
  app.use('/vendor/three', express.static(path.join(root, 'node_modules', 'three', 'build')));
  app.use(express.static(path.join(root, 'public')));

  app.use('/api', express.json({ limit: '50kb' }), attachNow, sameOriginOnly, loadSession);
  app.use('/api', require('./routes/public'));
  app.use('/api', require('./routes/auth'));
  app.use('/api', require('./routes/member'));
  app.use('/api/admin', require('./routes/admin'));

  app.use('/api', (req, res, next) => next(problem('NOT_FOUND', 'No such endpoint.')));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof ApiError) {
      const body = { error: error.message };
      if (error.code) body.code = error.code;
      if (error.fields) body.fields = error.fields;
      return res.status(error.status).json(body);
    }
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.', code: 'BAD_JSON' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.', code: 'TOO_LARGE' });
    console.error(`Unhandled error on ${req.method} ${req.path}:`, error.stack ?? error);
    return res.status(500).json({ error: 'Something went wrong on our side.', code: 'INTERNAL' });
  });

  return app;
}

async function start() {
  await connect();
  await ensureIndexes();
  if (env.seedDemoData && (await seedIfEmpty())) console.log('Database was empty, loaded demo data.');
  if (await ensureAdmin()) console.log('Created the ADMIN login from ADMIN_PASSWORD.');

  const server = createApp().listen(env.port, () => {
    console.log(`IIIT-BH Mess running at http://localhost:${env.port} (database "${env.mongoDb}")`);
  });

  const shutdown = () => {
    server.close(() => close().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Failed to start:', error.message);
  process.exit(1);
});
