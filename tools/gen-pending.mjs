// 生成 docs/pending.md：从词条数据里汇总「还欠什么」的清单。
//
//   node tools/gen-pending.mjs
//
// 判据（全部来自词条本身，不靠人工维护第二份清单）：
//   - 证据等级为「社区流传」的，需要找一条可核对来源
//   - 缺来源链接、来源偏少、别名偏少、没写「怎么用」的
//   - related 为空的孤立词条
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readAll } from "../scripts/loader.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "docs/pending.md");
const entries = readAll().filter((e) => !e.error);

const rows = [];
for (const e of entries) {
  const d = e.data;
  const links = (e.body.match(/\]\(https?:\/\/[^)\s]+\)/g) ?? []).length;
  const needs = [];
  if (d.confidence === "社区流传") needs.push("找一条可核对来源");
  if (links === 0) needs.push("补来源链接");
  if (!(d.aliases ?? []).length) needs.push("补别名（影响搜索命中）");
  if (!/^##\s+怎么用/m.test(e.body)) needs.push("补「怎么用」");
  if (!(d.related ?? []).length) needs.push("补相关词条");
  if (d.confidence === "已确认" && links < 2) needs.push("已确认但只有一条来源，建议加一条");
  if (needs.length) rows.push({ title: d.title, slug: e.slug, cat: d.category, conf: d.confidence, links, needs });
}

rows.sort((a, b) => b.needs.length - a.needs.length || a.title.localeCompare(b.title, "zh"));

const byConf = entries.reduce((m, e) => m.set(e.data.confidence, (m.get(e.data.confidence) ?? 0) + 1), new Map());
const doc = `# 待补清单（生成文件）

> 由 \`node tools/gen-pending.mjs\` 从词条数据生成，**不要手改**；要清掉某一行，就去改对应词条。
> 生成时间：${new Date().toISOString().slice(0, 10)} ｜ 词条总数 ${entries.length}（${[...byConf].map(([k, v]) => `${k} ${v}`).join(" · ")}）

${rows.length === 0 ? "全部词条都齐了。" : `仍有 ${rows.length} 条词条欠东西，按欠得多的排在前面：\n`}
${
  rows.length
    ? [
        "| 词条 | 分类 | 等级 | 来源数 | 还欠 |",
        "| --- | --- | --- | --- | --- |",
        ...rows.map(
          (r) =>
            `| [${r.title}](../src/memes/${r.slug}/${r.slug}.md) | ${r.cat} | ${r.conf} | ${r.links} | ${r.needs.join("；")} |`,
        ),
      ].join("\n")
    : ""
}

## 说明

- 这张表只是**写作侧**的欠账；取材侧的覆盖与缺口写在每条词条自己的 \`sources-<slug>.md\` 里，不在这里重复。
- 「社区流传」不是错误，它是明确标注的等级；但能不落等级就别落——找到可核对来源后改成「已确认」并更新 \`updated_at\`。
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, doc);
console.log(`已生成 ${path.relative(root, OUT)}：${rows.length}/${entries.length} 条词条有待补项。`);
