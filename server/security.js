'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

/* ---------- паролі: scrypt + унікальна сіль ---------- */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;   // напр. заблокований демо-акаунт
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);               // порівняння без витоку часу
}

// Хеш-пустушка: щоб вхід із неіснуючою поштою тривав стільки ж, скільки з існуючою
const DUMMY_HASH = (() => {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${crypto.scryptSync('dummy', salt, 64).toString('hex')}`;
})();

/* ---------- токени сесій ----------
   Клієнту видається випадковий токен, а в базі зберігається лише його HMAC із секретом (pepper). */
function newToken() { return crypto.randomBytes(32).toString('base64url'); }
function tokenHash(token, pepper) {
  return crypto.createHmac('sha256', pepper).update(token).digest('hex');
}

module.exports = { hashPassword, verifyPassword, DUMMY_HASH, newToken, tokenHash };
