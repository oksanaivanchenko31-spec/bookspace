'use strict';

/* Помилка з HTTP-статусом: перехоплюється спільним обробником і перетворюється на JSON. */
class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// Обгортка для асинхронних обробників: помилки потрапляють в next()
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, wrap };
