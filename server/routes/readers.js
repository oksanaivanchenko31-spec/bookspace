'use strict';
const express = require('express');
const { HttpError } = require('../errors');
const { notify } = require('../queries');

module.exports = function readersRoutes({ db, auth }) {
  const router = express.Router();
  router.use(auth.requireAuth);

  const GROUP = { read: 'read', reading: 'reading', want: 'want' };

  // Збирає книги читачів, згруповані за статусом: { userId: { read: [], reading: [], want: [] } }
  function shelvesOf(ids) {
    const out = {};
    ids.forEach((id) => { out[id] = { read: [], reading: [], want: [] }; });
    if (!ids.length) return out;
    const rows = db.prepare(`SELECT user_id, book_slug, status FROM shelf WHERE user_id IN (${ids.map(() => '?').join(',')}) ORDER BY added_at DESC, rowid DESC`).all(...ids);
    rows.forEach((r) => out[r.user_id][GROUP[r.status]].push(r.book_slug));
    return out;
  }

  const followingSet = (meId) =>
    new Set(db.prepare('SELECT followee_id FROM follows WHERE follower_id = ?').all(meId).map((r) => r.followee_id));

  const dto = (u, shelves, following) => ({
    id: u.id, name: u.name, bio: u.bio, gender: u.gender || null,
    shelves: shelves[u.id], following: following.has(u.id),
  });

  function mustGetReader(req) {
    if (!/^\d+$/.test(req.params.id)) throw new HttpError(404, 'NOT_FOUND', 'Читача не знайдено.');
    const id = Number(req.params.id);
    const user = db.prepare('SELECT id, name, bio, gender FROM users WHERE id = ?').get(id);
    if (!user) throw new HttpError(404, 'NOT_FOUND', 'Читача не знайдено.');
    return user;
  }

  // GET /api/readers - інші користувачі платформи (Read)
  router.get('/', (req, res) => {
    const users = db.prepare('SELECT id, name, bio, gender FROM users WHERE id <> ? ORDER BY is_demo DESC, id').all(req.user.id);
    const shelves = shelvesOf(users.map((u) => u.id)), following = followingSet(req.user.id);
    res.json({ readers: users.map((u) => dto(u, shelves, following)) });
  });

  // GET /api/readers/following - на кого підписаний поточний користувач
  router.get('/following', (req, res) => {
    const users = db.prepare('SELECT u.id, u.name, u.bio, u.gender FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ? ORDER BY f.created_at DESC, u.id').all(req.user.id);
    const shelves = shelvesOf(users.map((u) => u.id));
    res.json({ readers: users.map((u) => dto(u, shelves, new Set(users.map((x) => x.id)))) });
  });

  // GET /api/readers/:id - профіль читача (Read)
  router.get('/:id', (req, res) => {
    const user = mustGetReader(req);
    res.json({ reader: dto(user, shelvesOf([user.id]), followingSet(req.user.id)) });
  });

  // PUT /api/readers/:id/follow - підписатися (Create, ідемпотентно)
  router.put('/:id/follow', (req, res) => {
    const user = mustGetReader(req);
    if (user.id === req.user.id) throw new HttpError(400, 'SELF_FOLLOW', 'Не можна підписатися на себе.');
    const info = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)').run(req.user.id, user.id);
    if (info.changes) {
      notify(db, user.id, req.user.id, `${req.user.name} ${req.user.gender === 'f' ? 'підписалася' : 'підписався'} на вас`);
    }
    res.json({ following: true });
  });

  // DELETE /api/readers/:id/follow - скасувати підписку (Delete)
  router.delete('/:id/follow', (req, res) => {
    const user = mustGetReader(req);
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?').run(req.user.id, user.id);
    res.json({ following: false });
  });

  return router;
};
