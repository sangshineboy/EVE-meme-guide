// 词条加载器：站点数据、校验脚本、查重脚本共用同一份读取逻辑。
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const MEMES_DIR = path.join(ROOT, "src/memes");

/** 词条目录名（跳过 `_` 开头的临时目录） */
export function listSlugs(dir = MEMES_DIR) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .sort();
}

/**
 * 读取一个词条目录。
 * @returns {{slug:string, dir:string, files:string[], raw:string|null, data:object, body:string, error?:string}}
 */
export function readEntry(slug, dir = MEMES_DIR) {
  const entryDir = path.join(dir, slug);
  const files = fs.readdirSync(entryDir);
  const md = path.join(entryDir, `${slug}.md`);
  const base = { slug, dir: entryDir, files, raw: null, data: {}, body: "" };
  if (!fs.existsSync(md)) {
    return { ...base, error: `缺少词条文件 ${slug}/${slug}.md` };
  }
  const raw = fs.readFileSync(md, "utf8");
  try {
    const { data, content } = matter(raw);
    return { ...base, raw, data, body: content };
  } catch (e) {
    return { ...base, raw, error: `front matter 格式错误（YAML）：${e.message}` };
  }
}

/** 读取全部词条，errors 为扁平化的错误列表 */
export function readAll(dir = MEMES_DIR) {
  const entries = [];
  for (const slug of listSlugs(dir)) entries.push(readEntry(slug, dir));
  return entries;
}
