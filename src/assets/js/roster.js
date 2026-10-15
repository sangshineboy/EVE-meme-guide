// 首页即时筛选、排序与随机排序。标签、分类、证据等级三种条件叠加。
const roster = document.getElementById("roster");
const cards = [...roster.querySelectorAll(".card")];
const input = document.getElementById("filter");
const status = document.getElementById("filter-status");
const orderBtn = document.getElementById("order");
const shuffleBtn = document.getElementById("shuffle");
const catBtns = [...document.querySelectorAll("[data-filter-cat]")];
const confBtns = [...document.querySelectorAll("[data-filter-conf]")];
const scopeBtns = [...document.querySelectorAll("[data-filter-scope]")];
const serverBtns = [...document.querySelectorAll("[data-filter-server]")];

let category = "";
let confidence = "";
let scope = "";
let server = "";
let order = "title"; // title | sources
let desc = false;
let shuffled = null;

const normalize = (s) => s.toLowerCase().replace(/\s+/g, "");

function apply() {
  const q = normalize(input.value);
  let shown = 0;
  for (const card of cards) {
    const key = normalize(card.dataset.key);
    const okQ = !q || key.includes(q);
    const okCat = !category || card.dataset.category === category;
    const okConf = !confidence || card.dataset.confidence === confidence;
    const okScope = !scope || card.dataset.scope === scope;
    const okServer = !server || card.dataset.server === server;
    const visible = okQ && okCat && okConf && okScope && okServer;
    card.hidden = !visible;
    if (visible) shown++;
  }
  const parts = [];
  if (q) parts.push(`关键词「${input.value.trim()}」`);
  if (category) parts.push(`分类 ${category}`);
  if (scope) parts.push(scope);
  if (server) parts.push(server);
  if (confidence) parts.push(`等级 ${confidence}`);
  status.hidden = false;
  status.textContent = parts.length ? `${parts.join(" · ")}：${shown} 条` : `共 ${shown} 条`;
}

function sortCards() {
  const list = shuffled ? [...shuffled] : [...cards];
  list.sort((a, b) => {
    if (shuffled) return 0;
    const cmp =
      order === "sources"
        ? Number(b.dataset.sources) - Number(a.dataset.sources) ||
          a.dataset.title.localeCompare(b.dataset.title, "zh")
        : a.dataset.title.localeCompare(b.dataset.title, "zh");
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
wire(confBtns, "filterConf", (v) => (confidence = v));
wire(scopeBtns, "filterScope", (v) => (scope = v));
wire(serverBtns, "filterServer", (v) => (server = v));
orderBtn.addEventListener("click", () => {
  if (order === "title" && !desc) {
    order = "sources";
    orderBtn.textContent = "来源 ↓";
  } else if (order === "sources" && !desc) {
    order = "sources";
    desc = true;
    orderBtn.textContent = "来源 ↑";
  } else {
    order = "title";
    desc = false;
    orderBtn.textContent = "名称 ↑";
  }
  orderBtn.setAttribute("aria-pressed", "true");
  shuffled = null;
  shuffleBtn.classList.remove("is-active");
  shuffleBtn.setAttribute("aria-pressed", "false");
  sortCards();
});
shuffleBtn.addEventListener("click", () => {
  shuffled = [...cards].sort(() => Math.random() - 0.5);
  shuffleBtn.classList.toggle("is-active", !!shuffled);
  shuffleBtn.setAttribute("aria-pressed", String(!!shuffled));
  sortCards();
});

apply();
