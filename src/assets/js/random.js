// 「随机一条」：点导航里的链接直接跳到随机词条，不经过 /random/ 页。
// 设计要点：
//   · 先拦住默认跳转，只有成功取到 slug 列表才改跳词条；取不到就退回 /random/（无 JS 时也走这条）。
//   · 前缀从链接自身的 pathname 推出来，GitHub Pages 的 /<仓库名>/ 子路径无需额外配置。
//   · 列表只拉一次，之后走内存缓存。
(function () {
  var link = document.getElementById("js-random");
  if (!link || !link.dataset.slugs) return;

  var cache = null;

  function basePath() {
    // /EVE-meme-guide/random/ → /EVE-meme-guide/ ；/random/ → /
    return new URL(link.href, location.href).pathname.replace(/random\/?$/, "");
  }

  link.addEventListener("click", function (ev) {
    // 中键/修饰键点击交给浏览器（新标签打开 /random/ 也算合理兜底）
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;

    ev.preventDefault();

    function go(list) {
      if (!list || !list.length) {
        location.href = link.href;
        return;
      }
      var slug = list[Math.floor(Math.random() * list.length)];
      location.href = basePath() + "m/" + slug + "/";
    }

    if (cache) {
      go(cache);
      return;
    }

    fetch(link.dataset.slugs, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (list) {
        cache = Array.isArray(list) ? list : null;
        go(cache);
      })
      .catch(function () {
        location.href = link.href; // 兜底：回 /random/ 页
      });
  });
})();
