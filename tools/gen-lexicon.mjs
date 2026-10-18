// 生成「黑话与别名索引」：把 参考文献/ 抽出的术语（tools/data/lexicon-refs.json）
// 与本仓库词条的名称/别名合并，输出两份：
//   src/_data/lexicon.json  —— 站点 /lexicon/ 页面用
//   docs/lexicon.md         —— 给人看的文档版
//
//   node tools/gen-lexicon.mjs
//
// 参考文献侧的 JSON 由 `python tools/import-refs.py` 生成（只在文献更新后跑）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readAll } from "../scripts/loader.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REFS = path.join(root, "tools", "data", "lexicon-refs.json");
const OUT_JSON = path.join(root, "src", "_data", "lexicon.json");
const OUT_MD = path.join(root, "docs", "lexicon.md");

const entries = readAll().filter((e) => !e.error);
const refs = fs.existsSync(REFS) ? JSON.parse(fs.readFileSync(REFS, "utf8")) : [];

const norm = (s) =>
  String(s ?? "")
    .replace(/[\s《》【】「」『』:：,，.。!！?？、\-—_()（）/／"'“”‘’…·]/g, "")
    .toLowerCase();

// 词条索引：归一化名称 → {slug,title,category}
const byName = new Map();
for (const e of entries) {
  for (const name of [e.data.title, ...(e.data.aliases ?? [])]) {
    const k = norm(name);
    if (k && !byName.has(k)) byName.set(k, { slug: e.slug, title: e.data.title, category: e.data.category });
  }
}

const summaryOf = (e) =>
  String(e.body ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith(">")) ?? "";

const rows = new Map(); // key -> row

const push = (term, { desc = "", source, group = "", url = "", meme = null }) => {
  const key = norm(term);
  if (!key) return;
  const cur = rows.get(key);
  if (!cur) {
    rows.set(key, { term: term.trim(), desc, sources: [source], group, url, meme });
    return;
  }
  if (!cur.sources.includes(source)) cur.sources.push(source);
  if (desc && desc.length > (cur.desc?.length ?? 0)) cur.desc = desc;
  if (!cur.meme && meme) cur.meme = meme;
  if (!cur.url && url) cur.url = url;
};

// 1) 词条：主名与别名
for (const e of entries) {
  const meme = { slug: e.slug, title: e.data.title, category: e.data.category };
  push(e.data.title, { desc: summaryOf(e), source: "词条", group: e.data.category, meme });
  for (const a of e.data.aliases ?? []) {
    push(a, { desc: summaryOf(e), source: "别名", group: e.data.category, meme });
  }
}

// 2) 参考文献里的术语
for (const r of refs) {
  const hit = byName.get(norm(r.term));
  push(r.term, {
    desc: r.desc,
    source: r.source,
    group: r.group,
    url: r.url,
    meme: hit ?? null,
  });
}

const list = [...rows.values()].sort((a, b) => a.term.localeCompare(b.term, "zh"));

// 统计
const byGroup = {};
const bySource = {};
for (const r of list) {
  byGroup[r.group || "未分组"] = (byGroup[r.group || "未分组"] ?? 0) + 1;
  const primary = r.sources[0];
  bySource[primary] = (bySource[primary] ?? 0) + 1;
}
const linked = list.filter((r) => r.meme).length;

const today = new Date().toISOString().slice(0, 10);
const payload = {
  generated: today,
  stats: { terms: list.length, entries: entries.length, linked, refTerms: refs.length },
  groups: Object.entries(byGroup)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count })),
  rows: list.map((r) => ({
    term: r.term,
    desc: r.desc,
    sources: r.sources,
    group: r.group,
    url: r.url,
    meme: r.meme,
  })),
};
fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 1), "utf8");

// ---- 文档版 ----
const mdRows = list
  .map((r) => {
    const link = r.meme
      ? `[${r.meme.title}](../src/memes/${r.meme.slug}/${r.meme.slug}.md)`
      : (r.url ? `[原页](${r.url})` : "—");
    const src = r.sources.length > 2 ? `${r.sources.slice(0, 2).join("；")} 等` : r.sources.join("；");
    return `| ${r.term.replace(/\|/g, "\\|")} | ${(r.desc || "").replace(/\|/g, "\\|")} | ${src.replace(/\|/g, "\\|")} | ${link} |`;
  })
  .join("\n");

const doc = `# 黑话与别名索引（生成文件）

> 由 \`node tools/gen-lexicon.mjs\` 生成，**不要手改**。
> 术语来自两处：本仓库词条的名称与别名、以及 \`参考文献/\` 里抽出的术语（脚本 \`tools/import-refs.py\`）。
> 生成时间：${today} ｜ 术语 ${list.length} 个（其中 ${linked} 个能对上词条）｜ 词条 ${entries.length} 条

## 这份表怎么用

- 群里出现的叫法，先在这里查有没有；有词条的会链到正条，没有词条的给出处。
- **「来源」列**说明这个说法是从哪份材料里来的：词条、163 百科《游戏习语》、B站黑话视频、手游黑话科普等。
- 表里没有的词，正文保留英文原词或照抄社区通行写法，**不要自造译名**。

## 分组分布

${Object.entries(byGroup)
  .sort((a, b) => b[1] - a[1])
  .map(([g, n]) => `- ${g}：${n} 个`)
  .join("\n")}

## 全部术语（${list.length}）

| 术语 | 释义 | 来源 | 词条 / 原页 |
| --- | --- | --- | --- |
${mdRows}
`;

fs.writeFileSync(OUT_MD, doc, "utf8");
console.log(
  `已生成 ${path.relative(root, OUT_JSON)} 与 ${path.relative(root, OUT_MD)}：` +
    `${list.length} 个术语（${linked} 个对得上词条，${refs.length} 条来自参考文献）。`,
);
