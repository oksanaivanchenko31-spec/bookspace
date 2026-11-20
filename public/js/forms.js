/* ===== BookSpace · forms.js =====
   Клієнтська валідація форм: правила, показ помилок, підключення до форми. */
(function () {
  "use strict";
  if (BS.stop) return;
  var F = BS.form = {};

  /* Показати / прибрати повідомлення про помилку біля поля.
     Текст виводиться в елемент з id "<id поля>-err" (він має role="alert"). */
  F.setError = function (input, message) {
    var box = document.getElementById(input.id + "-err");
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    if (box) { box.textContent = message; box.hidden = false; }
  };
  F.clearError = function (input) {
    var box = document.getElementById(input.id + "-err");
    input.classList.remove("is-invalid");
    input.removeAttribute("aria-invalid");
    if (box) { box.textContent = ""; box.hidden = true; }
  };

  /* Правила: кожне повертає функцію (значення, форма) -> текст помилки або "" */
  F.rules = {
    required: function (msg) { return function (v) { return v.trim() ? "" : msg; }; },
    minLength: function (n, msg) { return function (v) { return v.trim().length >= n ? "" : msg; }; },
    maxLength: function (n, msg) { return function (v) { return v.trim().length <= n ? "" : msg; }; },
    pattern: function (re, msg) { return function (v) { return re.test(v) ? "" : msg; }; },
    match: function (otherId, msg) {
      return function (v, form) { return v === form.querySelector("#" + otherId).value ? "" : msg; };
    },
    custom: function (fn, msg) { return function (v) { return fn(v) ? "" : msg; }; }
  };

  // Перевіряє одне поле: зупиняється на першому порушеному правилі
  F.check = function (input, rules, form) {
    for (var i = 0; i < rules.length; i++) {
      var message = rules[i](input.value, form);
      if (message) { F.setError(input, message); return false; }
    }
    F.clearError(input);
    return true;
  };

  /* Підключає валідацію до форми. schema = { idПоля: [правила] }.
     Поле перевіряється після виходу з нього й далі під час введення;
     під час відправки перевіряються всі поля, фокус ставиться на першому з помилкою. */
  F.attach = function (form, schema, onValid) {
    var touched = {};
    Object.keys(schema).forEach(function (id) {
      var input = form.querySelector("#" + id);
      input.addEventListener("blur", function () { touched[id] = true; F.check(input, schema[id], form); });
      input.addEventListener("input", function () { if (touched[id]) F.check(input, schema[id], form); });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var first = null;
      Object.keys(schema).forEach(function (id) {
        var input = form.querySelector("#" + id);
        touched[id] = true;
        if (!F.check(input, schema[id], form) && !first) first = input;
      });
      if (first) first.focus(); else onValid();
    });
  };
  /* Показує помилки, які повернув сервер ({ поле: "повідомлення" }), біля відповідних полів.
     map - відповідність "поле сервера" -> "id поля у формі" (якщо вони різні). Повертає true, якщо хоч одне поле знайдено. */
  F.serverErrors = function (form, fields, map) {
    var first = null;
    Object.keys(fields || {}).forEach(function (name) {
      var input = form.querySelector("#" + ((map && map[name]) || name));
      if (input) { F.setError(input, fields[name]); if (!first) first = input; }
    });
    if (first) first.focus();
    return !!first;
  };
})();
