/* ===== BookSpace · ui.js =====
   Спільні інтерактивні компоненти: тости, модальні вікна, вкладки. */
(function () {
  "use strict";
  if (BS.stop) return;
  var $ = BS.$;

  /* ---------- Тост (коротке повідомлення, що зникає саме) ---------- */
  BS.toast = function (message, type) {
    var box = $("#toasts"); if (!box) return;
    var t = document.createElement("div");
    t.className = "toast toast--" + (type || "ok");
    t.textContent = message;
    box.appendChild(t);
    setTimeout(function () {
      t.classList.add("is-out");
      setTimeout(function () { t.remove(); }, 300);
    }, 3500);
  };

  /* ---------- Модальне вікно на елементі <dialog> ---------- */
  var dlg = $("#dialog");
  BS.dialog = {
    open: function (html, onReady) {
      if (!dlg) return;
      dlg.innerHTML = html;
      if (!dlg.open) dlg.showModal();      // showModal блокує решту сторінки й ловить Esc
      if (onReady) onReady(dlg);
    },
    close: function () { if (dlg && dlg.open) dlg.close(); }
  };
  // Клік по затемненому фону закриває вікно
  if (dlg) dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });

  // Вікно підтвердження: повертає Promise, що вирішується в true/false
  BS.confirm = function (title, text, okLabel) {
    return new Promise(function (resolve) {
      var answered = false;
      BS.dialog.open(
        '<h2 id="dialog-title">' + BS.esc(title) + "</h2><p>" + BS.esc(text) + "</p>" +
        '<div class="dialog__actions"><button class="btn btn--ghost" type="button" data-answer="no">Скасувати</button>' +
        '<button class="btn" type="button" data-answer="yes">' + BS.esc(okLabel || "Так") + "</button></div>",
        function (d) {
          d.onclose = function () { if (!answered) resolve(false); };   // Esc або клік по фону
          d.querySelector('[data-answer="yes"]').onclick = function () { answered = true; BS.dialog.close(); resolve(true); };
          d.querySelector('[data-answer="no"]').onclick = function () { answered = true; BS.dialog.close(); resolve(false); };
        });
    });
  };

  /* ---------- Вкладки (ARIA tabs + керування стрілками) ---------- */
  BS.tabs = function (root, onChange) {
    var tabs = BS.$$('[role="tab"]', root);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      if (onChange) onChange(tab);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") next = tabs[0];
        if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
    select(tabs[0]);
    return { select: select, tabs: tabs };
  };
})();
