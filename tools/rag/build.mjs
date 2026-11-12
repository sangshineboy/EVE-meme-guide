// 把 参考文献/ 抽成可检索的语料块，建成 BM25 索引。
//
// 用法：
//   node tools/rag/build.mjs                  # 建索引到 .cache/rag/index.json
//   node tools/rag/build.mjs --out x.json     # 指定输出
//   node tools/rag/build.mjs --dry            # 只统计，不写文件
//   node tools/rag/build.mjs --root <目录>    # 换语料目录（测试用）
//
// 只读语料，不改原始素材。索引是派生产物，默认写 .cache/（已被 .gitignore 忽略）。

import fs from "node:fs";
import path from "node:path";
import { readXlsx } from "./lib/xlsx.mjs";
import { normalize } from "./lib/text.mjs";
import { chunkMarkdown, chunkSheet } from "./lib/chunk.mjs";
import { buildIndex } from "./lib/bm25.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CORPUS_ROOT = path.join(ROOT, "参考文献");
const DEFAULT_OUT = path.join(ROOT, ".cache/rag/index.json");

const TEXT_EXT = new Set([".md", ".txt"]);
const TABLE_EXT = new Set([".xlsx"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === ".cache") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const out = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : DEFAULT_OUT;
  const rootIdx = args.indexOf("--root");
  const corpusRoot = rootIdx >= 0 ? path.resolve(args[rootIdx + 1]) : CORPUS_ROOT;
  const dry = args.includes("--dry");

  if (!fs.existsSync(corpusRoot)) {
    console.error("找不到语料目录：" + rel(corpusRoot));
    process.exit(1);
  }

  const files = walk(corpusRoot).sort();
  const chunks = [];
  let textFiles = 0;
  let sheetFiles = 0;
  let sheets = 0;
  const skipped = {};

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const p = rel(file);
    const label = path.basename(file, ext);
    let produced = [];

    if (TEXT_EXT.has(ext)) {
      textFiles++;
      let text = fs.readFileSync(file, "utf8");
      if (ext === ".md" && text.startsWith("---")) {
        const end = text.indexOf("\n---", 3);
        if (end > 0) text = text.slice(end + 4);
      }
      produced = chunkMarkdown(text, label);
    } else if (TABLE_EXT.has(ext)) {
      sheetFiles++;
      for (const sheet of readXlsx(file)) {
        sheets++;
        produced = produced.concat(chunkSheet(sheet, label));
      }
    } else if (ext === ".html") {
      textFiles++;
      produced = chunkMarkdown(htmlToText(fs.readFileSync(file, "utf8")), label);
    } else {
      skipped[ext] = (skipped[ext] ?? 0) + 1;
      continue;
    }

    for (const c of produced) {
      const t = normalize(c.t);
      if (t) chunks.push({ p, ctx: c.ctx || "", t });
    }
  }

  // 同一段正文常同时躺在 .md 与 .xlsx 里（N 老板小作文就是这样），只留第一次，
  // 否则检索结果会自我重复、占满 top-k。
  const seen = new Set();
  let deduped = 0;
  const kept = chunks.filter((c) => {
    if (c.t.length <= 120) return true;
    if (seen.has(c.t)) { deduped++; return false; }
    seen.add(c.t);
    return true;
  });

  const index = buildIndex(kept);
  const avgLen = kept.length ? +(index.lens.reduce((a, b) => a + b, 0) / kept.length).toFixed(1) : 0;
  const stats = {
    files: textFiles + sheetFiles,
    textFiles,
    sheetFiles,
    sheets,
    chunks: kept.length,
    deduped,
    terms: index.postings.size,
    avgLen,
    skipped,
    builtAt: new Date().toISOString(),
  };

  console.log("语料：" + stats.files + " 个文件（文本 " + textFiles + " / 表格 " + sheetFiles + "，共 " + sheets + " 张表）");
  console.log("分块：" + stats.chunks + " 块（去重 " + deduped + "），检索词 " + stats.terms + "，平均块长 " + stats.avgLen + " 词");
  if (Object.keys(skipped).length) {
    console.log("跳过（非文本）：" + Object.entries(skipped).map(([k, v]) => k + "×" + v).join("，"));
  }
  if (dry) return;

  const payload = {
    version: 1,
    stats,
    chunks: index.chunks,
    lens: index.lens,
    postings: Object.fromEntries(index.postings),
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload));
  console.log("索引：" + rel(out) + "（" + (fs.statSync(out).size / 1048576).toFixed(1) + " MB）");
}

main();
