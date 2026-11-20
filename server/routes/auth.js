'use strict';
const express = require('express');
const { HttpError, wrap } = require('../errors');
const { hashPassword, verifyPassword, DUMMY_HASH } = require('../security');
const { publicUser, notify } = require('../queries');
const v = require('../validate');
const { rateLimit } = require('../rateLimit');
const { transaction } = require('../db');

module.exports = function authRoutes({ db, config, auth }) {
  const router = express.Router();
  const limiter = rateLimit(config.authRateLimit);

  // Початкові дані нового користувача: вітання та один «підписник» (демо-читач)
  function onboarding(userId) {
    notify(db, userId, null, 'Ласкаво просимо до BookSpace! Додайте першу книгу на полицю.');
    const demo = db.prepare("SELECT id, name, gender FROM users WHERE email = 'andrii@demo.bookspace.local'").get();
    if (demo) {
      db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)').run(demo.id, userId);
      notify(db, userId, demo.id, `${demo.name} ${demo.gender === 'f' ? 'підписалася' : 'підписався'} на вас`);
    }
  }

  // POST /api/auth/register - створення акаунта (Create)
  router.post('/register', limiter, wrap(async (req, res) => {
    const { values, fields } = v.register(req.body);
    if (fields) throw new HttpError(400, 'VALIDATION', 'Перевірте введені дані.', fields);
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(values.email)) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'Акаунт із такою поштою вже існує. Спробуйте увійти.',
        { email: 'Акаунт із такою поштою вже існує. Спробуйте увійти.' });
    }
    const hash = await hashPassword(values.password);
    const userId = transaction(db, () => {
      const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(values.name, values.email, hash);
      const id = Number(info.lastInsertRowid);
      onboarding(id);
      return id;
    });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.status(201).json({ token: auth.createSession(userId), user: publicUser(user) });
  }));

  // POST /api/auth/login - вхід
  router.post('/login', limiter, wrap(async (req, res) => {
    const { values, fields } = v.login(req.body);
    if (fields) throw new HttpError(400, 'VALIDATION', 'Перевірте введені дані.', fields);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(values.email);
    const ok = await verifyPassword(values.password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'BAD_CREDENTIALS', 'Неправильна пошта або пароль.');   // однакове повідомлення в обох випадках
    res.json({ token: auth.createSession(user.id), user: publicUser(user) });
  }));

  // POST /api/auth/logout - вихід (знищує сесію на сервері)
  router.post('/logout', auth.requireAuth, (req, res) => {
    auth.destroySession(req);
    res.status(204).end();
  });

  // GET /api/auth/me - поточний користувач (Read)
  router.get('/me', auth.requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

  return router;
};
