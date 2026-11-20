/* ===== BookSpace · catalog.js =====
   Каталог: пошук, фільтр за жанром, сортування. Рейтинги для сортування беруться з сервера (/api/books). */
(function () {
  "use strict";
  if (BS.stop || BS.page !== "catalog") return;
  var $ = BS.$, $$ = BS.$$;

  var q = $("#cq"), sortSelect = $("#sort"), grid = $(".grid"), items = $$(".grid > li");
  var genre = BS.param("genre");
  var original = items.map(function (li) { return li.dataset.slug; });
  var live = {};                         // актуальні рейтинги із сервера: { slug: рейтинг }
  q.value = BS.param("q");

  var rating = function (s) { return live[s] !== undefined ? live[s] : BOOKS[s].r; };
  var sorters = {
    title: function (a, b) { return BOOKS[a].t.localeCompare(BOOKS[b].t, "uk"); },
    author: function (a, b) { return BOOKS[a].a.localeCompare(BOOKS[b].a, "uk"); },
    rating: function (a, b) { return rating(b) - rating(a); }
  };
  function sortGrid() {
    var slugs = original.slice();
    if (sortSelect.value !== "default") slugs.sort(sorters[sortSelect.value]);
    slugs.forEach(function (s) { grid.appendChild(items.filter(function (li) { return li.dataset.slug === s; })[0]); });
  }

  function apply() {
    var s = q.value.trim().toLowerCase(), count = 0;
    items.forEach(function (li) {
      var b = BOOKS[li.dataset.slug];
      var ok = (!genre || b.g === genre) && (!s || (b.t + " " + b.a).toLowerCase().indexOf(s) > -1);
      li.hidden = !ok;
      if (ok) count++;
    });
    $$(".chip").forEach(function (c) {
      var on = c.dataset.genre === genre;
      c.classList.toggle("is-on", on);
      c.setAttribute("aria-pressed", on);
    });
    $("#count").textContent = count + " " + BS.pl(count, "результат", "результати", "результатів");
    $("#empty").hidden = count > 0;
    $("#reset").hidden = !genre && !s;
  }

  q.addEventListener("input", apply);
  sortSelect.addEventListener("change", sortGrid);
  $("form.searchbig").addEventListener("submit", function (e) { e.preventDefault(); });
  $$(".chip").forEach(function (c) {
    c.addEventListener("click", function () { genre = genre === c.dataset.genre ? "" : c.dataset.genre; apply(); });
  });
  $("#reset").addEventListener("click", function () { genre = ""; q.value = ""; apply(); q.focus(); });
  apply();

  // Підтягуємо актуальні рейтинги (якщо сервер недоступний, лишаються значення з data.js)
  BS.api.get("/api/books").then(function (d) {
    d.books.forEach(function (b) { live[b.slug] = b.rating; });
    if (sortSelect.value === "rating") sortGrid();
  }).catch(function () { /* некритично */ });
})();
