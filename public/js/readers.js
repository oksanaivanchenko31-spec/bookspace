/* ===== BookSpace · readers.js =====
   Читачі: список і пошук, підписка/відписка (PUT/DELETE), сторінка профілю читача. Дані з API. */
(function () {
  "use strict";
  if (BS.stop || (BS.page !== "readers" && BS.page !== "reader")) return;
  var $ = BS.$;

  function followBtn(btn, on) {
    btn.textContent = on ? "Ви підписані" : "Підписатися";
    btn.classList.toggle("btn--ghost", on);
    btn.setAttribute("aria-pressed", on);
    btn.title = on ? "Натисніть, щоб скасувати підписку" : "";
  }
  // Підписка: PUT /api/readers/:id/follow; відписка: DELETE. Повертає новий стан.
  async function toggleFollow(id, currentlyOn) {
    var res = currentlyOn ? await BS.api.del("/api/readers/" + id + "/follow") : await BS.api.put("/api/readers/" + id + "/follow");
    return res.following;
  }
  function grid(list, empty) {
    return list.length ? '<ul class="grid">' + list.map(function (s) { return "<li>" + BS.cardHTML(s) + "</li>"; }).join("") + "</ul>" : '<p class="empty">' + empty + "</p>";
  }

  BS.ready.then(function () {
    /* ---------- список читачів ---------- */
    if (BS.page === "readers") {
      var readers = [], list = $("#readers"), rq = $("#rq");
      var render = function () {
        var s = rq.value.trim().toLowerCase();
        var shown = readers.filter(function (r) { return !s || (r.name + " " + r.bio).toLowerCase().indexOf(s) > -1; });
        list.innerHTML = shown.map(function (r) {
          return '<li class="reader-row" data-id="' + r.id + '"><span class="avatar" aria-hidden="true">' + BS.initials(r.name) + '</span><div class="reader-row__info"><a class="reader-row__name" href="reader.html?id=' + r.id + '">' +
            BS.esc(r.name) + "</a><p>" + BS.esc(r.bio) + '</p><p class="meta">' + r.shelves.read.length + " прочитано · " + r.shelves.reading.length + ' читає зараз</p></div>' +
            '<button class="btn btn--sm' + (r.following ? " btn--ghost" : "") + '" type="button" data-follow="' + r.id + '" aria-pressed="' + r.following + '">' + (r.following ? "Ви підписані" : "Підписатися") + "</button></li>";
        }).join("");
        $("#r-empty").hidden = shown.length > 0;
      };
      var load = async function () {
        list.innerHTML = '<li class="loading">Завантаження…</li>';
        try { readers = (await BS.api.get("/api/readers")).readers; render(); }
        catch (err) { BS.showLoadError(list, err, load); }
      };
      rq.addEventListener("input", render);
      $("form.searchbig").addEventListener("submit", function (e) { e.preventDefault(); });
      list.addEventListener("click", async function (e) {
        var id = e.target.dataset.follow; if (!id) return;
        var r = readers.filter(function (x) { return String(x.id) === id; })[0];
        BS.busy(e.target, true);
        try {
          r.following = await toggleFollow(r.id, r.following);
          BS.toast(r.following ? "Ви підписалися: " + r.name : "Підписку скасовано");
          render();
        } catch (err) { BS.handleError(err); BS.busy(e.target, false); }
      });
      load();
      return;
    }

    /* ---------- сторінка окремого читача ---------- */
    var id = BS.param("id"), fb = $("#r-follow"), reader = null;
    async function loadReader() {
      try {
        reader = (await BS.api.get("/api/readers/" + encodeURIComponent(id))).reader;
      } catch (err) {
        if (err.status === 404) { location.replace("readers.html"); return; }
        $("#r-name").textContent = "Не вдалося завантажити профіль"; BS.handleError(err); return;
      }
      document.title = reader.name + " — BookSpace";
      $("#r-ini").textContent = BS.initials(reader.name); $("#r-name").textContent = reader.name; $("#r-bio").textContent = reader.bio || "";
      $("#r-n3").textContent = reader.shelves.read.length; $("#r-n2").textContent = reader.shelves.reading.length; $("#r-n1").textContent = reader.shelves.want.length;
      $("#r-l3").innerHTML = grid(reader.shelves.read, "Поки що нічого не прочитано.");
      $("#r-l2").innerHTML = grid(reader.shelves.reading, "Зараз нічого не читає.");
      $("#r-l1").innerHTML = grid(reader.shelves.want, "Список бажаного порожній.");
      BS.fixCovers(); followBtn(fb, reader.following);
    }
    fb.addEventListener("click", async function () {
      if (!reader) return;
      BS.busy(fb, true);
      try {
        reader.following = await toggleFollow(reader.id, reader.following);
        followBtn(fb, reader.following);
        $("#r-msg").textContent = reader.following ? "Підписку оформлено: " + reader.name + "." : "Підписку скасовано.";
        BS.toast(reader.following ? "Ви підписалися: " + reader.name : "Підписку скасовано");
      } catch (err) { BS.handleError(err); }
      BS.busy(fb, false);
    });
    loadReader();
  });
})();
