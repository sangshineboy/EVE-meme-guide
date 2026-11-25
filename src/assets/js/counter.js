/* 首页访问人数统计：对接腾讯云计数接口，未配置时保持隐藏（?preview-counter 可本地预览样式） */
(function () {
  var box = document.getElementById("visit-counter");
  if (!box) return;

  var totalEl = document.getElementById("visit-total");
  var todayEl = document.getElementById("visit-today");
  var endpoint = (box.getAttribute("data-endpoint") || "").trim();
  var fmt = new Intl.NumberFormat("en-US");

  function render(total, today) {
    if (typeof total !== "number" || typeof today !== "number") return;
    totalEl.textContent = fmt.format(total);
    todayEl.textContent = fmt.format(today);
    box.hidden = false;
  }

  /* 本地调试预览：URL 带 ?preview-counter 时展示示例数字 */
  if (!endpoint) {
    if (location.search.indexOf("preview-counter") !== -1) {
      render(12345, 678);
    }
    return;
  }

  function beijingDay() {
    var d = new Date(Date.now() + 8 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }

  function getVisitorId() {
    try {
      var id = localStorage.getItem("eve-meme-visitor-id");
      if (id) return id;
      id = (crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("eve-meme-visitor-id", id);
      return id;
    } catch (e) {
      return "";
    }
  }

  var today = beijingDay();
  var countedToday = false;
  try {
    countedToday = localStorage.getItem("eve-meme-visit-day") === today;
  } catch (e) {}

  var method = countedToday ? "GET" : "POST";
  var opts = { method: method, mode: "cors" };
  if (method === "POST") {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify({ vid: getVisitorId(), day: today });
  }

  fetch(endpoint, opts)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      if (!data || typeof data.total !== "number" || typeof data.today !== "number") return;
      render(data.total, data.today);
      if (method === "POST") {
        try {
          localStorage.setItem("eve-meme-visit-day", data.day || today);
        } catch (e) {}
      }
    })
    .catch(function () {
      /* 接口不可用时静默保持隐藏，不影响页面使用 */
    });
})();
