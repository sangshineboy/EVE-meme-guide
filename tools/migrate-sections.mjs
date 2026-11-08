// 一次性迁移：把旧三节（这个梗 / 变体与近亲 / 出处与来历）改成
// 新六节（定性 / 溯源 / 用法 / 演变 / AI评价 / 参考文献）。
//
//   node tools/migrate-sections.mjs           试运行，只打印统计与样本
//   node tools/migrate-sections.mjs --write   写回 src/memes/<slug>/<slug>.md
//
// 原则：只搬段落、不改写句子。搬完用「非空白字符频次」比对，确保一个字都没丢。
// 用法「演变」「AI评价」缺就不建小节（校验器允许缺）；AI评价由后续步骤统一补。
import fs from "node:fs";
import path from "node:path";
import { readAll, MEMES_DIR, ROOT } from "../scripts/loader.mjs";

const WRITE = process.argv.includes("--write");
const sampleArg = process.argv.find((a) => /^--sample=\d+$/.test(a));
const SAMPLE = sampleArg ? Number(sampleArg.split("=")[1]) : 0;

/** 把正文拆成块：空行分块；纯标题行 / 纯加粗行并入下一块（避免标题与内容分家） */
function blocksOf(text) {
  const out = [];
  let cur = [];
  const flush = () => {
    const b = cur.join("\n").trim();
    if (b) out.push(b);
    cur = [];
  };
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) flush();
    else cur.push(line);
  }
  flush();
  const merged = [];
  for (const b of out) {
    if (merged.length && /^(#{3,6}\s.+|\*\*[^*]+\*\*)$/.test(merged[merged.length - 1])) {
      merged[merged.length - 1] += `\n\n${b}`;
    } else merged.push(b);
  }
  return merged;
}

const USAGE = /(多用于|泛指|用来指|代指|专指|一般指|现在多用来|常被用来形容|此后就用|圈里就用|「[^」]{1,14}」是)/;
const TABLE_USAGE = /说法|含义|用法|例句|别名|版本/;

