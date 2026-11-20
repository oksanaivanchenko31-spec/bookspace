'use strict';
const express = require('express');
const { HttpError } = require('../errors');
const { iso } = require('../db');
const v = require('../validate');

module.exports = function reviewsRoutes({ db, auth }) {
  const router = express.Router();
  router.use(auth.requireAuth);

  // Знаходить відгук і перевіряє, що він належить поточному користувачу
  function ownReview(req) {
    if (!/^\d+$/.test(req.params.id)) throw new HttpError(404, 'NOT_FOUND', 'Відгук не знайдено.');
    const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(Number(req.params.id));
    if (!row) throw new HttpError(404, 'NOT_FOUND', 'Відгук не знайдено.');
    if (row.user_id !== req.user.id) throw new HttpError(403, 'FORBIDDEN', 'Редагувати чи видаляти можна лише власні відгуки.');
    return row;
  }

  // PUT /api/reviews/:id - змінити текст відгуку (Update)
  router.put('/:id', (req, res) => {
    const row = ownReview(req);
    const { values, fields } = v.review(req.body);
    if (fields) throw new HttpError(400, 'VALIDATION', 'Перевірте введені дані.', fields);
    db.prepare("UPDATE reviews SET text = ?, updated_at = datetime('now') WHERE id = ?").run(values.text, row.id);
    const upd = db.prepare('SELECT r.*, u.name AS author_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?').get(row.id);
    res.json({ review: { id: upd.id, text: upd.text, author: upd.author_name, authorId: upd.user_id, createdAt: iso(upd.created_at), updatedAt: iso(upd.updated_at), mine: true } });
  });

  // DELETE /api/reviews/:id - видалити відгук (Delete)
  router.delete('/:id', (req, res) => {
    const row = ownReview(req);
    db.prepare('DELETE FROM reviews WHERE id = ?').run(row.id);
    res.status(204).end();
  });

  return router;
};
