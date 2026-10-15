// 标签清单与「标签 → 词条」映射（供 tags.njk 与 tag.njk 分页使用）。
// 在 JS 里算好，模板只负责渲染，避免在 Nunjucks 里做数组操作。
import memes from "./memes.js";

export default function () {
  const map = new Map();
  for (const m of memes()) {
    for (const t of m.labels ?? []) {
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(m);
    }
  }
  return [...map]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, "zh"));
}
