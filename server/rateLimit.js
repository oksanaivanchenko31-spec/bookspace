'use strict';
const { HttpError } = require('./errors');

/* Простий обмежувач частоти запитів у пам'яті: не більше max запитів за вікно з однієї адреси. */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || 'unknown', now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (recent.length > max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return next(new HttpError(429, 'RATE_LIMIT', 'Забагато спроб. Спробуйте пізніше.'));
    }
    next();
  };
}

module.exports = { rateLimit };
