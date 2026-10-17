import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readAll } from "./loader.mjs";
import { validateEntry } from "./schema.mjs";

// 仓库级基线：真实词条必须全部合规，且不得出现重复 slug / 别名。
test("全部词条通过校验", () => {
  const entries = readAll();
  const errors = [];
  for (const e of entries) {
    if (e.error) errors.push(`${e.slug}：${e.error}`);
    else for (const x of validateEntry(e)) errors.push(`${e.slug}：${x}`);
  }
  assert.deepEqual(errors, []);
});

test("slug 与别名不重复", () => {
  const seenSlug = new Map();
  const seenAlias = new Map();
  const dup = [];
  for (const e of readAll()) {
    if (e.error) continue;
    const slug = String(e.data.slug);
    if (seenSlug.has(slug)) dup.push(`slug ${slug}`);
    seenSlug.set(slug, true);
    for (const a of e.data.aliases ?? []) {
      const k = a.trim().toLowerCase();
      if (seenAlias.has(k) && seenAlias.get(k) !== slug) dup.push(`别名 ${a}`);
      seenAlias.set(k, slug);
    }
  }
  assert.deepEqual(dup, []);
});

test("AGENTS.md 存在且非空（唯一权威说明）", async () => {
  const a = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.ok(a.trim().length > 1000, "AGENTS.md 内容异常（过短或为空）");
  assert.match(a, /本仓库唯一的权威说明/, "AGENTS.md 缺少权威说明声明");
});

// 回归：Eleventy 默认给的是 markdown-it "default" preset——不含表格、删除线，也不开 breaks。
// 一旦有人删掉 eleventy.config.js 里的 amendLibrary，正文里的单换行会被静默合并（中文写作全站变形）。
test("Markdown 渲染配置为 breaks + 表格/删除线", async () => {
  const cfg = await readFile(new URL("../eleventy.config.js", import.meta.url), "utf8");
  assert.match(cfg, /amendLibrary\(\s*"md"/, "eleventy.config.js 必须 amendLibrary(\"md\")");
  assert.match(cfg, /breaks:\s*true/, "必须设置 breaks: true（单个换行即换行）");
  assert.match(cfg, /enable\(\[[^\]]*"table"/, "必须启用 table（否则 Markdown 表格不渲染）");
});

test("每个「怎么用」小节都标注了示例性质", async () => {
  const { readAll } = await import("./loader.mjs");
  const offenders = [];
  for (const e of readAll()) {
    if (e.error) continue;
    if (!/^##\s+怎么用\s*$/m.test(e.body)) continue;
    if (!e.body.includes("说明性写法")) offenders.push(e.slug);
  }
  assert.deepEqual(offenders, [], "这些词条的「怎么用」缺少示例性质说明");
});
