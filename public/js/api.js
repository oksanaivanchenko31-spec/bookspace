/* ===== BookSpace · api.js =====
   Шар зв'язку із сервером: fetch + async/await, єдина обробка помилок. */
(function () {
  "use strict";

  // Помилка API: status (0 - немає зв'язку), code, message, fields (помилки по полях форми)
  BS.ApiError = function (status, code, message, fields) {
    var e = new Error(message);
    e.name = "ApiError"; e.status = status; e.code = code; e.fields = fields || null;
    return e;
  };

  BS.api = async function (method, path, body) {
    var headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    var token = BS.session.token();
    if (token) headers.Authorization = "Bearer " + token;

    var res;
    try {
      res = await fetch(BS_CONFIG.API_BASE + path, { method: method, headers: headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw BS.ApiError(0, "NETWORK", "Немає зв’язку із сервером. Перевірте інтернет і спробуйте ще раз.");
    }
    if (res.status === 204) return null;
    var data = null;
    try { data = await res.json(); } catch (e) { /* відповідь без JSON */ }
    if (res.ok) return data;

    var err = (data && data.error) || {};
    // Токен недійсний або прострочений: виходимо й повертаємо на сторінку входу
    if (res.status === 401 && token && !/\/auth\/(login|register)$/.test(path)) {
      BS.session.clear();
      location.replace("login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search));
    }
    throw BS.ApiError(res.status, err.code || "HTTP_" + res.status, err.message || "Помилка сервера (" + res.status + ").", err.fields);
  };
  ["get", "post", "put", "patch"].forEach(function (m) {
    BS.api[m] = function (path, body) { return BS.api(m.toUpperCase(), path, body); };
  });
  BS.api.del = function (path) { return BS.api("DELETE", path); };

  // Показує помилку користувачеві (тост); повертає true, якщо це не помилка полів форми
  BS.handleError = function (err) {
    if (BS.toast) BS.toast(err && err.message ? err.message : "Сталася помилка.", "error");
    return true;
  };

  // Блок «не вдалося завантажити» з кнопкою повтору
  BS.showLoadError = function (container, err, retry) {
    container.innerHTML = '<p class="api-error" role="alert">' + BS.esc(err.message) + (retry ? ' <button class="link" type="button" data-retry>Спробувати ще раз</button>' : "") + "</p>";
    var b = container.querySelector("[data-retry]");
    if (b) b.addEventListener("click", retry);
  };

  // Блокує кнопку на час запиту (захист від подвійного натискання)
  BS.busy = function (btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.setAttribute("aria-busy", !!on);
  };

  /* Перевірка сесії при завантаженні: оновлюємо дані користувача з сервера */
  BS.ready = (async function () {
    if (BS.stop || !BS.session.token()) return;
    try {
      var d = await BS.api.get("/api/auth/me");
      BS.me = d.user;
      BS.session.set(BS.session.token(), d.user);
    } catch (e) { /* 401 уже оброблено в BS.api; інші помилки не блокують сторінку */ }
  })();
})();
