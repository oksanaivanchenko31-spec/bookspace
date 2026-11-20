/* ===== BookSpace · home.js =====
   Головна: привітання за часом доби, кількість книг і стрічка активності підписок (з API). */
(function () {
  "use strict";
  if (BS.stop || BS.page !== "home") return;
  var $ = BS.$;

  BS.ready.then(async function () {
    var h = new Date().getHours();
    var hi = h < 6 ? "Доброї ночі" : h < 12 ? "Доброго ранку" : h < 18 ? "Доброго дня" : "Добрий вечір";
    $("#greet").textContent = hi + ", " + BS.vocative(BS.me.name.split(/\s+/)[0]);
    $("#feed").innerHTML = '<p class="loading">Завантаження…</p>';

    async function load() {
      try {
        var res = await Promise.all([BS.api.get("/api/shelf"), BS.api.get("/api/feed")]);
        var n = res[0].items.length;
        $("#shelf-line").textContent = n
          ? "У вашій полиці " + n + " " + BS.pl(n, "книга", "книги", "книг") + ". Час обрати наступну історію."
          : "Ваша полиця поки порожня. Знайдіть першу книгу.";
        var feed = res[1].items;
        $("#feed").innerHTML = feed.length ? '<ul class="notes feed">' + feed.map(function (f) {
          var verb = f.status === "read" ? (f.reader.gender === "f" ? "прочитала" : "прочитав") : "читає";
          var b = BOOKS[f.slug];
          return '<li class="note"><span class="avatar">' + BS.initials(f.reader.name) + '</span><div><p><a class="link" href="reader.html?id=' + f.reader.id + '">' +
            BS.esc(f.reader.name) + "</a> " + verb + ' «<a class="link" href="book-' + f.slug + '.html">' + BS.esc(b ? b.t : f.slug) + "</a>»</p></div></li>";
        }).join("") + "</ul>" : '<p class="empty">Підпишіться на читачів, щоб бачити, що вони читають. <a class="link" href="readers.html">Знайти читачів</a></p>';
      } catch (err) { BS.showLoadError($("#feed"), err, load); }
    }
    load();
  });
})();
