'use strict';
const express = require('express');
const { iso } = require('../db');

module.exports = function feedRoutes({ db, auth }) {
  const router = express.Router();

  // GET /api/feed - що читають і прочитали ті, на кого підписаний користувач
  router.get('/', auth.requireAuth, (req, res) => {
    const rows = db.prepare(
      `SELECT s.book_slug, s.status, s.added_at, u.id AS reader_id, u.name, u.gender
         FROM shelf s
         JOIN follows f ON f.followee_id = s.user_id AND f.follower_id = ?
         JOIN users u ON u.id = s.user_id
        WHERE s.status IN ('read', 'reading')
        ORDER BY s.added_at DESC, s.rowid DESC LIMIT 6`).all(req.user.id);
    res.json({
      items: rows.map((r) => ({
        reader: { id: r.reader_id, name: r.name, gender: r.gender || null },
        slug: r.book_slug, status: r.status, at: iso(r.added_at),
      })),
    });
  });

  return router;
};
