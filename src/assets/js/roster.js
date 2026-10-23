// 首页即时筛选、排序与随机排序。关键词、分类、端游/手游、服务器四种条件叠加。
const roster = document.getElementById("roster");
const cards = [...roster.querySelectorAll(".card")];
const input = document.getElementById("filter");
const status = document.getElementById("filter-status");
const foldState = document.getElementById("fold-state");
const orderBtns = [...document.querySelectorAll("[data-order]")];
const shuffleBtn = document.getElementById("shuffle");
const catBtns = [...document.querySelectorAll("[data-filter-cat]")];
const scopeBtns = [...document.querySelectorAll("[data-filter-scope]")];
const serverBtns = [...document.querySelectorAll("[data-filter-server]")];
const tierBtns = [...document.querySelectorAll("[data-filter-tier]")];

let category = "";
let scope = "";
let server = "";
let tier = "";
let order = "rank"; // rank=热度（默认）｜ title=名称；热度按播放量与引用数的名次
let desc = false; // false=正序，true=倒序
let shuffled = null;

const normalize = (s) => s.toLowerCase().replace(/\s+/g, "");

function apply() {
  const q = normalize(input.value);
  let shown = 0;
  for (const card of cards) {
    const key = normalize(card.dataset.key);
    const okQ = !q || key.includes(q);
    const okCat = !category || card.dataset.category === category;
    const okScope = !scope || card.dataset.scope === scope;
    const okServer = !server || card.dataset.server === server;
    const okTier = !tier || card.dataset.tier === tier;
    const visible = okQ && okCat && okScope && okServer && okTier;
    card.hidden = !visible;
    if (visible) shown++;
  }
  const parts = [];
  if (q) parts.push(`关键词「${input.value.trim()}」`);
  if (category) parts.push(`分类 ${category}`);
  if (scope) parts.push(scope);
  if (server) parts.push(server);
  if (tier) parts.push(tier);
  status.hidden = false;
  status.textContent = parts.length ? `${parts.join(" · ")}：${shown} 条` : `共 ${shown} 条`;
  if (foldState) foldState.textContent = parts.length ? parts.join(" · ") : "全部";
}

function sortCards() {
  const list = shuffled ? [...shuffled] : [...cards];
  list.sort((a, b) => {
    if (shuffled) return 0;
    let cmp;
    if (order === "rank") {
      // 热度：名次小的靠前；没有名次的（999）垫底，同档按标题
      cmp =
        Number(a.dataset.rank) - Number(b.dataset.rank) ||
        a.dataset.title.localeCompare(b.dataset.title, "zh");
    } else {
      cmp = a.dataset.title.localeCompare(b.dataset.title, "zh");
    }
    return desc ? -cmp : cmp;
  });
  for (const card of list) roster.append(card);
}

input.addEventListener("input", apply);

/** 一组筛选按钮：点击后互斥高亮，并写回对应状态变量 */
function wire(buttons, dataKey, set) {
  for (const btn of buttons) {
    btn.addEventListener("click", () => {
      set(btn.dataset[dataKey]);
      for (const b of buttons) {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      }
      apply();
    });
  }
}
wire(catBtns, "filterCat", (v) => (category = v));
wire(scopeBtns, "filterScope", (v) => (scope = v));
wire(serverBtns, "filterServer", (v) => (server = v));
wire(tierBtns, "filterTier", (v) => (tier = v));
// 排序按钮：热度 / 名称。点一次按该维度正序，再点一次转倒序，箭头显示当前方向。
for (const btn of orderBtns) {
  btn.dataset.label = btn.textContent.trim(); // 记住基础文字（热度 / 名称）
  btn.addEventListener("click", () => {
    if (order === btn.dataset.order) {
      desc = !desc; // 同一个维度：正序 ⇄ 倒序
    } else {
      order = btn.dataset.order;
      desc = false;
    }
    for (const b of orderBtns) {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
      b.textContent = active ? `${b.dataset.label} ${desc ? "↓" : "↑"}` : b.dataset.label;
      b.setAttribute("aria-label", active ? `${b.dataset.label}，当前${desc ? "倒序" : "正序"}，再点切换` : b.dataset.label);
    }
    shuffled = null;
    shuffleBtn.classList.remove("is-active");
    shuffleBtn.setAttribute("aria-pressed", "false");
    sortCards();
  });
}
// 初始化：给默认激活的「热度」补上方向箭头
for (const b of orderBtns) {
  const active = b.dataset.order === order;
  b.textContent = active ? `${b.dataset.label} ${desc ? "↓" : "↑"}` : b.dataset.label;
}
shuffleBtn.addEventListener("click", () => {
  shuffled = [...cards].sort(() => Math.random() - 0.5);
  shuffleBtn.classList.toggle("is-active", !!shuffled);
  shuffleBtn.setAttribute("aria-pressed", String(!!shuffled));
  sortCards();
});

apply();
sortCards();
