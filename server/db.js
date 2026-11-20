'use strict';
const fs = require('fs');
const path = require('path');

/* Відкриває SQLite. Використовується вбудований модуль node:sqlite (Node 22+),
   а для старіших версій - пакет better-sqlite3 (мають однаковий синхронний інтерфейс). */
function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  let Driver = null;
  try { Driver = require('node:sqlite').DatabaseSync; } catch (e) { Driver = null; }
  const db = Driver ? new Driver(file) : new (require('better-sqlite3'))(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

/* Модель даних. Зв'язки захищені зовнішніми ключами, значення - обмеженнями CHECK. */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  bio           TEXT    NOT NULL DEFAULT '',
  gender        TEXT    CHECK (gender IN ('f', 'm')),
  is_demo       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS books (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  author      TEXT NOT NULL,
  genre       TEXT NOT NULL,
  isbn        TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#555555',
  cover_url   TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  base_rating REAL NOT NULL,
  base_votes  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS shelf (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_slug TEXT    NOT NULL REFERENCES books(slug) ON DELETE CASCADE,
  status    TEXT    NOT NULL CHECK (status IN ('want', 'reading', 'read')),
  added_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, book_slug)
);
CREATE TABLE IF NOT EXISTS ratings (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_slug TEXT    NOT NULL REFERENCES books(slug) ON DELETE CASCADE,
  value     INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, book_slug)
);
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_slug  TEXT    NOT NULL REFERENCES books(slug) ON DELETE CASCADE,
  text       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, book_slug)
);
CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  text       TEXT    NOT NULL,
  read_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shelf_user    ON shelf(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_book  ON reviews(book_slug);
CREATE INDEX IF NOT EXISTS idx_notif_user    ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

function migrate(db) { db.exec(SCHEMA); }

// Транзакція: усі зміни або виконуються разом, або скасовуються
function transaction(db, fn) {
  db.exec('BEGIN');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

// SQLite зберігає час як "YYYY-MM-DD HH:MM:SS" (UTC); для API переводимо в ISO 8601
const iso = (s) => (s ? s.replace(' ', 'T') + 'Z' : null);

module.exports = { openDatabase, migrate, transaction, iso };
