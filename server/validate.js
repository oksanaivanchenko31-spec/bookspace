'use strict';
/* Перевірка вхідних даних на сервері (дублює клієнтські правила: клієнту довіряти не можна). */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME = /^[A-Za-zА-Яа-яІіЇїЄєҐґ'’\- ]+$/;
const LETTER = /[A-Za-zА-Яа-яІіЇїЄєҐґ]/;
const STATUSES = ['want', 'reading', 'read'];

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const result = (values, fields) => (Object.keys(fields).length ? { fields } : { values });

function checkName(name, fields) {
  if (!name) fields.name = 'Введіть ім’я та прізвище.';
  else if (name.length < 2) fields.name = 'Ім’я занадто коротке.';
  else if (name.length > 60) fields.name = 'Ім’я не може бути довшим за 60 символів.';
  else if (!NAME.test(name)) fields.name = 'Ім’я може містити лише літери, пробіл, дефіс і апостроф.';
  else if (name.split(/\s+/).length < 2) fields.name = 'Вкажіть ім’я та прізвище (два слова).';
}

function register(body) {
  const b = body || {};
  const fields = {};
  const name = str(b.name), email = str(b.email).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  checkName(name, fields);
  if (!email) fields.email = 'Введіть електронну пошту.';
  else if (email.length > 254 || !EMAIL.test(email)) fields.email = 'Неправильний формат пошти. Приклад: name@example.com';
  if (!password) fields.password = 'Придумайте пароль.';
  else if (password.length < 8) fields.password = 'Пароль має містити щонайменше 8 символів.';
  else if (password.length > 128) fields.password = 'Пароль занадто довгий (до 128 символів).';
  else if (!LETTER.test(password)) fields.password = 'Додайте до пароля хоча б одну літеру.';
  else if (!/\d/.test(password)) fields.password = 'Додайте до пароля хоча б одну цифру.';
  return result({ name, email, password }, fields);
}

function login(body) {
  const b = body || {};
  const fields = {};
  const email = str(b.email).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  if (!email) fields.email = 'Введіть електронну пошту.';
  else if (!EMAIL.test(email)) fields.email = 'Неправильний формат пошти. Приклад: name@example.com';
  if (!password) fields.password = 'Введіть пароль.';
  return result({ email, password }, fields);
}

// PATCH /api/me: змінювати можна ім'я та/або опис
function profile(body) {
  const b = body || {};
  const fields = {}, values = {};
  if ('name' in b) { values.name = str(b.name); checkName(values.name, fields); }
  if ('bio' in b) {
    values.bio = str(b.bio);
    if (values.bio.length > 140) fields.bio = 'Опис не може бути довшим за 140 символів.';
  }
  if (!Object.keys(values).length) fields.name = 'Немає даних для оновлення.';
  return result(values, fields);
}

function review(body) {
  const text = str((body || {}).text);
  const fields = {};
  if (!text) fields.text = 'Відгук не може бути порожнім.';
  else if (text.length < 10) fields.text = 'Відгук занадто короткий: напишіть щонайменше 10 символів.';
  else if (text.length > 1000) fields.text = 'Відгук не може бути довшим за 1000 символів.';
  return result({ text }, fields);
}

function shelfStatus(body) {
  const status = (body || {}).status;
  return STATUSES.includes(status) ? { values: { status } }
    : { fields: { status: 'Статус має бути одним із: want, reading, read.' } };
}

function ratingValue(body) {
  const value = (body || {}).value;
  return Number.isInteger(value) && value >= 1 && value <= 5 ? { values: { value } }
    : { fields: { value: 'Оцінка має бути цілим числом від 1 до 5.' } };
}

module.exports = { register, login, profile, review, shelfStatus, ratingValue, STATUSES };
