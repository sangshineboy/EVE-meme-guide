// 主题切换：亮色 / 自动 / 暗色。写入 <html data-theme> 与 localStorage。
// 「自动」= 不设 data-theme，交给 prefers-color-scheme。
(function () {
  var KEY = "eve-meme-theme";
  var root = document.documentElement;
  var btns = [].slice.call(document.querySelectorAll("[data-theme-set]"));

  function current() {
    var v = null;
    try {
      v = localStorage.getItem(KEY);
    } catch (e) {}
    return v === "light" || v === "dark" ? v : "auto";
  }

  function apply(theme) {
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);

    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute("data-theme-set") === theme;
      btns[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener("click", function () {
      var theme = this.getAttribute("data-theme-set");
      try {
        if (theme === "auto") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, theme);
      } catch (e) {}
      apply(theme);
    });
  }

  apply(current());
})();
