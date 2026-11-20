/* ===== BookSpace · core.js =====
   Спільне ядро: допоміжні функції, робота з localStorage, обкладинки, перевірка доступу.
   Усі інші скрипти користуються об'єктом BS, який створюється тут. */
var BS = {};

(function () {
  "use strict";

  /* ---------- скорочення для пошуку елементів ---------- */
  BS.$ = function (selector, root) { return (root || document).querySelector(selector); };
  BS.$$ = function (selector, root) { return [].slice.call((root || document).querySelectorAll(selector)); };

  /* ---------- допоміжні функції ---------- */
  // Правильна форма слова за числом: pl(2, "книга", "книги", "книг") -> "книги"
  BS.pl = function (n, one, few, many) {
    var m = n % 100, k = n % 10;
    return m > 10 && m < 15 ? many : k === 1 ? one : k > 1 && k < 5 ? few : many;
  };
  BS.initials = function (name) {
    return name.trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join("");
  };
  // Екранування тексту користувача перед вставкою в HTML (захист від XSS)
  BS.esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  };
  BS.fmt = function (x) { return x.toFixed(1).replace(".", ","); };
  BS.param = function (name) { return new URLSearchParams(location.search).get(name) || ""; };
  BS.safeNext = function (n) { return /^[\w\-]+\.html$/.test(n || "") ? n : "index.html"; };
  // Кличний відмінок імені: Оксана -> Оксано, Софія -> Софіє, Андрій -> Андрію
  BS.vocative = function (n) {
    if (/ія$/.test(n)) return n.slice(0, -1) + "є";
    if (/а$/.test(n)) return n.slice(0, -1) + "о";
    if (/я$/.test(n)) return n.slice(0, -1) + "ю";
    if (/ій$/.test(n)) return n.slice(0, -1) + "ю";
    return n;
  };

  /* ---------- сесія: токен і дані користувача зберігаються в браузері, решта даних - на сервері ---------- */
  function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* сховище недоступне */ } }
  BS.session = {
    token: function () { return lsGet("bs_token"); },
    user: function () { try { return JSON.parse(lsGet("bs_user")) || null; } catch (e) { return null; } },
    set: function (token, user) { lsSet("bs_token", token); lsSet("bs_user", JSON.stringify(user)); },
    clear: function () { try { localStorage.removeItem("bs_token"); localStorage.removeItem("bs_user"); } catch (e) {} }
  };

  /* Статуси книг: на сервері це коди, на екрані - українські підписи */
  BS.STATUS = { want: "Хочу прочитати", reading: "Читаю зараз", read: "Прочитано" };
  BS.statusCode = function (label) {
    return Object.keys(BS.STATUS).filter(function (k) { return BS.STATUS[k] === label; })[0];
  };

  // «1 год тому», «3 дн. тому» за часом у форматі ISO
  BS.timeAgo = function (isoString) {
    var min = Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 60000));
    if (min < 1) return "щойно";
    if (min < 60) return min + " хв тому";
    if (min < 1440) return Math.round(min / 60) + " год тому";
    return Math.round(min / 1440) + " дн. тому";
  };

  /* ---------- обкладинки: файл -> посилання з data.js -> Open Library -> заглушка ---------- */
  function nextCover(img) {
    var b = BOOKS[img.dataset.slug];
    if (!img.tries) {
      img.tries = [];
      if (b && b.url) img.tries.push(b.url);
      if (b && b.isbn) img.tries.push("https://covers.openlibrary.org/b/isbn/" + b.isbn + "-L.jpg?default=false");
    }
    var url = img.tries.shift();
    if (url) img.src = url; else img.style.visibility = "hidden";
  }
  document.addEventListener("error", function (e) {
    if (e.target.tagName === "IMG" && e.target.dataset.slug) nextCover(e.target);
  }, true);
  BS.fixCovers = function () {
    BS.$$("img[data-slug]").forEach(function (i) { if (i.complete && i.naturalWidth === 0) nextCover(i); });
  };
  BS.fixCovers();

  // HTML картки книги (однаковий для динамічно створених списків)
  BS.cardHTML = function (slug) {
    var b = BOOKS[slug];
    return '<a class="card" href="book-' + slug + '.html" style="--cover:' + b.c + '"><img class="card__img" src="images/covers/' + slug +
      '.jpg" data-slug="' + slug + '" alt="Обкладинка книги «' + BS.esc(b.t) + '»"><span class="card__tag">' + b.g +
      '</span><span class="card__text"><strong>' + BS.esc(b.t) + "</strong><span>" + BS.esc(b.a) + "</span></span></a>";
  };

  /* ---------- доступ до сторінок ---------- */
  BS.page = document.body.dataset.page;
  BS.me = BS.session.user();
  BS.stop = false; // true, якщо сторінка перенаправляє на вхід: інші скрипти тоді нічого не роблять
  if (document.body.dataset.auth === "required" && !BS.session.token()) {
    BS.stop = true;
    location.replace("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop()));
  }
})();
