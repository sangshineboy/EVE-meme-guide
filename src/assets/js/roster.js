// 首页即时筛选、排序与随机排序。标签、分类、证据等级三种条件叠加。
const roster = document.getElementById("roster");
const cards = [...roster.querySelectorAll(".card")];
const input = document.getElementById("filter");
const status = document.getElementById("filter-status");
const orderBtn = document.getElementById("order");
const shuffleBtn = document.getElementById("shuffle");
const catBtns = [...document.querySelectorAll("[data-filter-cat]")];
const confBtns = [...document.querySelectorAll("[data-filter-conf]")];

let category = "";
let confidence = "";
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
    const visible = okQ && okCat && okConf;
    card.hidden = !visible;
    if (visible) shown++;
  }
  const parts = [];
  if (q) parts.push(`关键词「${input.value.trim()}」`);
  if (category) parts.push(`分类 ${category}`);
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
for (const btn of catBtns) {
  btn.addEventListener("click", () => {
    category = btn.dataset.filterCat;
    for (const b of catBtns) {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    }
    apply();
  });
}
for (const btn of confBtns) {
  btn.addEventListener("click", () => {
    confidence = btn.dataset.filterConf;
    for (const b of confBtns) {
      const active = b === btn;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    }
    apply();
  });
}
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
