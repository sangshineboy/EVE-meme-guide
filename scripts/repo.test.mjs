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

test("AGENTS.md 与 CLAUDE.md 逐字一致", async () => {
  const [a, b] = await Promise.all([
    readFile(new URL("../AGENTS.md", import.meta.url)),
    readFile(new URL("../CLAUDE.md", import.meta.url)),
  ]);
  assert.ok(a.equals(b), "AGENTS.md 与 CLAUDE.md 不一致：改一处必须同步另一处");
});
