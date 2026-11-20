/* ===== BookSpace · profile.js =====
   Профіль: статистика й підписки з API, редагування профілю (PATCH /api/me) у модальному вікні. */
(function () {
  "use strict";
  if (BS.stop || BS.page !== "profile") return;
  var $ = BS.$, F = BS.form, R = F.rules;

  function fillHeader() {
    $("#p-name").textContent = BS.me.name;
    $("#p-ini").textContent = BS.initials(BS.me.name);
    $("#p-bio").textContent = BS.me.bio || "Розкажіть кілька слів про себе.";
  }

  async function load() {
    $("#recent").innerHTML = '<p class="loading">Завантаження…</p>';
    $("#following").innerHTML = '<p class="loading">Завантаження…</p>';
    try {
      var res = await Promise.all([BS.api.get("/api/me/summary"), BS.api.get("/api/readers/following")]);
      var s = res[0], following = res[1].readers;
      $("#f-books").textContent = s.books; $("#f-rev").textContent = s.reviews;
      $("#f-fers").textContent = s.followers; $("#f-fing").textContent = s.following;
      $("#s-read").textContent = s.read + " " + BS.pl(s.read, "книга", "книги", "книг");
      $("#s-avg").textContent = s.avgRating ? BS.fmt(s.avgRating) : "—";
      $("#s-genre").textContent = s.favoriteGenre || "—";
      $("#recent").innerHTML = s.recentRead.length
        ? '<ul class="grid">' + s.recentRead.map(function (slug) { return "<li>" + BS.cardHTML(slug) + "</li>"; }).join("") + "</ul>"
        : '<p class="empty">Ви ще не позначили жодної книги як прочитану. <a class="link" href="catalog.html">Перейти до каталогу</a></p>';
      $("#following").innerHTML = following.length
        ? '<ul class="readers">' + following.map(function (r) {
          return '<li class="reader-row"><span class="avatar" aria-hidden="true">' + BS.initials(r.name) + '</span><div class="reader-row__info"><a class="reader-row__name" href="reader.html?id=' +
            r.id + '">' + BS.esc(r.name) + "</a><p>" + BS.esc(r.bio) + "</p></div></li>";
        }).join("") + "</ul>"
        : '<p class="empty">Ви ще ні на кого не підписані. <a class="link" href="readers.html">Знайти читачів</a></p>';
      BS.fixCovers();
    } catch (err) {
      BS.showLoadError($("#recent"), err, load);
      $("#following").innerHTML = "";
    }
  }

  BS.ready.then(function () {
    fillHeader();
    load();

    /* Редагування профілю: форма в діалозі з перевіркою на клієнті й на сервері */
    $("#edit").addEventListener("click", function () {
      BS.dialog.open(
        '<h2 id="dialog-title">Редагувати профіль</h2><form id="edit-form" novalidate>' +
        '<div class="field"><label for="e-name">Ім’я та прізвище</label><input id="e-name" type="text" value="' + BS.esc(BS.me.name) + '" aria-describedby="e-name-err"><p class="field__error" id="e-name-err" role="alert" hidden></p></div>' +
        '<div class="field"><label for="e-bio">Про себе <span class="counter" id="e-count"></span></label><textarea id="e-bio" rows="3" aria-describedby="e-bio-err">' + BS.esc(BS.me.bio || "") + '</textarea><p class="field__error" id="e-bio-err" role="alert" hidden></p></div>' +
        '<div class="dialog__actions"><button class="btn btn--ghost" type="button" id="e-cancel">Скасувати</button><button class="btn" type="submit">Зберегти</button></div></form>',
        function () {
          var bio = $("#e-bio"), counter = $("#e-count");
          function count() { counter.textContent = bio.value.length + "/140"; }
          bio.addEventListener("input", count); count();
          $("#e-cancel").addEventListener("click", BS.dialog.close);
          F.attach($("#edit-form"), {
            "e-name": [R.required("Введіть ім’я та прізвище."), R.minLength(2, "Ім’я занадто коротке."), R.maxLength(60, "Ім’я не може бути довшим за 60 символів.")],
            "e-bio": [R.maxLength(140, "Опис не може бути довшим за 140 символів.")]
          }, async function () {
            var btn = $('#edit-form button[type="submit"]');
            BS.busy(btn, true);
            try {
              var res = await BS.api.patch("/api/me", { name: $("#e-name").value.trim(), bio: bio.value.trim() });
              BS.me = res.user; BS.session.set(BS.session.token(), res.user);
              fillHeader();
              if ($("#user-btn")) $("#user-btn").textContent = BS.initials(BS.me.name);
              BS.dialog.close(); BS.toast("Профіль оновлено");
            } catch (err) {
              BS.busy(btn, false);
              if (!(err.fields && F.serverErrors($("#edit-form"), err.fields, { name: "e-name", bio: "e-bio" }))) BS.handleError(err);
            }
          });
        });
    });
    $("#logout").addEventListener("click", async function () {
      try { await BS.api.post("/api/auth/logout"); } catch (e) { /* ігноруємо */ }
      BS.session.clear(); location.href = "login.html";
    });
  });
})();
