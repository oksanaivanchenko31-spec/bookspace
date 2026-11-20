'use strict';
/* Автотести REST API. Запуск: npm test (потрібен Node 22+; сервер піднімається на вільному порту з БД у пам'яті). */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../config');
const { openDatabase, migrate } = require('../db');
const { seedIfEmpty } = require('../seed');
const { createApp } = require('../app');

let server, base, db;
before(async () => {
  const config = { ...loadConfig({}), dbPath: ':memory:', authRateLimit: { windowMs: 60000, max: 1000 } };
  db = openDatabase(':memory:'); migrate(db); seedIfEmpty(db);
  server = createApp({ db, config }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); db.close(); });

async function api(method, path, { token, body, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { /* не JSON */ }
  return { status: res.status, body: json, headers: res.headers };
}
let counter = 0;
async function newUser(name = 'Тест Тестовий') {
  const email = `user${++counter}_${Date.now()}@test.ua`;
  const r = await api('POST', '/api/auth/register', { body: { name, email, password: 'abcd1234' } });
  assert.equal(r.status, 201);
  return { token: r.body.token, user: r.body.user, email };
}

test('GET /api/health: сервер і база працюють', async () => {
  const r = await api('GET', '/api/health');
  assert.equal(r.status, 200); assert.equal(r.body.status, 'ok'); assert.equal(r.body.db, 'ok');
});

test('захисні заголовки відправляються з кожною відповіддю', async () => {
  const r = await api('GET', '/api/health');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('реєстрація: валідація повертає 400 і повідомлення по полях', async () => {
  const r = await api('POST', '/api/auth/register', { body: { name: 'Оксана', email: 'abc', password: 'abcdefgh' } });
  assert.equal(r.status, 400); assert.equal(r.body.error.code, 'VALIDATION');
  assert.match(r.body.error.fields.name, /два слова/);
  assert.match(r.body.error.fields.email, /^Неправильний формат пошти/);
  assert.match(r.body.error.fields.password, /цифру/);
});

test('реєстрація: успіх (201), пароль не повертається, дублікат пошти дає 409', async () => {
  const email = `dup_${Date.now()}@test.ua`;
  const ok = await api('POST', '/api/auth/register', { body: { name: 'Оксана Іванченко', email, password: 'abcd1234' } });
  assert.equal(ok.status, 201); assert.ok(ok.body.token);
  assert.ok(!JSON.stringify(ok.body).includes('password'));
  const dup = await api('POST', '/api/auth/register', { body: { name: 'Інша Людина', email: email.toUpperCase(), password: 'abcd1234' } });
  assert.equal(dup.status, 409); assert.equal(dup.body.error.code, 'EMAIL_TAKEN');
});

test('пароль у базі зберігається у вигляді хешу scrypt із сіллю', () => {
  const rows = db.prepare("SELECT password_hash FROM users WHERE is_demo = 0").all();
  assert.ok(rows.length > 0);
  rows.forEach((r) => { assert.match(r.password_hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/); assert.ok(!r.password_hash.includes('abcd1234')); });
});

test('вхід: правильні дані дають токен, неправильні - однакове повідомлення 401', async () => {
  const { email } = await newUser();
  const ok = await api('POST', '/api/auth/login', { body: { email, password: 'abcd1234' } });
  assert.equal(ok.status, 200); assert.ok(ok.body.token);
  const wrongPass = await api('POST', '/api/auth/login', { body: { email, password: 'wrong1234' } });
  const noUser = await api('POST', '/api/auth/login', { body: { email: 'nobody@test.ua', password: 'wrong1234' } });
  assert.equal(wrongPass.status, 401); assert.equal(noUser.status, 401);
  assert.equal(wrongPass.body.error.message, 'Неправильна пошта або пароль.');
  assert.equal(noUser.body.error.message, wrongPass.body.error.message);   // не розкриваємо, чи існує пошта
});

test('захищені маршрути без токена або з чужим токеном дають 401', async () => {
  for (const [m, p] of [['GET', '/api/auth/me'], ['GET', '/api/shelf'], ['GET', '/api/readers'], ['GET', '/api/notifications'], ['GET', '/api/me/summary'], ['PUT', '/api/shelf/dyuna']]) {
    const r = await api(m, p, m === 'PUT' ? { body: { status: 'read' } } : {});
    assert.equal(r.status, 401, `${m} ${p}`);
  }
  assert.equal((await api('GET', '/api/auth/me', { token: 'fake-token' })).status, 401);
});

test('вихід знищує сесію: токен перестає діяти', async () => {
  const { token } = await newUser();
  assert.equal((await api('GET', '/api/auth/me', { token })).status, 200);
  assert.equal((await api('POST', '/api/auth/logout', { token })).status, 204);
  assert.equal((await api('GET', '/api/auth/me', { token })).status, 401);
});

test('каталог: список, фільтр за жанром, пошук, сортування, 404', async () => {
  const all = await api('GET', '/api/books');
  assert.equal(all.status, 200); assert.equal(all.body.total, 9);
  const fantasy = await api('GET', '/api/books?genre=' + encodeURIComponent('Фентезі'));
  assert.deepEqual(fantasy.body.books.map((b) => b.slug), ['harry-potter']);
  const q = await api('GET', '/api/books?q=' + encodeURIComponent('ДЮН'));
  assert.deepEqual(q.body.books.map((b) => b.slug), ['dyuna']);
  const top = await api('GET', '/api/books?sort=rating');
  assert.equal(top.body.books[0].slug, 'harry-potter');
  assert.equal((await api('GET', '/api/books/no-such-book')).status, 404);
});

test('захист від SQL-ін’єкції: параметризовані запити', async () => {
  const r = await api('GET', '/api/books/' + encodeURIComponent("dyuna'; DROP TABLE books;--"));
  assert.equal(r.status, 404);
  assert.equal((await api('GET', '/api/books')).body.total, 9);
  const q = await api('GET', '/api/books?q=' + encodeURIComponent("' OR '1'='1"));
  assert.equal(q.body.total, 0);
});

test('полиця: CRUD (PUT створює 201, повторно змінює 200, DELETE 204) і валідація статусу', async () => {
  const { token } = await newUser();
  const created = await api('PUT', '/api/shelf/dyuna', { token, body: { status: 'want' } });
  assert.equal(created.status, 201); assert.equal(created.body.item.status, 'want');
  const updated = await api('PUT', '/api/shelf/dyuna', { token, body: { status: 'reading' } });
  assert.equal(updated.status, 200); assert.equal(updated.body.item.status, 'reading');
  const list = await api('GET', '/api/shelf', { token });
  assert.deepEqual(list.body.items.map((i) => [i.slug, i.status]), [['dyuna', 'reading']]);
  assert.equal((await api('PUT', '/api/shelf/dyuna', { token, body: { status: 'bad' } })).status, 400);
  assert.equal((await api('PUT', '/api/shelf/unknown', { token, body: { status: 'read' } })).status, 404);
  assert.equal((await api('DELETE', '/api/shelf/dyuna', { token })).status, 204);
  assert.equal((await api('DELETE', '/api/shelf/dyuna', { token })).status, 404);
});

test('оцінка: лише для прочитаної книги; середній рейтинг перераховується для всіх', async () => {
  const a = await newUser(), b = await newUser();
  const before = (await api('GET', '/api/books/dyuna')).body.book;
  assert.equal(before.votes, 128); assert.equal(before.rating, 4.5);
  const denied = await api('PUT', '/api/books/dyuna/rating', { token: a.token, body: { value: 5 } });
  assert.equal(denied.status, 409); assert.equal(denied.body.error.code, 'NOT_READ');
  await api('PUT', '/api/shelf/dyuna', { token: a.token, body: { status: 'read' } });
  await api('PUT', '/api/shelf/dyuna', { token: b.token, body: { status: 'read' } });
  assert.equal((await api('PUT', '/api/books/dyuna/rating', { token: a.token, body: { value: 6 } })).status, 400);
  const r1 = await api('PUT', '/api/books/dyuna/rating', { token: a.token, body: { value: 5 } });
  assert.equal(r1.status, 200); assert.equal(r1.body.book.votes, 129);
  const r2 = await api('PUT', '/api/books/dyuna/rating', { token: b.token, body: { value: 1 } });
  assert.equal(r2.body.book.votes, 130);
  assert.equal(r2.body.book.rating, Math.round(((4.5 * 128 + 5 + 1) / 130) * 10) / 10);
  const detail = await api('GET', '/api/books/dyuna', { token: a.token });
  assert.deepEqual(detail.body.me, { status: 'read', rating: 5 });
  // зміна статусу з «прочитано» прибирає оцінку
  await api('PUT', '/api/shelf/dyuna', { token: a.token, body: { status: 'want' } });
  assert.equal((await api('GET', '/api/books/dyuna')).body.book.votes, 129);
});

test('відгуки: CRUD, один відгук на книгу, редагувати й видаляти можна лише власні', async () => {
  const a = await newUser('Анна Перша'), b = await newUser('Борис Другий');
  assert.equal((await api('POST', '/api/books/sapiens/reviews', { body: { text: 'Дуже цікава книга!' } })).status, 401);
  assert.equal((await api('POST', '/api/books/sapiens/reviews', { token: a.token, body: { text: 'Круто' } })).status, 400);
  const made = await api('POST', '/api/books/sapiens/reviews', { token: a.token, body: { text: 'Дуже цікава книга!' } });
  assert.equal(made.status, 201); assert.equal(made.body.review.author, 'Анна Перша');
  const id = made.body.review.id;
  assert.equal((await api('POST', '/api/books/sapiens/reviews', { token: a.token, body: { text: 'Ще один відгук' } })).status, 409);
  const mine = await api('GET', '/api/books/sapiens', { token: a.token });
  assert.ok(mine.body.reviews.some((r) => r.id === id && r.mine === true));
  const others = await api('GET', '/api/books/sapiens', { token: b.token });
  assert.ok(others.body.reviews.some((r) => r.id === id && r.mine === false));
  assert.equal((await api('PUT', `/api/reviews/${id}`, { token: b.token, body: { text: 'Спроба змінити чужий' } })).status, 403);
  assert.equal((await api('DELETE', `/api/reviews/${id}`, { token: b.token })).status, 403);
  const upd = await api('PUT', `/api/reviews/${id}`, { token: a.token, body: { text: 'Оновлений відгук про книгу' } });
  assert.equal(upd.status, 200); assert.equal(upd.body.review.text, 'Оновлений відгук про книгу');
  assert.equal((await api('DELETE', `/api/reviews/${id}`, { token: a.token })).status, 204);
  assert.equal((await api('DELETE', `/api/reviews/${id}`, { token: a.token })).status, 404);
  assert.equal((await api('PUT', '/api/reviews/abc', { token: a.token, body: { text: 'Текст відгуку тут' } })).status, 404);
});

test('профіль: оновлення імені й опису, статистика', async () => {
  const { token } = await newUser();
  assert.equal((await api('PATCH', '/api/me', { token, body: { name: 'X' } })).status, 400);
  assert.equal((await api('PATCH', '/api/me', { token, body: { bio: 'я'.repeat(141) } })).status, 400);
  const ok = await api('PATCH', '/api/me', { token, body: { name: 'Оксана Петренко', bio: 'Люблю фантастику' } });
  assert.equal(ok.status, 200); assert.equal(ok.body.user.name, 'Оксана Петренко');
  assert.equal((await api('GET', '/api/auth/me', { token })).body.user.bio, 'Люблю фантастику');
  await api('PUT', '/api/shelf/dyuna', { token, body: { status: 'read' } });
  await api('PUT', '/api/books/dyuna/rating', { token, body: { value: 4 } });
  await api('POST', '/api/books/dyuna/reviews', { token, body: { text: 'Чудова книга, раджу' } });
  const s = (await api('GET', '/api/me/summary', { token })).body;
  assert.equal(s.books, 1); assert.equal(s.read, 1); assert.equal(s.reviews, 1);
  assert.equal(s.avgRating, 4); assert.equal(s.favoriteGenre, 'Фантастика'); assert.deepEqual(s.recentRead, ['dyuna']);
  assert.equal(s.followers, 1);   // демо-читач із привітання
});

test('читачі: список, підписка/відписка, стрічка активності, сповіщення для того, на кого підписались', async () => {
  const a = await newUser('Анна Перша'), b = await newUser('Борис Другий');
  const list = await api('GET', '/api/readers', { token: a.token });
  assert.equal(list.status, 200);
  const olena = list.body.readers.find((r) => r.name === 'Олена Коваль');
  assert.ok(olena && olena.following === false && olena.shelves.read.includes('dyuna'));
  assert.ok(!list.body.readers.some((r) => r.id === a.user.id));   // себе у списку немає
  assert.equal((await api('PUT', `/api/readers/${a.user.id}/follow`, { token: a.token })).status, 400);   // на себе не можна
  assert.equal((await api('PUT', '/api/readers/99999/follow', { token: a.token })).status, 404);
  assert.equal((await api('PUT', `/api/readers/${olena.id}/follow`, { token: a.token })).body.following, true);
  await api('PUT', `/api/readers/${olena.id}/follow`, { token: a.token });            // повторно: без дубліката
  assert.equal((await api('GET', `/api/readers/${olena.id}`, { token: a.token })).body.reader.following, true);
  const feed = await api('GET', '/api/feed', { token: a.token });
  assert.ok(feed.body.items.length > 0 && feed.body.items.every((i) => i.reader.id === olena.id));
  assert.equal((await api('GET', '/api/readers/following', { token: a.token })).body.readers.length, 1);
  // підписка на іншого реального користувача створює йому сповіщення
  await api('PUT', `/api/readers/${b.user.id}/follow`, { token: a.token });
  const notes = await api('GET', '/api/notifications', { token: b.token });
  assert.ok(notes.body.items.some((n) => n.text === 'Анна Перша підписався на вас'));
  assert.equal((await api('DELETE', `/api/readers/${olena.id}/follow`, { token: a.token })).body.following, false);
  assert.equal((await api('GET', '/api/feed', { token: a.token })).body.items.length, 0);
});

test('сповіщення: лічильник, позначення одного й усіх, чужі сповіщення недоступні', async () => {
  const a = await newUser(), b = await newUser();
  const list = await api('GET', '/api/notifications', { token: a.token });
  assert.equal(list.body.unread, 2); assert.equal(list.body.items.length, 2);
  assert.equal((await api('GET', '/api/notifications/unread-count', { token: a.token })).body.unread, 2);
  const id = list.body.items[0].id;
  assert.equal((await api('PATCH', `/api/notifications/${id}`, { token: b.token })).status, 404);   // чуже
  assert.equal((await api('PATCH', `/api/notifications/${id}`, { token: a.token })).body.unread, 1);
  assert.equal((await api('POST', '/api/notifications/read-all', { token: a.token })).body.unread, 0);
  assert.equal((await api('GET', '/api/notifications', { token: a.token })).body.items.every((n) => n.read), true);
});

test('помилки запитів: некоректний JSON (400), завеликий запит (413), невідомий маршрут (404)', async () => {
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ not json' });
  assert.equal(res.status, 400); assert.equal((await res.json()).error.code, 'BAD_JSON');
  const big = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'x', password: 'a'.repeat(20000) }) });
  assert.equal(big.status, 413);
  const nf = await api('GET', '/api/nothing-here');
  assert.equal(nf.status, 404); assert.equal(nf.body.error.code, 'NOT_FOUND');
});

test('обмеження частоти: після перевищення ліміту спроб входу відповідь 429', async () => {
  const config = { ...loadConfig({}), authRateLimit: { windowMs: 60000, max: 3 } };
  const d = openDatabase(':memory:'); migrate(d); seedIfEmpty(d);
  const s = createApp({ db: d, config }).listen(0);
  await new Promise((r) => s.once('listening', r));
  const url = `http://127.0.0.1:${s.address().port}/api/auth/login`;
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'a@b.ua', password: 'x' }) });
    codes.push(r.status);
  }
  s.close(); d.close();
  assert.deepEqual(codes, [401, 401, 401, 429, 429]);
});

test('клієнтські файли віддаються сервером, а службові файли недоступні', async () => {
  const index = await fetch(base + '/');
  assert.equal(index.status, 200); assert.match(await index.text(), /BookSpace/);
  assert.equal((await fetch(base + '/js/core.js')).status, 200);
  for (const p of ['/server/db.js', '/package.json', '/.env', '/data/bookspace.db', '/../package.json']) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
});
