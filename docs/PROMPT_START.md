# Початковий промпт (архітектура, REST API, модель даних)

Ти - досвідчений full-stack розробник. Допоможи розширити навчальний вебсайт BookSpace (соціальна мережа для книголюбів), який уже має клієнтську частину на HTML, CSS і JavaScript (лабораторні 1-4), серверною частиною та базою даних.

## Контекст і вимоги
- Користувачі реєструються й входять в акаунт, ведуть полицю книг зі статусами (хочу прочитати / читаю зараз / прочитано), ставлять оцінки прочитаним книгам, пишуть відгуки, підписуються на інших читачів, бачать стрічку їхньої активності та сповіщення.
- Інтерфейс українською, адаптивний, доступний (ARIA, клавіатура).

## Архітектура
- Клієнт: статичні сторінки (папка public/), JavaScript спілкується з сервером через fetch + async/await, без фреймворків.
- Сервер: Node.js + Express, REST API з префіксом /api, відповіді JSON, єдиний формат помилок { error: { code, message, fields } }.
- База даних: SQLite (вбудований node:sqlite), схема з зовнішніми ключами та обмеженнями CHECK.
- Сервер також віддає статичні файли клієнта (один домен, без CORS).
- Розгортання: Render (змінні середовища для секретів), healthcheck /api/health.

## Модель даних
users, sessions, books, shelf (user_id + book_slug, status), ratings (1-5), reviews (один відгук на книгу від користувача), follows, notifications.

## REST API (CRUD)
POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me;
PATCH /api/me, GET /api/me/summary;
GET /api/books, GET /api/books/:slug; PUT/DELETE /api/books/:slug/rating; POST /api/books/:slug/reviews; PUT/DELETE /api/reviews/:id;
GET /api/shelf, PUT/DELETE /api/shelf/:slug;
GET /api/readers, GET /api/readers/:id, PUT/DELETE /api/readers/:id/follow, GET /api/feed;
GET /api/notifications, PATCH /api/notifications/:id, POST /api/notifications/read-all.

## Безпека (обов'язково)
Хешування паролів (scrypt із сіллю), сесії з випадковими токенами (у БД лише HMAC-хеш), параметризовані SQL-запити, валідація всіх вхідних даних на сервері, перевірка прав власника (403), обмеження частоти запитів на вхід, обмеження розміру тіла запиту, захисні заголовки (CSP тощо), секрети лише в змінних середовища.

## Формат відповіді
1. Структура проєкту. 2. Код сервера по файлах. 3. Зміни в клієнтському коді. 4. Автотести API. 5. Інструкція запуску й розгортання.
Пояснюй ключові рішення. Не використовуй застарілі або небезпечні підходи.
