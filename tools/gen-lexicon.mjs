// 生成 docs/lexicon.md：术语与别名索引。
//
// 数据源只有一个：本仓库的词条（src/memes/<slug>/<slug>.md）。
// 不再依赖任何外部整理表——别人的整理成果不是本项目的来源。
//
//   node tools/gen-lexicon.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readAll } from "../scripts/loader.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "docs", "lexicon.md");
const entries = readAll().filter((e) => !e.error);

// 术语 = 词条主名 + 别名，按名称排序；别名指向所属词条
const rows = [];
const seen = new Set();
for (const e of entries) {
  for (const name of [e.data.title, ...(e.data.aliases ?? [])]) {
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      name: name.trim(),
      isTitle: name === e.data.title,
      category: e.data.category,
      slug: e.slug,
      title: e.data.title,
    });
  }
}
rows.sort((a, b) => a.name.localeCompare(b.name, "zh"));

// 分类统计
const byCat = new Map();
for (const e of entries) byCat.set(e.data.category, (byCat.get(e.data.category) ?? 0) + 1);

const table = [
  "| 名称 / 黑话 / 别名 | 词条 | 分类 |",
  "| --- | --- | --- |",
  ...rows.map(
    (r) =>
      `| ${r.name.replace(/\|/g, "\\|")}${r.isTitle ? "" : " *（别名）*"} | [${r.title}](../src/memes/${r.slug}/${r.slug}.md) | ${r.category} |`,
  ),
].join("\n");

const doc = `# 术语与别名索引（生成文件）

> 由 \`node tools/gen-lexicon.mjs\` 从本仓库词条生成，**不要手改**；要加词就写词条（\`npm run new\`），改完重新生成。
> 生成时间：${new Date().toISOString().slice(0, 10)} ｜ 词条 ${entries.length} 条 ｜ 名称 ${rows.length} 个

## 这份表怎么用

- 它是**本仓库词条的名字总表**：同一件事在群里可能有三四个叫法，全都列在这里，避免重复立条。
- 别名用斜体标出；点「词条」列进正条。
- 表里没有的词，正文请保留英文原词或照抄社区通行写法，**不要自造译名**。

## 词条分布

${[...byCat].map(([c, n]) => `- ${c}：${n} 条`).join("\n")}

## 全部名称（${rows.length}）

${table}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, doc);
console.log(`已生成 ${path.relative(root, OUT)}：${entries.length} 条词条、${rows.length} 个名称。`);
