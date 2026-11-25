// 主题切换：默认亮色，单图标一键切换亮色 / 暗色。写入 <html data-theme> 与 localStorage。
(function () {
  var KEY = "eve-meme-theme";
  var root = document.documentElement;
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function isDark() {
    return root.getAttribute("data-theme") === "dark";
  }

  function apply(dark) {
    if (dark) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    var tip = dark ? "切换到亮色模式" : "切换到暗色模式";
    btn.setAttribute("aria-label", tip);
    btn.setAttribute("title", tip);
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
  }

  btn.addEventListener("click", function () {
    var nextDark = !isDark();
    try {
      localStorage.setItem(KEY, nextDark ? "dark" : "light");
    } catch (e) {}
    apply(nextDark);
  });

  var stored = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch (e) {}
  apply(stored === "dark");
})();
