'use strict';
const { iso } = require('./db');

/* Книга з обчисленим середнім рейтингом: базова оцінка (як у демо-даних) + усі оцінки користувачів. */
const BOOK_SQL = `
SELECT b.slug, b.title, b.author, b.genre, b.isbn, b.color, b.cover_url, b.description,
       (b.base_rating * b.base_votes + COALESCE((SELECT SUM(value) FROM ratings r WHERE r.book_slug = b.slug), 0)) * 1.0
         / (b.base_votes + (SELECT COUNT(*) FROM ratings r WHERE r.book_slug = b.slug)) AS rating,
       b.base_votes + (SELECT COUNT(*) FROM ratings r WHERE r.book_slug = b.slug) AS votes
  FROM books b`;

const toBook = (r) => ({
  slug: r.slug, title: r.title, author: r.author, genre: r.genre, isbn: r.isbn,
  color: r.color, coverUrl: r.cover_url, description: r.description,
  rating: Math.round(r.rating * 10) / 10, votes: Number(r.votes),
});

const listBooks = (db) => db.prepare(BOOK_SQL + ' ORDER BY b.rowid').all().map(toBook);
const getBook = (db, slug) => {
  const row = db.prepare(BOOK_SQL + ' WHERE b.slug = ?').get(slug);
  return row ? toBook(row) : null;
};

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, bio: u.bio, gender: u.gender || null, createdAt: iso(u.created_at) });

// Створює сповіщення (ім'я виконавця вже входить у текст)
function notify(db, userId, actorId, text) {
  db.prepare('INSERT INTO notifications (user_id, actor_id, text) VALUES (?, ?, ?)').run(userId, actorId, text);
}

module.exports = { listBooks, getBook, toBook, publicUser, notify };
