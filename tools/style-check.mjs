// 「AI 味」体检：扫描 src/memes 的词条正文，按可量化的句式指标挑出最像 AI 的那些条。
//
// 判断依据来自一次同口径对比（2026-11）：166 条词条 vs 参考文献/ 里 63 篇真人文本
// （B 站文案 + N 老板小作文，12.4 万字）。真人每万字出现：
//   破折号 2.5 · 分号 8.9 · 「不是…而是」0.3
// 词条是 18.9 / 40.1 / 2.5，也就是 7.6 倍、4.5 倍、8 倍。
//
// 但单条词条中位数只有 181 字，密度会被一两处放大成天文数字，所以**单条判定用次数**，
// 密度只在全站汇总里算——那个数才和真人基准可比。
//
// 用法：
//   npm run style:check              # 汇总 + 超标最重的前 10 条
//   npm run style:check -- --all     # 全部超标条目
//   npm run style:check -- --slug kfc
//   npm run style:check -- --json
//
// 报告工具，不卡构建：现有词条本来就有一批超标，退出码恒为 0。

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MEMES_DIR = path.resolve(import.meta.dirname, "../src/memes");

// 真人基准（每万字），只用于全站汇总对照
export const HUMAN_BASELINE = { dash: 2.5, semi: 8.9, turn: 0.3 };

// 硬指标：句子构造习惯，超了就是 AI 腔。阈值用「一条词条里出现几次」。
export const HARD = {
  dash: { limit: 2, label: "破折号「——」插入语" },
  semi: { limit: 2, label: "分号并列" },
  turn: { limit: 1, label: "「不是 A，而是 B」转折" },
};

// 软指标：只提示，不下判决
export const SOFT = {
  paren: { limit: 2, label: "正文括注", minChars: 0 },
  years: { limit: 1, label: "整条没有年份/数字，太虚", minChars: 150 },
};

const RE = {
  dash: /——/g,
  semi: /[；;]/g,
  turn: /不是[^。！？\n]{1,30}而是/g,
  paren: /（[^）]{1,12}）/g,
  years: /\b(19|20)\d{2}\b|\d+(\.\d+)?\s*(万|亿|艘|人|次|天|年|月|个)/g,
  firstPerson: /我(们)?/g,
};

