'use strict';
const path = require('path');

/* Налаштування беруться зі змінних середовища (секрети не зберігаються в коді). */
function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const pepper = env.SESSION_PEPPER || (production ? null : 'dev-only-pepper-change-me');
  if (!pepper) {
    throw new Error('Змінна середовища SESSION_PEPPER обов’язкова в production.');
  }
  return {
    production,
    port: Number(env.PORT) || 3000,
    dbPath: env.DB_PATH || path.join(__dirname, '..', 'data', 'bookspace.db'),
    publicDir: path.join(__dirname, '..', 'public'),
    pepper,
    sessionDays: Number(env.SESSION_DAYS) || 7,
    corsOrigins: (env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
    // Обмеження кількості спроб входу/реєстрації з однієї адреси
    authRateLimit: { windowMs: 10 * 60 * 1000, max: 40 },
  };
}

module.exports = { loadConfig };
