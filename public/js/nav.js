/* ===== BookSpace · nav.js =====
   Інтерактивна навігація: меню користувача, пошук із підказками, гарячі клавіші,
   лічильник сповіщень, тінь шапки під час прокручування. */
(function () {
  "use strict";
  if (BS.stop) return;
  var $ = BS.$, $$ = BS.$$;
  var header = $(".header");
  if (!header) return;   // сторінки входу й реєстрації без шапки

  /* ---------- 1. Меню користувача (випадний список) ---------- */
  var slot = $("#auth");
  if (slot && BS.me) {
    var wrap = document.createElement("div");
    wrap.className = "usermenu";
    wrap.innerHTML =
      '<button class="avatar" type="button" id="user-btn" aria-haspopup="true" aria-expanded="false" aria-controls="user-list" aria-label="Меню користувача">' + BS.initials(BS.me.name) + "</button>" +
      '<ul class="usermenu__list" id="user-list" hidden>' +
      '<li><a href="profile.html">Мій профіль</a></li><li><a href="shelf.html">Моя полиця</a></li>' +
      '<li><button type="button" id="logout-btn">Вийти</button></li></ul>';
    slot.replaceWith(wrap);
    var btn = $("#user-btn"), list = $("#user-list");
    var toggleMenu = function (open) { list.hidden = !open; btn.setAttribute("aria-expanded", open); };
    btn.addEventListener("click", function () { toggleMenu(list.hidden); });
    $("#logout-btn").addEventListener("click", async function () {
      try { await BS.api.post("/api/auth/logout"); } catch (e) { /* токен міг уже прострочитись */ }
      BS.session.clear(); location.href = "login.html";
    });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) toggleMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") toggleMenu(false); });
  }

  /* ---------- 2. Лічильник непрочитаних сповіщень у меню ---------- */
  // count - відома кількість непрочитаних; без аргумента береться з сервера
  BS.refreshBadge = async function (count) {
    $$(".nav-badge").forEach(function (b) { b.remove(); });
    if (!BS.session.token()) return;
    if (count === undefined) {
      try { count = (await BS.api.get("/api/notifications/unread-count")).unread; } catch (e) { return; }
    }
    if (!count) return;
    $$('.nav a[href="notifications.html"], .tabbar a[href="notifications.html"]').forEach(function (a) {
      var b = document.createElement("span");
      b.className = "nav-badge"; b.textContent = count;
      b.setAttribute("aria-label", "непрочитаних: " + count);
      a.appendChild(b);
    });
  };
  BS.refreshBadge();

  /* ---------- 3. Пошук із підказками ---------- */
  var form = $(".search"), input = $("#q"), suggest = $("#suggest"), items = [], active = -1;
  function closeSuggest() { suggest.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; }
  function renderSuggest() {
    var s = input.value.trim().toLowerCase();
    if (!s) return closeSuggest();
    items = Object.keys(BOOKS).filter(function (k) {
      return (BOOKS[k].t + " " + BOOKS[k].a).toLowerCase().indexOf(s) > -1;
    }).slice(0, 5);
    suggest.innerHTML = items.length ? items.map(function (k, i) {
      return '<li role="option" id="sg-' + i + '" data-slug="' + k + '"><strong>' + BS.esc(BOOKS[k].t) + "</strong><span>" + BS.esc(BOOKS[k].a) + "</span></li>";
    }).join("") : '<li class="suggest__empty">Нічого не знайдено</li>';
    suggest.hidden = false; input.setAttribute("aria-expanded", "true"); active = -1;
  }
  function markActive() {
    $$('[role="option"]', suggest).forEach(function (li, i) { li.classList.toggle("is-active", i === active); });
    if (active >= 0) input.setAttribute("aria-activedescendant", "sg-" + active); else input.removeAttribute("aria-activedescendant");
  }
  input.addEventListener("input", renderSuggest);
  input.addEventListener("keydown", function (e) {
    if (suggest.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, items.length - 1); markActive(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); markActive(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); location.href = "book-" + items[active] + ".html"; }
    else if (e.key === "Escape") closeSuggest();
  });
  suggest.addEventListener("mousedown", function (e) {
    var li = e.target.closest("[data-slug]");
    if (li) location.href = "book-" + li.dataset.slug + ".html";
  });
  document.addEventListener("click", function (e) { if (!form.contains(e.target)) closeSuggest(); });

  /* ---------- 4. Гарячі клавіші: Ctrl+K або / фокусують пошук ---------- */
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.focus(); input.select(); }
    else if (e.key === "/" && !typing) { e.preventDefault(); input.focus(); }
  });

  /* ---------- 5. Тінь шапки під час прокручування ---------- */
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 4); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