/** 去掉 front matter、参考文献整节、AI评价的固定落款，只留正文。 */
export function stripBody(md) {
  let t = String(md ?? "");
  if (t.startsWith("---")) {
    const end = t.indexOf("\n---", 3);
    if (end > 0) t = t.slice(end + 4);
  }
  const ref = t.search(/^##\s*参考文献\s*$/m);
  if (ref >= 0) t = t.slice(0, ref);
  return t.replace(/（AI 观点，不构成事实陈述。）/g, "").trim();
}

/** 按句号/问号/叹号/换行切句（本站单换行即换行，所以换行也是句界）。 */
export function splitSentences(text) {
  return text
    .split(/[。！？!?\n]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 1 && !s.startsWith("|")); // 表格行不是句子
}

/** 单条词条的体检结果。 */
export function analyze(md) {
  const body = stripBody(md);
  const chars = body.replace(/\s/g, "").length;
  const sents = splitSentences(body);
  const counts = {};
  for (const [k, re] of Object.entries(RE)) counts[k] = (body.match(re) ?? []).length;

  const hard = [];
  for (const [k, cfg] of Object.entries(HARD)) {
    if (counts[k] >= cfg.limit) hard.push({ key: k, label: cfg.label, count: counts[k], limit: cfg.limit });
  }
  const soft = [];
  for (const [k, cfg] of Object.entries(SOFT)) {
    if (chars < cfg.minChars) continue;
    const hit = k === "years" ? counts[k] < cfg.limit : counts[k] >= cfg.limit;
    if (hit) soft.push({ key: k, label: cfg.label, count: counts[k], limit: cfg.limit });
  }

  // 病灶句：一句里塞了两处以上「平衡」结构，最值得先改
  const bad = sents
    .map((s) => {
      const dashes = (s.match(/——/g) ?? []).length;
      const semis = (s.match(/[；;]/g) ?? []).length;
      const turn = /不是[^。]{1,30}而是/.test(s) ? 1 : 0;
      return { s, score: dashes * 2 + semis + turn * 3 };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  return {
    chars,
    sentCount: sents.length,
    avgSent: sents.length ? +(chars / sents.length).toFixed(1) : 0,
    counts,
    hard,
    soft,
    worst: bad.map((x) => (x.s.length > 100 ? x.s.slice(0, 100) + "…" : x.s)),
  };
}

function listMemes() {
  const out = [];
  for (const dir of fs.readdirSync(MEMES_DIR)) {
    const p = path.join(MEMES_DIR, dir, dir + ".md");
    if (!fs.existsSync(p)) continue;
    out.push({ slug: dir, md: fs.readFileSync(p, "utf8") });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

const per10k = (count, chars) => (chars ? +((count / chars) * 10000).toFixed(1) : 0);

export function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const val = (name) => argv[argv.indexOf(name) + 1];
  const showAll = flags.has("--all");
  const asJson = flags.has("--json");
  const onlySlug = argv.includes("--slug") ? val("--slug") : null;
  const topN = argv.includes("--top") ? Number(val("--top")) : 10;

  let items = listMemes();
  if (onlySlug) items = items.filter((i) => i.slug === onlySlug);
  const rows = items.map((i) => ({ slug: i.slug, ...analyze(i.md) }));

  if (asJson) {
    console.log(JSON.stringify({ scanned: rows.length, rows }, null, 2));
    return;
  }

  if (onlySlug) {
    if (!rows.length) {
      console.error("没有这个词条：" + onlySlug);
      process.exit(2);
    }
    const r = rows[0];
    console.log("## " + r.slug + "（" + r.chars + " 字，" + r.sentCount + " 句，平均句长 " + r.avgSent + "）");
    console.log("计数：" + Object.entries(r.counts).map(([k, v]) => k + " " + v).join(" · "));
    if (r.hard.length) console.log("超标：" + r.hard.map((h) => h.label + "（" + h.count + " 次，阈值 " + h.limit + "）").join("；"));
    else console.log("硬指标：合格");
    if (r.soft.length) console.log("提示：" + r.soft.map((s) => s.label + "（" + s.count + "）").join("；"));
    if (r.worst.length) {
      console.log("病灶句：");
      for (const s of r.worst) console.log("  · " + s);
    }
    return;
  }

  const totalChars = rows.reduce((a, r) => a + r.chars, 0);
  const total = (k) => rows.reduce((a, r) => a + r.counts[k], 0);
  const over = rows.filter((r) => r.hard.length);
  const softOnly = rows.filter((r) => !r.hard.length && r.soft.length);

  console.log(
    "扫描 " + rows.length + " 条词条，正文 " + totalChars.toLocaleString("zh-CN") + " 字（单条中位 " +
      rows.map((r) => r.chars).sort((a, b) => a - b)[Math.floor(rows.length / 2)] + " 字）"
  );
  console.log(
    "硬指标超标 " + over.length + " 条（" + ((over.length / rows.length) * 100).toFixed(0) + "%）" +
      (softOnly.length ? "，另有 " + softOnly.length + " 条只有软提示" : "")
  );
  console.log("分项：" + Object.entries(HARD).map(([k, c]) => c.label + " ≥" + c.limit + " 处：" + rows.filter((r) => r.counts[k] >= c.limit).length + " 条").join(" · "));
  console.log(
    "全站密度（/万字）：" +
      [
        ["破折号", per10k(total("dash"), totalChars), HUMAN_BASELINE.dash],
        ["分号", per10k(total("semi"), totalChars), HUMAN_BASELINE.semi],
        ["不是而是", per10k(total("turn"), totalChars), HUMAN_BASELINE.turn],
      ]
        .map(([name, v, base]) => name + " " + v + "（真人 " + base + "）")
        .join(" · ")
  );

  const sorted = [...over].sort((a, b) => {
    const w = (r) => r.counts.dash * 2 + r.counts.semi * 2 + r.counts.turn * 4;
    return w(b) - w(a) || a.slug.localeCompare(b.slug);
  });
  const show = showAll ? sorted : sorted.slice(0, topN);

  if (show.length) {
    console.log("");
    console.log(showAll ? "全部超标条目（按权重排序）：" : "超标最重的前 " + show.length + " 条：");
    show.forEach((r, i) => {
      const detail = [
        r.counts.dash ? "破折号 " + r.counts.dash : "",
        r.counts.semi ? "分号 " + r.counts.semi : "",
        r.counts.turn ? "不是而是 " + r.counts.turn : "",
      ].filter(Boolean).join(" · ");
      console.log(String(i + 1).padStart(2) + ". " + r.slug.padEnd(26) + detail + "   （" + r.chars + " 字）");
      for (const s of r.worst) console.log("    · " + s);
    });
  } else {
    console.log("");
    console.log("没有条目触发硬指标。");
  }
  if (!showAll && sorted.length > show.length) {
    console.log("");
    console.log("其余 " + (sorted.length - show.length) + " 条用 --all 看；单条细看用 --slug <slug>。");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
