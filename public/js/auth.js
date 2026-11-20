/* ===== BookSpace · auth.js =====
   Вхід і реєстрація через API: перевірка на клієнті (швидкий відгук) + перевірка на сервері (надійність). */
(function () {
  "use strict";
  if (BS.stop || (BS.page !== "login" && BS.page !== "register")) return;
  if (BS.session.token()) { location.replace("index.html"); return; }

  var $ = BS.$, F = BS.form, R = F.rules;
  var form = $("form");
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var NAME = /^[A-Za-zА-Яа-яІіЇїЄєҐґ'’\- ]+$/;
  var LETTER = /[A-Za-zА-Яа-яІіЇїЄєҐґ]/;

  function formError(message) { var e = $("#err"); e.textContent = message; e.hidden = false; }
  form.addEventListener("input", function () { $("#err").hidden = true; });

  /* Кнопка «Показати / Сховати пароль» */
  BS.$$("[data-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.dataset.toggle);
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Сховати" : "Показати";
      btn.setAttribute("aria-label", show ? "Сховати пароль" : "Показати пароль");
    });
  });

  /* Відправляє запит на сервер і обробляє результат */
  async function submit(path, payload) {
    var btn = $('button[type="submit"]', form);
    BS.busy(btn, true);
    try {
      var data = await BS.api.post(path, payload);
      BS.session.set(data.token, data.user);
      location.href = BS.safeNext(BS.param("next"));
    } catch (err) {
      BS.busy(btn, false);
      // помилки по полях (400/409) показуємо біля полів, решту - над кнопкою
      if (!(err.fields && F.serverErrors(form, err.fields))) formError(err.message);
    }
  }

  var emailRules = [
    R.required("Введіть електронну пошту."),
    R.pattern(EMAIL, "Неправильний формат пошти. Приклад: name@example.com")
  ];

  if (BS.page === "login") {
    F.attach(form, { email: emailRules, password: [R.required("Введіть пароль.")] }, function () {
      submit("/api/auth/login", { email: $("#email").value.trim(), password: $("#password").value });
    });
    return;
  }

  /* ---------- реєстрація ---------- */
  var schema = {
    name: [
      R.required("Введіть ім’я та прізвище."),
      R.minLength(2, "Ім’я занадто коротке."),
      R.pattern(NAME, "Ім’я може містити лише літери, пробіл, дефіс і апостроф."),
      R.custom(function (v) { return v.trim().split(/\s+/).length >= 2; }, "Вкажіть ім’я та прізвище (два слова).")
    ],
    email: emailRules,
    password: [
      R.required("Придумайте пароль."),
      R.minLength(8, "Пароль має містити щонайменше 8 символів."),
      R.pattern(LETTER, "Додайте до пароля хоча б одну літеру."),
      R.pattern(/\d/, "Додайте до пароля хоча б одну цифру.")
    ],
    password2: [R.required("Повторіть пароль."), R.match("password", "Паролі не збігаються.")]
  };

  /* Індикатор надійності пароля */
  var meter = $("#strength"), labels = ["", "Слабкий", "Середній", "Добрий", "Надійний"];
  $("#password").addEventListener("input", function () {
    var p = this.value, score = 0;
    if (p.length >= 8) score++;
    if (/[a-zа-яіїєґ]/.test(p) && /[A-ZА-ЯІЇЄҐ]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^\w\sА-Яа-яІіЇїЄєҐґ]/.test(p) || p.length >= 12) score++;
    if (!p) score = 0;
    meter.dataset.level = score;
    $(".strength__text", meter).textContent = score ? "Надійність пароля: " + labels[score] : "";
    if ($("#password2").value) F.check($("#password2"), schema.password2, form);
  });

  F.attach(form, schema, function () {
    submit("/api/auth/register", { name: $("#name").value.trim(), email: $("#email").value.trim(), password: $("#password").value });
  });
})();
