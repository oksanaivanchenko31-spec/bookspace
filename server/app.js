'use strict';
const express = require('express');
const { HttpError } = require('./errors');
const { makeAuth } = require('./auth');

let compression = null;
try { compression = require('compression'); } catch (e) { /* пакет не встановлено: працюємо без стиснення */ }

/* Захисні HTTP-заголовки (політика вмісту CSP не дозволяє виконувати сторонні скрипти). */
function securityHeaders(config) {
  const csp = [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com", "img-src 'self' data: https:", "connect-src 'self'",
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
  ].join('; ');
  return (req, res, next) => {
    res.set('Content-Security-Policy', csp);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (config.production) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  };
}

// CORS потрібен, лише якщо клієнт розміщений на іншому домені (дозволені джерела беруться з CORS_ORIGIN)
function cors(config) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && config.corsOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') return res.status(204).end();
    }
    next();
  };
}

// Єдиний формат помилок: { error: { code, message, fields? } }
function errorHandler(err, req, res, next) {   // eslint-disable-line no-unused-vars
  if (res.headersSent) return;
  const send = (status, code, message, fields) => res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });
  if (err instanceof HttpError) return send(err.status, err.code, err.message, err.fields);
  if (err && err.type === 'entity.parse.failed') return send(400, 'BAD_JSON', 'Некоректний JSON у тілі запиту.');
  if (err && err.type === 'entity.too.large') return send(413, 'TOO_LARGE', 'Тіло запиту занадто велике.');
  console.error(err);
  send(500, 'INTERNAL', 'Внутрішня помилка сервера.');
}

function createApp({ db, config }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);                       // за проксі хостингу (Render) беремо справжню IP клієнта
  app.use(securityHeaders(config));
  if (compression) app.use(compression());           // gzip для HTML/CSS/JS/JSON (пакет compression, необов'язковий)
  app.use(cors(config));
  app.use(express.json({ limit: '10kb' }));         // обмеження розміру тіла запиту

  const ctx = { db, config, auth: makeAuth({ db, config }) };
  const api = express.Router();
  api.get('/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', db: 'ok', time: new Date().toISOString() });
  });
  api.use('/auth', require('./routes/auth')(ctx));
  api.use('/me', require('./routes/me')(ctx));
  api.use('/books', require('./routes/books')(ctx));
  api.use('/reviews', require('./routes/reviews')(ctx));
  api.use('/shelf', require('./routes/shelf')(ctx));
  api.use('/readers', require('./routes/readers')(ctx));
  api.use('/feed', require('./routes/feed')(ctx));
  api.use('/notifications', require('./routes/notifications')(ctx));
  api.use((req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Маршрут API не знайдено.')));
  app.use('/api', api);

  // Клієнтська частина (HTML, CSS, JS, зображення)
  app.use(express.static(config.publicDir, { maxAge: config.production ? '1h' : 0 }));
  app.use((req, res) => res.status(404).send('Сторінку не знайдено'));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
