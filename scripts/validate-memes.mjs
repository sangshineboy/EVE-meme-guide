// 词条校验：npm run check / npm run build 会先跑这里。
// 校验 front matter、正文结构、来源链接、素材文件、相关词条引用与全局查重。
//
//   node scripts/validate-memes.mjs          校验（缺词条目录时报错）
//   node scripts/validate-memes.mjs --quiet  只在失败时输出

import { readAll } from "./loader.mjs";
import { validateEntry, SLUG_RE } from "./schema.mjs";

const quiet = process.argv.includes("--quiet");

const entries = readAll();
const errors = [];

if (entries.length === 0) {
  errors.push(`src/memes/ 下一个词条目录都没有：请先运行 npm run new -- "<词条名>" 建条目。`);
}

for (const entry of entries) {
  if (entry.error) {
    errors.push(`${entry.slug}：${entry.error}`);
    continue;
  }
  for (const e of validateEntry(entry)) errors.push(`${entry.slug}：${e}`);
}

// 全局：slug 与别名查重
const seenSlug = new Map();
const seenAlias = new Map();
for (const entry of entries) {
  if (entry.error) continue;
  const slug = String(entry.data.slug ?? entry.slug);
  if (seenSlug.has(slug)) errors.push(`slug 重复：${slug}（${seenSlug.get(slug)} 与 ${entry.slug}）`);
  else seenSlug.set(slug, entry.slug);

  for (const alias of entry.data.aliases ?? []) {
    const key = alias.trim().toLowerCase();
    if (seenAlias.has(key) && seenAlias.get(key) !== slug) {
      errors.push(`别名重复："${alias}" 同时属于 ${seenAlias.get(key)} 与 ${slug}`);
    } else {
      seenAlias.set(key, slug);
    }
  }
}

// 相关词条必须存在，且不能指向自己
for (const entry of entries) {
  if (entry.error) continue;
  for (const rel of entry.data.related ?? []) {
    if (!SLUG_RE.test(rel)) {
      errors.push(`${entry.slug}：related 里的 "${rel}" 不是合法 slug`);
      continue;
    }
    if (rel === entry.data.slug) errors.push(`${entry.slug}：related 不能指向自己`);
    else if (!seenSlug.has(rel)) errors.push(`${entry.slug}：related 指向不存在的词条 "${rel}"`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n共 ${errors.length} 处问题，${entries.length} 个词条未通过校验。`);
  process.exit(1);
}

if (!quiet) {
  const byCategory = new Map();
  for (const e of entries) byCategory.set(e.data.category, (byCategory.get(e.data.category) ?? 0) + 1);
  const dist = [...byCategory].map(([k, v]) => `${k} ${v}`).join(" · ");
  console.log(`词条校验通过：${entries.length} 条（${dist}）`);
}
