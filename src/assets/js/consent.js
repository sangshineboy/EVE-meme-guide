// 首次访问确认：说明本站由 AI 生成、仅供参考，勾选同意后放行。
//
// 设计取舍：
//   · 默认 fail-open —— 弹窗在 HTML 里是 hidden，由 JS 打开。禁用 JS 的读者不会被困在页面上，
//     代价是这类用户看不到提示（内容本身是公开资料，风险可接受）。
//   · 同意状态存 localStorage，key 带版本号，改协议措辞后可以换 v2 重新征询。
//   · ?reset-consent 或页脚「重新阅读」可重置，方便复查弹窗。
(function () {
  var KEY = "eve-meme-consent-v1";
  var box = document.getElementById("consent");
  if (!box) return;

  function read() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, "1");
    } catch (e) {
      /* 隐私模式写不进去就算了，本次会话内不再弹 */
    }
  }

  if (location.search.indexOf("reset-consent") !== -1) {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
  }

  if (read() === "1") {
    box.parentNode.removeChild(box);
    return;
  }

  // 「使用条款」「关于作者」这类说明页不放弹窗——否则用户点开弹窗里的链接，
  // 新页面又弹一次，等于永远读不到条款。这些页面上给一个「同意并进入」按钮即可。
  if (document.body.dataset.consentExempt !== undefined) {
    box.parentNode.removeChild(box);
    var enter = document.getElementById("terms-agree");
    if (enter) {
      enter.addEventListener("click", function () {
        save();
        location.href = enter.dataset.home || "/";
      });
    }
    return;
  }

  var agree = box.querySelector("#consent-agree");
  var ok = box.querySelector("#consent-ok");
  var lastFocus = document.activeElement;

  box.hidden = false;
  document.documentElement.classList.add("consent-open");
  // 打开后把焦点送进弹窗，键盘用户不会跑到背后的页面上
  if (agree) agree.focus();

  if (agree && ok) {
    agree.addEventListener("change", function () {
      ok.disabled = !agree.checked;
    });
  }

  function accept() {
    save();
    box.parentNode.removeChild(box);
    document.documentElement.classList.remove("consent-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (ok) ok.addEventListener("click", accept);
})();
