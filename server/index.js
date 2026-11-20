'use strict';
// Підтягуємо змінні з файлу .env (якщо він є; доступно в Node 20.12+/22+)
try { process.loadEnvFile(); } catch (e) { /* файлу .env немає: використовуються змінні середовища */ }

const { loadConfig } = require('./config');
const { openDatabase, migrate } = require('./db');
const { seedIfEmpty } = require('./seed');
const { createApp } = require('./app');

const config = loadConfig();
const db = openDatabase(config.dbPath);
migrate(db);
seedIfEmpty(db);

const server = createApp({ db, config }).listen(config.port, () => {
  console.log(`BookSpace запущено: http://localhost:${config.port}  (БД: ${config.dbPath})`);
});

// Коректне завершення (SIGTERM надсилає хостинг під час перезапуску)
['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => {
  server.close(() => { db.close(); process.exit(0); });
}));
