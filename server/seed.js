'use strict';
const seed = require('./seed-data.json');
const { transaction } = require('./db');

const DEMO_REVIEWS = {
  'olena:dyuna': 'Світ, у який хочеться повертатися. Раджу всім, хто любить історії з характером.',
  'andrii:orient-express': 'Класичний детектив із несподіваною розв’язкою: читається на одному диханні.',
  'sofiia:tyhrolovy': 'Динамічний роман про свободу й волю до життя, який не відпускає до останньої сторінки.',
  'maksym:sapiens': 'Книга змушує по-новому поглянути на історію людства та на сучасність.',
  'iryna:misto-divchat': 'Легка образна проза: чудовий вибір для вечора з чашкою чаю.',
};

/* Початкові дані: каталог книг і п'ять демонстраційних читачів (увійти під ними не можна). */
function seedIfEmpty(db) {
  transaction(db, () => {
    if (!db.prepare('SELECT COUNT(*) AS c FROM books').get().c) {
      const ins = db.prepare(`INSERT INTO books (slug, title, author, genre, isbn, color, cover_url, description, base_rating, base_votes)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      seed.books.forEach((b) => ins.run(b.slug, b.title, b.author, b.genre, b.isbn, b.color, b.cover_url, b.description, b.base_rating, b.base_votes));
    }
    if (!db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_demo = 1').get().c) {
      const insUser = db.prepare("INSERT INTO users (name, email, password_hash, bio, gender, is_demo) VALUES (?, ?, 'disabled$demo', ?, ?, 1)");
      const insShelf = db.prepare("INSERT INTO shelf (user_id, book_slug, status, added_at) VALUES (?, ?, ?, datetime('now', ?))");
      const insReview = db.prepare("INSERT INTO reviews (user_id, book_slug, text, created_at, updated_at) VALUES (?, ?, ?, datetime('now', ?), datetime('now', ?))");
      seed.demoReaders.forEach((r, ri) => {
        const id = Number(insUser.run(r.name, r.email, r.bio, r.gender).lastInsertRowid);
        let hours = 2 + ri;                                   // різні моменти часу для стрічки активності
        [['read', r.read], ['reading', r.reading], ['want', r.want]].forEach(([status, list]) => {
          list.forEach((slug) => { insShelf.run(id, slug, status, `-${hours} hours`); hours += 5; });
        });
        r.read.forEach((slug) => {
          const text = DEMO_REVIEWS[`${r.key}:${slug}`];
          if (text) insReview.run(id, slug, text, `-${ri + 1} days`, `-${ri + 1} days`);
        });
      });
    }
  });
}

module.exports = { seedIfEmpty };
