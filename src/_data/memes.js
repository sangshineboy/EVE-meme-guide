// 词条数据：读 src/memes/<slug>/<slug>.md，转成模板可用的数据。
// 说明：本文件位于 src/_data，与 scripts/loader.mjs 是「同一规格的两处读取」——
// loader.mjs 供命令行校验使用，这里供 Eleventy 使用；两者都依赖 scripts/schema.mjs 的字段定义。
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const MEMES_DIR = path.resolve(import.meta.dirname, "../memes");

export default function () {
  const memes = [];
  for (const entry of fs.readdirSync(MEMES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const slug = entry.name;
    const file = path.join(MEMES_DIR, slug, `${slug}.md`);
    if (!fs.existsSync(file)) {
      throw new Error(`${slug}：缺少词条文件 src/memes/${slug}/${slug}.md`);
    }
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    if (String(data.slug) !== slug) {
      throw new Error(`${slug}：front matter 里的 slug "${data.slug}" 与目录名不一致`);
    }
    const links = [...content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => ({
      title: m[1],
      url: m[2],
      host: (() => {
        try {
          return new URL(m[2]).hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      })(),
    }));
    const labels = data.labels ?? [];
    memes.push({
      ...data,
      slug,
      labels,
      body: content,
      sources: links,
      sourceCount: links.length,
      // 正文首个非标题段落 = 一句话定义，用于卡片与 meta description
      summary:
        content
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith(">")) ?? "",
    });
  }
  return memes.sort((a, b) => a.title.localeCompare(b.title, "zh"));
}
