/* ===== BookSpace · book.js =====
   Сторінка книги: дані, відгуки та стан користувача з API; полиця, оцінка, відгуки (CRUD). */
(function () {
  "use strict";
  if (BS.stop || BS.page !== "book") return;
  var $ = BS.$, $$ = BS.$$, F = BS.form, R = F.rules;
  var slug = document.body.dataset.slug, bookInfo = BOOKS[slug];
  var state = { book: null, reviews: [], me: null };
  var loggedIn = !!BS.session.token();
  var editingId = null;                               // id відгуку, який зараз редагується
  var toLogin = function () { location.href = "login.html?next=book-" + slug + ".html"; };

  function reviewHTML(r) {
    return '<article class="review' + (r.mine ? " review--mine" : "") + '"><header><span class="avatar">' + BS.initials(r.author) + "</span><strong>" + BS.esc(r.author) +
      '</strong> <time datetime="' + r.updatedAt + '">' + BS.timeAgo(r.updatedAt) + "</time></header><p>" + BS.esc(r.text).replace(/\n/g, "<br>") + "</p>" +
      (r.mine ? '<div class="review__actions"><button class="link" type="button" data-edit="' + r.id + '">Редагувати</button> <button class="link" type="button" data-del="' + r.id + '">Видалити</button></div>' : "") + "</article>";
  }

  /* Перемальовує сторінку за станом state */
  function render() {
    var b = state.book, me = state.me;
    var isRead = !!me && me.status === "read", my = isRead ? me.rating || 0 : 0;
    $("#avg").textContent = BS.fmt(b.rating);
    $("#cnt").textContent = b.votes + " " + BS.pl(b.votes, "оцінка", "оцінки", "оцінок");
    if (me && me.status) $("#st").value = BS.STATUS[me.status];
    $("#add").textContent = me && me.status ? "Змінити статус" : "Додати до полиці";
    $("#remove").hidden = !(me && me.status);
    $$("#stars-in button").forEach(function (btn) { btn.disabled = !isRead; btn.classList.toggle("on", +btn.dataset.v <= my); });
    $("#rate-hint").textContent = !loggedIn ? "Увійдіть, щоб оцінити книгу."
      : isRead ? (my ? "Ваша оцінка: " + my + " з 5. Натисніть іншу зірку, щоб змінити." : "Оберіть оцінку від 1 до 5.")
        : "Оцінити можна лише книгу зі статусом «Прочитано».";
    var mine = state.reviews.filter(function (r) { return r.mine; })[0];
    $("#reviews-list").innerHTML = state.reviews.length ? state.reviews.map(reviewHTML).join("") : '<p class="empty">Поки що немає відгуків. Станьте першим!</p>';
    $("#rv-btn").textContent = editingId || mine ? "Зберегти зміни" : "Опублікувати відгук";
  }

  async function load() {
    $("#reviews-list").innerHTML = '<p class="loading">Завантаження відгуків…</p>';
    try {
      var d = await BS.api.get("/api/books/" + encodeURIComponent(slug));
      state = { book: d.book, reviews: d.reviews, me: d.me };
      render();
    } catch (err) { BS.showLoadError($("#reviews-list"), err, load); }
  }

  BS.ready.then(function () {
    load();

    /* Статус на полиці: PUT /api/shelf/:slug */
    $("#shelf-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!loggedIn) return toLogin();
      var btn = $("#add"), was = state.me && state.me.status;
      BS.busy(btn, true);
      try {
        var res = await BS.api.put("/api/shelf/" + encodeURIComponent(slug), { status: BS.statusCode($("#st").value) });
        BS.toast((was ? "Статус змінено: «" : "Книгу додано до полиці: «") + BS.STATUS[res.item.status] + "»");
        await load();
      } catch (err) { BS.handleError(err); }
      BS.busy(btn, false);
    });
    $("#remove").addEventListener("click", async function () {
      var ok = await BS.confirm("Видалити книгу з полиці?", "«" + bookInfo.t + "» буде видалено з вашої полиці.", "Видалити");
      if (!ok) return;
      try { await BS.api.del("/api/shelf/" + encodeURIComponent(slug)); BS.toast("Книгу видалено з полиці"); await load(); }
      catch (err) { BS.handleError(err); }
    });

    /* Оцінка зірками: PUT /api/books/:slug/rating */
    $("#stars-in").addEventListener("click", async function (e) {
      var v = e.target.dataset.v; if (!v) return;
      if (!loggedIn) return toLogin();
      try {
        var res = await BS.api.put("/api/books/" + encodeURIComponent(slug) + "/rating", { value: +v });
        state.book = res.book; state.me.rating = res.rating;
        BS.toast("Дякуємо за оцінку: " + v + " з 5"); render();
      } catch (err) { BS.handleError(err); }
    });

    /* Відгук: створення (POST) або зміна (PUT), перевірка на клієнті й на сервері */
    var area = $("#rv"), counter = $("#rv-count");
    function count() { counter.textContent = area.value.length + "/1000"; }
    area.addEventListener("input", count); count();
    F.attach($("#rf"), {
      rv: [R.required("Відгук не може бути порожнім."), R.minLength(10, "Відгук занадто короткий: напишіть щонайменше 10 символів.")]
    }, async function () {
      if (!loggedIn) return toLogin();
      var btn = $("#rv-btn"), mine = state.reviews.filter(function (r) { return r.mine; })[0];
      BS.busy(btn, true);
      try {
        if (editingId || mine) await BS.api.put("/api/reviews/" + (editingId || mine.id), { text: area.value.trim() });
        else await BS.api.post("/api/books/" + encodeURIComponent(slug) + "/reviews", { text: area.value.trim() });
        BS.toast(editingId || mine ? "Відгук оновлено" : "Відгук опубліковано");
        area.value = ""; count(); editingId = null;
        await load();
      } catch (err) {
        if (!(err.fields && F.serverErrors($("#rf"), err.fields, { text: "rv" }))) BS.handleError(err);
      }
      BS.busy(btn, false);
    });

    /* Редагування й видалення власного відгуку (делегування подій) */
    $("#reviews-list").addEventListener("click", async function (e) {
      var editId = e.target.dataset.edit, delId = e.target.dataset.del;
      if (editId) {
        var r = state.reviews.filter(function (x) { return String(x.id) === editId; })[0];
        editingId = r.id; area.value = r.text; count(); area.focus(); render();
      }
      if (delId) {
        var ok = await BS.confirm("Видалити відгук?", "Цю дію не можна скасувати.", "Видалити");
        if (!ok) return;
        try { await BS.api.del("/api/reviews/" + delId); BS.toast("Відгук видалено"); editingId = null; await load(); }
        catch (err) { BS.handleError(err); }
      }
    });
  });
})();
