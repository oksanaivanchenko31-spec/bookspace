'use strict';
const { HttpError } = require('./errors');
const { newToken, tokenHash } = require('./security');

/* Сесії: токен передається в заголовку Authorization: Bearer <токен>. */
function makeAuth({ db, config }) {
  const hashOf = (token) => tokenHash(token, config.pepper);
  const bearer = (req) => (/^Bearer (\S+)$/.exec(req.headers.authorization || '') || [])[1] || null;

  function createSession(userId) {
    const token = newToken();
    const expires = new Date(Date.now() + config.sessionDays * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    db.exec("DELETE FROM sessions WHERE expires_at <= datetime('now')");   // прибираємо прострочені
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashOf(token), userId, expires);
    return token;
  }

  function findUser(req) {
    const token = bearer(req);
    if (!token) return null;
    return db.prepare(
      `SELECT u.id, u.name, u.email, u.bio, u.gender, u.created_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
    ).get(hashOf(token)) || null;
  }

  function destroySession(req) {
    const token = bearer(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashOf(token));
  }

  const optionalAuth = (req, res, next) => { req.user = findUser(req); next(); };
  const requireAuth = (req, res, next) => {
    const user = findUser(req);
    if (!user) return next(new HttpError(401, 'UNAUTHORIZED', 'Потрібно увійти в акаунт.'));
    req.user = user;
    next();
  };

  return { createSession, destroySession, optionalAuth, requireAuth };
}

module.exports = { makeAuth };
