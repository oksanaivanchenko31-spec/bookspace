'use strict';
/* Просте вимірювання швидкодії API. Запуск: сервер має працювати (npm start), далі в іншому терміналі:
   npm run bench            (локально)   або   BASE=https://ваш-сайт.onrender.com npm run bench */
const BASE = process.env.BASE || 'http://localhost:3000';
const N = Number(process.env.N) || 200;

async function measure(name, path, opts = {}) {
  const times = [];
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    const res = await fetch(BASE + path, opts);
    await res.arrayBuffer();
    times.push(performance.now() - t0);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  }
  times.sort((a, b) => a - b);
  const pct = (p) => times[Math.min(N - 1, Math.floor((p / 100) * N))].toFixed(1);
  console.log(`${name.padEnd(28)} p50=${pct(50)} мс  p95=${pct(95)} мс  max=${times[N - 1].toFixed(1)} мс  (${N} запитів)`);
}

(async () => {
  await measure('GET /api/health', '/api/health');
  await measure('GET /api/books', '/api/books');
  await measure('GET /api/books/dyuna', '/api/books/dyuna');
  await measure('GET /index.html (статика)', '/index.html');
  await measure('GET /css/style.css', '/css/style.css');
})().catch((e) => { console.error('Помилка:', e.message); process.exit(1); });
