/* ===== BookSpace · notifications.js =====
   Сповіщення з API: позначення прочитаними (PATCH/POST), фільтр «Усі / Непрочитані», лічильник. */
(function () {
  "use strict";
  if (BS.stop || BS.page !== "notes") return;
  var $ = BS.$, $$ = BS.$$;
  var items = [], filter = "all", list = $("#notes-list");

  function render() {
    var unread = items.filter(function (n) { return !n.read; }).length;
    $("#unread-count").textContent = unread;
    var shown = items.filter(function (n) { return filter === "all" || !n.read; });
    list.innerHTML = shown.map(function (n) {
      return '<li class="note' + (n.read ? "" : " is-new") + '" data-id="' + n.id + '"><span class="avatar">' + (n.actorName ? BS.initials(n.actorName) : "BS") +
        '</span><div><p>' + BS.esc(n.text) + '</p><span class="when">' + BS.timeAgo(n.createdAt) + "</span></div>" +
        (n.read ? "" : '<span class="dot" role="img" aria-label="Нове"></span>') + "</li>";
    }).join("");
    $("#n-empty").hidden = shown.length > 0;
    $("#n-empty").textContent = filter === "unread" ? "Непрочитаних сповіщень немає." : "Сповіщень поки немає.";
    BS.refreshBadge(unread);
  }

  async function load() {
    list.innerHTML = '<li class="loading">Завантаження…</li>';
    try { items = (await BS.api.get("/api/notifications")).items; render(); }
    catch (err) { BS.showLoadError(list, err, load); }
  }

  BS.ready.then(function () {
    load();

    // Клік по сповіщенню позначає його прочитаним
    list.addEventListener("click", async function (e) {
      var li = e.target.closest(".note"); if (!li) return;
      var n = items.filter(function (x) { return String(x.id) === li.dataset.id; })[0];
      if (!n || n.read) return;
      try { await BS.api.patch("/api/notifications/" + n.id, { read: true }); n.read = true; render(); }
      catch (err) { BS.handleError(err); }
    });
    $("#read-all").addEventListener("click", async function () {
      try {
        await BS.api.post("/api/notifications/read-all");
        items.forEach(function (n) { n.read = true; }); render();
        BS.toast("Усі сповіщення позначено прочитаними");
      } catch (err) { BS.handleError(err); }
    });
    $$("[data-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        filter = btn.dataset.filter;
        $$("[data-filter]").forEach(function (b) { var on = b === btn; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); });
        render();
      });
    });
  });
})();
