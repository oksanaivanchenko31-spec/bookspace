'use strict';
const express = require('express');
const { HttpError } = require('../errors');
const { iso } = require('../db');
const { listBooks, getBook } = require('../queries');
const v = require('../validate');

const reviewDto = (r, meId) => ({
  id: r.id, text: r.text, author: r.author_name, authorId: r.user_id,
  createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), mine: r.user_id === meId,
});

module.exports = function booksRoutes({ db, auth }) {
  const router = express.Router();

  const mustGet = (slug) => {
    const book = getBook(db, slug);
    if (!book) throw new HttpError(404, 'NOT_FOUND', 'Книгу не знайдено.');
    return book;
  };

  // GET /api/books?genre=&q=&sort=title|author|rating - каталог (Read)
  router.get('/', (req, res) => {
    const { genre, q, sort } = req.query;
    let books = listBooks(db);
    if (typeof genre === 'string' && genre) books = books.filter((b) => b.genre === genre);
    if (typeof q === 'string' && q.trim()) {
      const s = q.trim().toLowerCase();
      books = books.filter((b) => (b.title + ' ' + b.author).toLowerCase().includes(s));
    }
    if (sort === 'title') books.sort((a, b) => a.title.localeCompare(b.title, 'uk'));
    else if (sort === 'author') books.sort((a, b) => a.author.localeCompare(b.author, 'uk'));
    else if (sort === 'rating') books.sort((a, b) => b.rating - a.rating);
    res.json({ books, total: books.length });
  });

  // GET /api/books/:slug - книга, відгуки та стан поточного користувача (Read)
  router.get('/:slug', auth.optionalAuth, (req, res) => {
    const book = mustGet(req.params.slug);
    const meId = req.user ? req.user.id : null;
    const reviews = db.prepare(
      `SELECT r.*, u.name AS author_name FROM reviews r JOIN users u ON u.id = r.user_id
        WHERE r.book_slug = ? ORDER BY r.updated_at DESC, r.id DESC`).all(book.slug).map((r) => reviewDto(r, meId));
    let me = null;
    if (req.user) {
      const shelf = db.prepare('SELECT status FROM shelf WHERE user_id = ? AND book_slug = ?').get(meId, book.slug);
      const rating = db.prepare('SELECT value FROM ratings WHERE user_id = ? AND book_slug = ?').get(meId, book.slug);
      me = { status: shelf ? shelf.status : null, rating: rating ? rating.value : null };
    }
    res.json({ book, reviews, me });
  });

  // PUT /api/books/:slug/rating - поставити або змінити оцінку (лише для прочитаної книги)
  router.put('/:slug/rating', auth.requireAuth, (req, res) => {
    const { values, fields } = v.ratingValue(req.body);
    if (fields) throw new HttpError(400, 'VALIDATION', 'Перевірте введені дані.', fields);
    mustGet(req.params.slug);
    const shelf = db.prepare('SELECT status FROM shelf WHERE user_id = ? AND book_slug = ?').get(req.user.id, req.params.slug);
    if (!shelf || shelf.status !== 'read') {
      throw new HttpError(409, 'NOT_READ', 'Оцінити можна лише книгу зі статусом «Прочитано».');
    }
    db.prepare(`INSERT INTO ratings (user_id, book_slug, value) VALUES (?, ?, ?)
                ON CONFLICT (user_id, book_slug) DO UPDATE SET value = excluded.value`).run(req.user.id, req.params.slug, values.value);
    res.json({ rating: values.value, book: getBook(db, req.params.slug) });
  });

  // DELETE /api/books/:slug/rating - прибрати свою оцінку
  router.delete('/:slug/rating', auth.requireAuth, (req, res) => {
    mustGet(req.params.slug);
    db.prepare('DELETE FROM ratings WHERE user_id = ? AND book_slug = ?').run(req.user.id, req.params.slug);
    res.json({ rating: null, book: getBook(db, req.params.slug) });
  });

  // POST /api/books/:slug/reviews - написати відгук (Create); один відгук на книгу від користувача
  router.post('/:slug/reviews', auth.requireAuth, (req, res) => {
    const { values, fields } = v.review(req.body);
    if (fields) throw new HttpError(400, 'VALIDATION', 'Перевірте введені дані.', fields);
    mustGet(req.params.slug);
    if (db.prepare('SELECT 1 FROM reviews WHERE user_id = ? AND book_slug = ?').get(req.user.id, req.params.slug)) {
      throw new HttpError(409, 'REVIEW_EXISTS', 'Ви вже написали відгук на цю книгу. Відредагуйте його.');
    }
    const info = db.prepare('INSERT INTO reviews (user_id, book_slug, text) VALUES (?, ?, ?)').run(req.user.id, req.params.slug, values.text);
    const row = db.prepare('SELECT r.*, u.name AS author_name FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json({ review: reviewDto(row, req.user.id) });
  });

  return router;
};
