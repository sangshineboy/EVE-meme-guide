// 把 tmp/ai-reviews/*.json 里的评价写进词条：插在「## 参考文献」之前。
//
//   node tools/apply-ai-reviews.mjs            试运行，只报统计
//   node tools/apply-ai-reviews.mjs --write    写回词条
//
// 校验：slug 必须存在、评价非空且 10–200 字、单行、不含链接、不重复落款。
import fs from "node:fs";
import path from "node:path";
import { readAll, ROOT } from "../scripts/loader.mjs";
import { AI_REVIEW_MARK } from "../scripts/schema.mjs";

const WRITE = process.argv.includes("--write");
const DIR = path.join(ROOT, "tmp/ai-reviews");

const entries = new Map(readAll().filter((e) => !e.error).map((e) => [e.slug, e]));
const reviews = new Map();
const problems = [];

if (!fs.existsSync(DIR)) {
  console.error(`没有 ${path.relative(ROOT, DIR)}：先跑批量生成。`);
  process.exit(1);
}

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  } catch (e) {
    problems.push(`${file}：JSON 解析失败（${e.message}）`);
    continue;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    problems.push(`${file}：不是对象`);
    continue;
  }
  for (const [slug, text] of Object.entries(data)) {
    if (!entries.has(slug)) {
      problems.push(`${file}：未知 slug ${slug}`);
      continue;
    }
    if (typeof text !== "string") {
      problems.push(`${file}：${slug} 的值不是字符串`);
      continue;
    }
    let v = text.replace(/\s+/g, " ").trim();
    v = v.replace(new RegExp(`\\s*[（(]?${AI_REVIEW_MARK.replace(/[（）]/g, (c) => `\\${c}`)}[）)]?\\s*$`), "").trim();
    if (v.length < 6 || v.length > 200) {
      problems.push(`${slug}：评价长度 ${v.length}（要求 6–200）`);
      continue;
    }
    if (/https?:\/\//.test(v)) {
      problems.push(`${slug}：评价里带链接`);
      continue;
    }
    if (reviews.has(slug)) problems.push(`${slug}：重复出现，后者覆盖`);
    reviews.set(slug, v);
  }
}

const stats = { applied: 0, skipped: 0 };
const missing = [];
for (const [slug, entry] of entries) {
  const raw = fs.readFileSync(path.join(entry.dir, `${slug}.md`), "utf8");
  const body = raw;
  if (/^##\s+AI吐槽\s*$/m.test(body)) {
    stats.skipped++;
    continue;
  }
  const review = reviews.get(slug);
  if (!review) {
    missing.push(slug);
    continue;
  }
  const marker = `\n## 参考文献`;
  const at = body.indexOf(marker);
  if (at === -1) {
    problems.push(`${slug}：找不到「## 参考文献」`);
    continue;
  }
  const section = `\n## AI吐槽\n\n${review}\n\n${AI_REVIEW_MARK}\n`;
  const next = body.slice(0, at) + section + body.slice(at);
  if (WRITE) fs.writeFileSync(path.join(entry.dir, `${slug}.md`), next, "utf8");
  stats.applied++;
}

console.log(`${WRITE ? "已写入" : "试运行"}：写入 ${stats.applied} 条，已有跳过 ${stats.skipped} 条`);
if (missing.length) console.log(`\n缺评价 ${missing.length} 条：${missing.join(" ")}`);
if (problems.length) {
  console.log(`\n问题 ${problems.length} 处：`);
  for (const p of problems.slice(0, 30)) console.log(`  ${p}`);
}
if (!WRITE) console.log("\n加 --write 才会写回。");
