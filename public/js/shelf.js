/* ===== BookSpace · shelf.js =====
   Моя полиця: дані з API; зміна статусу (PUT) і видалення (DELETE) із підтвердженням. */
(function () {
  "use strict";
  if (BS.stop || BS.page !== "shelf") return;
  var $ = BS.$;
  var PANEL = { want: "p1", reading: "p2", read: "p3" };
  var items = [];                       // [{ slug, status, addedAt }]

  function render() {
    var groups = { p1: [], p2: [], p3: [] };
    items.forEach(function (it) { groups[PANEL[it.status]].push(it.slug); });
    ["p1", "p2", "p3"].forEach(function (p, i) {
      $("#n" + (i + 1)).textContent = groups[p].length;
      $("#" + p).innerHTML = groups[p].length ? '<ul class="grid">' + groups[p].map(function (s) {
        var cur = items.filter(function (x) { return x.slug === s; })[0].status;
        return '<li class="shelf-item">' + BS.cardHTML(s) + '<div class="shelf-actions"><label class="sr" for="m-' + s + '">Статус</label>' +
          '<select id="m-' + s + '" data-move="' + s + '">' + Object.keys(BS.STATUS).map(function (code) {
            return '<option value="' + code + '"' + (code === cur ? " selected" : "") + ">" + BS.STATUS[code] + "</option>";
          }).join("") + '</select><button class="link" type="button" data-remove="' + s + '">Видалити</button></div></li>';
      }).join("") + "</ul>" : '<p class="empty">Тут поки порожньо. <a class="link" href="catalog.html">Знайти книгу</a></p>';
    });
    var total = items.length;
    $("#shelf-sub").textContent = total + " " + BS.pl(total, "книга", "книги", "книг") + " · " + groups.p3.length + " прочитано";
    BS.fixCovers();
  }

  async function load() {
    ["p1", "p2", "p3"].forEach(function (p) { $("#" + p).innerHTML = '<p class="loading">Завантаження…</p>'; });
    try { items = (await BS.api.get("/api/shelf")).items; render(); }
    catch (err) { ["p1", "p2", "p3"].forEach(function (p) { BS.showLoadError($("#" + p), err, load); }); }
  }

  BS.ready.then(function () {
    BS.tabs($(".tabs--shelf"));
    load();

    /* Делегування подій: один обробник на всю полицю */
    $(".shelf").addEventListener("click", async function (e) {
      var slug = e.target.dataset.remove;
      if (!slug) return;
      var ok = await BS.confirm("Видалити книгу з полиці?", "«" + BOOKS[slug].t + "» буде видалено з вашої полиці.", "Видалити");
      if (!ok) return;
      try {
        await BS.api.del("/api/shelf/" + encodeURIComponent(slug));
        items = items.filter(function (x) { return x.slug !== slug; });
        render(); BS.toast("Книгу видалено з полиці");
      } catch (err) { BS.handleError(err); }
    });
    $(".shelf").addEventListener("change", async function (e) {
      var slug = e.target.dataset.move;
      if (!slug) return;
      try {
        var res = await BS.api.put("/api/shelf/" + encodeURIComponent(slug), { status: e.target.value });
        items.forEach(function (x) { if (x.slug === slug) x.status = res.item.status; });
        render(); BS.toast("Статус змінено: «" + BS.STATUS[res.item.status] + "»");
      } catch (err) { BS.handleError(err); render(); }
    });
  });
})();
