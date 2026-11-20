'use strict';
const express = require('express');
const { HttpError } = require('../errors');
const { iso } = require('../db');

module.exports = function notificationsRoutes({ db, auth }) {
  const router = express.Router();
  router.use(auth.requireAuth);

  const unread = (userId) => Number(db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId).c);

  // GET /api/notifications - список сповіщень (Read)
  router.get('/', (req, res) => {
    const items = db.prepare(
      `SELECT n.id, n.text, n.read_at, n.created_at, n.actor_id, a.name AS actor_name
         FROM notifications n LEFT JOIN users a ON a.id = n.actor_id
        WHERE n.user_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT 50`).all(req.user.id)
      .map((n) => ({ id: n.id, text: n.text, actorId: n.actor_id, actorName: n.actor_name, createdAt: iso(n.created_at), read: !!n.read_at }));
    res.json({ items, unread: unread(req.user.id) });
  });

  // GET /api/notifications/unread-count - лічильник для значка в меню
  router.get('/unread-count', (req, res) => res.json({ unread: unread(req.user.id) }));

  // POST /api/notifications/read-all - позначити всі прочитаними (Update)
  router.post('/read-all', (req, res) => {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(req.user.id);
    res.json({ unread: 0 });
  });

  // PATCH /api/notifications/:id - позначити одне прочитаним (Update)
  router.patch('/:id', (req, res) => {
    if (!/^\d+$/.test(req.params.id)) throw new HttpError(404, 'NOT_FOUND', 'Сповіщення не знайдено.');
    const info = db.prepare("UPDATE notifications SET read_at = COALESCE(read_at, datetime('now')) WHERE id = ? AND user_id = ?").run(Number(req.params.id), req.user.id);
    if (!info.changes) throw new HttpError(404, 'NOT_FOUND', 'Сповіщення не знайдено.');
    res.json({ unread: unread(req.user.id) });
  });

  return router;
};
