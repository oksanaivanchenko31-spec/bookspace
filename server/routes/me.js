'use strict';
const express = require('express');
const { HttpError } = require('../errors');
const { publicUser } = require('../queries');
const v = require('../validate');

module.exports = function meRoutes({ db, auth }) {
  const router = express.Router();
  router.use(auth.requireAuth);

  // PATCH /api/me - оновлення профілю (Update)
  router.patch('/', (req, res) => {
    const { values, fields } = v.profile(req.body);
    if (fields) throw new HttpError(400, 'VALIDATION', 'Перевірте введені дані.', fields);
    const name = values.name !== undefined ? values.name : req.user.name;
    const bio = values.bio !== undefined ? values.bio : req.user.bio;
    db.prepare('UPDATE users SET name = ?, bio = ? WHERE id = ?').run(name, bio, req.user.id);
    res.json({ user: publicUser({ ...req.user, name, bio }) });
  });

  // GET /api/me/summary - статистика для профілю
  router.get('/summary', (req, res) => {
    const id = req.user.id;
    const count = (sql) => Number(db.prepare(sql).get(id).c);
    const fav = db.prepare(
      `SELECT b.genre AS genre, COUNT(*) AS c FROM shelf s JOIN books b ON b.slug = s.book_slug
        WHERE s.user_id = ? GROUP BY b.genre ORDER BY c DESC, b.genre LIMIT 1`).get(id);
    const avg = db.prepare(
      `SELECT AVG(r.value) AS a FROM ratings r JOIN shelf s ON s.user_id = r.user_id AND s.book_slug = r.book_slug
        WHERE r.user_id = ? AND s.status = 'read'`).get(id);
    res.json({
      books: count('SELECT COUNT(*) AS c FROM shelf WHERE user_id = ?'),
      read: count("SELECT COUNT(*) AS c FROM shelf WHERE user_id = ? AND status = 'read'"),
      reviews: count('SELECT COUNT(*) AS c FROM reviews WHERE user_id = ?'),
      following: count('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?'),
      followers: count('SELECT COUNT(*) AS c FROM follows WHERE followee_id = ?'),
      avgRating: avg && avg.a ? Math.round(avg.a * 10) / 10 : null,
      favoriteGenre: fav ? fav.genre : null,
      recentRead: db.prepare("SELECT book_slug FROM shelf WHERE user_id = ? AND status = 'read' ORDER BY added_at DESC, rowid DESC").all(id).map((r) => r.book_slug),
    });
  });

  return router;
};
