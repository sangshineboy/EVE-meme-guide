// 查重与检索：在全部词条（含别名、正文、标签）里找关键词，避免重复立条。
//
//   npm run find -- "泡泡"
//   npm run find -- --aliases        只列全部别名
//
import { readAll } from "./loader.mjs";
import "./runtime.mjs";

const args = process.argv.slice(2);
const entries = readAll().filter((e) => !e.error);

if (args.includes("--aliases")) {
  const rows = [];
  for (const e of entries) for (const a of e.data.aliases ?? []) rows.push(`${a}\t→ ${e.data.title} (/m/${e.slug}/)`);
  console.log(rows.sort((a, b) => a.localeCompare(b, "zh")).join("\n") || "（还没有别名）");
  process.exit(0);
}

const q = args.filter((a) => !a.startsWith("--")).join(" ").trim().toLowerCase();
if (!q) {
  console.error('用法：npm run find -- "关键词"    或    npm run find -- --aliases');
  process.exit(1);
}

const hits = [];
for (const e of entries) {
  const where = [];
  if (String(e.data.title).toLowerCase().includes(q)) where.push("标题");
  if ((e.data.aliases ?? []).some((a) => a.toLowerCase().includes(q))) where.push("别名");
  if ((e.data.tags ?? []).some((t) => t.toLowerCase().includes(q))) where.push("标签");
  if (String(e.data.category).includes(q)) where.push("分类");
  if (e.body.toLowerCase().includes(q)) where.push("正文");
  if (where.length) hits.push({ title: e.data.title, slug: e.slug, where });
}

if (!hits.length) {
  console.log(`没有词条命中「${q}」——可以新建：npm run new -- "<词条名>" --slug <slug>`);
} else {
  console.log(`命中 ${hits.length} 条：`);
  for (const h of hits) console.log(`  ${h.title}（${h.where.join("/")}）  /m/${h.slug}/`);
  console.log("已有词条默认补充，不要另立重复条目。");
}
