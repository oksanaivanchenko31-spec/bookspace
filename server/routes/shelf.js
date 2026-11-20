'use strict';
const express = require('express');
const { HttpError } = require('../errors');
const { iso, transaction } = require('../db');
const v = require('../validate');

module.exports = function shelfRoutes({ db, auth }) {
  const router = express.Router();
  router.use(auth.requireAuth);

  // GET /api/shelf - уся полиця користувача (Read)
  router.get('/', (req, res) => {
    const items = db.prepare('SELECT book_slug, status, added_at FROM shelf WHERE user_id = ? ORDER BY added_at DESC, rowid DESC').all(req.user.id)
      .map((r) => ({ slug: r.book_slug, status: r.status, addedAt: iso(r.added_at) }));
    res.json({ items });
  });

  // PUT /api/shelf/:slug - додати книгу або змінити статус (Create/Update)
  router.put('/:slug', (req, res) => {
    const { values, fields } = v.shelfStatus(req.body);
    if (fields) throw new HttpError(400, 'VALIDATION', 'Перевірте введені дані.', fields);
    if (!db.prepare('SELECT 1 FROM books WHERE slug = ?').get(req.params.slug)) throw new HttpError(404, 'NOT_FOUND', 'Книгу не знайдено.');
    const existing = db.prepare('SELECT 1 FROM shelf WHERE user_id = ? AND book_slug = ?').get(req.user.id, req.params.slug);
    transaction(db, () => {
      db.prepare(`INSERT INTO shelf (user_id, book_slug, status) VALUES (?, ?, ?)
                  ON CONFLICT (user_id, book_slug) DO UPDATE SET status = excluded.status`).run(req.user.id, req.params.slug, values.status);
      // Оцінка має сенс лише для прочитаної книги
      if (values.status !== 'read') db.prepare('DELETE FROM ratings WHERE user_id = ? AND book_slug = ?').run(req.user.id, req.params.slug);
    });
    const row = db.prepare('SELECT book_slug, status, added_at FROM shelf WHERE user_id = ? AND book_slug = ?').get(req.user.id, req.params.slug);
    res.status(existing ? 200 : 201).json({ item: { slug: row.book_slug, status: row.status, addedAt: iso(row.added_at) } });
  });

  // DELETE /api/shelf/:slug - прибрати книгу з полиці (Delete)
  router.delete('/:slug', (req, res) => {
    const info = transaction(db, () => {
      db.prepare('DELETE FROM ratings WHERE user_id = ? AND book_slug = ?').run(req.user.id, req.params.slug);
      return db.prepare('DELETE FROM shelf WHERE user_id = ? AND book_slug = ?').run(req.user.id, req.params.slug);
    });
    if (!info.changes) throw new HttpError(404, 'NOT_FOUND', 'Цієї книги немає на вашій полиці.');
    res.status(204).end();
  });

  return router;
};