function classify(block, index) {
  const isTable = block.split(/\r?\n/)[0].startsWith("|");
  if (isTable) return TABLE_USAGE.test(block.split(/\r?\n/)[0]) ? "用法" : "定性";
  if (/^##\s*(用法|怎么用)/.test(block)) return "用法";
  if (index === 0) return "定性";
  if (USAGE.test(block)) return "用法";
  // 首块之后一律算来历与背景：这个梗的正文本来就是「它是怎么来的」
  return "溯源";
}

/** 出处与来历里：来源说明、清单、表格、含链接的块留在参考文献，其余叙事搬去溯源 */
function isReferenceBlock(block) {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return true;
  if (lines[0].startsWith(">")) return true;
  if (lines.every((l) => /^([-*|]|#{2,6}\s)/.test(l))) return true;
  if (/\]\(https?:\/\//.test(block)) return true;
  if (lines[lines.length - 1].endsWith("：") || lines[lines.length - 1].endsWith(":")) return true;
  return false;
}

/** 单块正文：在第一个句号处切成「定性 + 溯源」，只切不写。表格/清单/引用不切 */
function splitFirstSentence(block) {
  if (/^\s*[|>*-]/m.test(block) || /^\*\*/m.test(block)) return null;
  const i = block.indexOf("。");
  if (i < 0 || i > block.length - 12) return null;
  const head = block.slice(0, i + 1).trim();
  const tail = block.slice(i + 1).trim();
  if (!head || !tail) return null;
  return [head, tail];
}

const nonSpaceChars = (s) => {
  const m = new Map();
  for (const ch of s.replace(/\s+/g, "")) m.set(ch, (m.get(ch) ?? 0) + 1);
  return m;
};
const sameCount = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);

const stats = { entries: 0, 溯源: 0, 用法: 0, 演变: 0, split: 0, movedFromRefs: 0 };
const missingOrigin = [];
const reports = [];

for (const entry of readAll()) {
  if (entry.error) {
    console.log(`跳过 ${entry.slug}：${entry.error}`);
    continue;
  }
  const raw = fs.readFileSync(path.join(entry.dir, `${entry.slug}.md`), "utf8");
  const fmEnd = raw.indexOf("\n---", 3);
  const front = fmEnd === -1 ? "" : raw.slice(0, fmEnd + 4);
  const body = raw.slice(front.length).replace(/^\s*\n/, "");

  // 一句话定义（第一个 ## 之前的非空行）
  const firstSec = body.search(/^##\s/m);
  const prefix = (firstSec === -1 ? body : body.slice(0, firstSec)).trim();

  // 解析小节
  const sections = [];
  let cur = null;
  for (const line of body.split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      cur = { name: m[1].trim(), lines: [] };
      sections.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  const byName = Object.fromEntries(sections.map((s) => [s.name, s.lines.join("\n").trim()]));
  const ga = byName["这个梗"] ?? "";
  const variant = byName["变体与近亲"] ?? "";
  const refs = byName["出处与来历"] ?? "";

  // 这个梗 → 定性 / 溯源 / 用法
  const buckets = { 定性: [], 溯源: [], 用法: [] };
  const blocks = blocksOf(ga);
  blocks.forEach((b, i) => buckets[classify(b, i)].push(b));

  if (!buckets["定性"].length && blocks.length) buckets["定性"].push(blocks[0]);

  if (!buckets["溯源"].length) {
    if (buckets["定性"].length >= 2) {
      buckets["溯源"].push(buckets["定性"].pop());
    } else if (buckets["定性"].length === 1) {
      const parts = splitFirstSentence(buckets["定性"][0]);
      if (parts) {
        buckets["定性"] = [parts[0]];
        buckets["溯源"] = [parts[1]];
        stats.split++;
      }
    }
  }

  // 出处与来历 → 溯源（叙事）/ 参考文献（来源）
  const refBlocks = blocksOf(refs);
  const stay = [];
  for (const b of refBlocks) {
    if (isReferenceBlock(b)) stay.push(b);
    else {
      buckets["溯源"].push(b);
      stats.movedFromRefs++;
    }
  }

  const out = [prefix, ""];
  const add = (name, blocksArr) => {
    if (!blocksArr.length) return;
    out.push(`## ${name}`, "", blocksArr.join("\n\n"), "");
  };
  add("定性", buckets["定性"]);
  add("溯源", buckets["溯源"]);
  add("用法", buckets["用法"]);
  add("演变", variant ? blocksOf(variant) : []);
  add("参考文献", stay);

  const nextBody = out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  // 不变量：除小节标题外，非空白字符频次必须完全一致
  const stripHeadings = (s) => s.replace(/^##\s+.*$/gm, "");
  const before = nonSpaceChars(stripHeadings(body));
  const after = nonSpaceChars(stripHeadings(nextBody));
  if (!sameCount(before, after)) {
    reports.push(`字符不齐：${entry.slug}`);
  }

  stats.entries++;
  if (buckets["溯源"].length) stats["溯源"]++;
  if (buckets["用法"].length) stats["用法"]++;
  if (variant) stats["演变"]++;
  if (!buckets["溯源"].length) missingOrigin.push(entry.slug);

  if (WRITE) fs.writeFileSync(path.join(entry.dir, `${entry.slug}.md`), front + "\n" + nextBody, "utf8");
  if (SAMPLE && stats.entries <= SAMPLE) console.log(`\n===== ${entry.slug} =====\n${nextBody}`);
}

console.log(`${WRITE ? "已写回" : "试运行"}：${stats.entries} 条`);
console.log(`  溯源 ${stats["溯源"]} 条 · 用法 ${stats["用法"]} 条 · 演变 ${stats["演变"]} 条`);
console.log(`  单块切句 ${stats.split} 条 · 从「出处与来历」搬出叙事 ${stats.movedFromRefs} 块`);
if (reports.length) {
  console.log(`\n异常 ${reports.length} 条：`);
  for (const r of reports.slice(0, 30)) console.log(`  ${r}`);
} else {
  console.log("\n字符比对全部通过（只搬不改）。");
}
if (missingOrigin.length) console.log(`\n没有「溯源」内容（${missingOrigin.length} 条）：${missingOrigin.join(" ")}`);
if (!WRITE) console.log(`\n仓库根目录：${path.relative(ROOT, MEMES_DIR)}/`);
