// 新建梗词条：从模板生成 src/memes/<slug>/<slug>.md 与 sources-<slug>.md
//
//   npm run new -- "遥修老李的蛋" --category 名场面 --confidence 社区流传
//   npm run new -- "Drake 能行" --slug drake-can-do --aliases "Drake,德雷克"
//
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, CONFIDENCE, SLUG_RE } from "./schema.mjs";
import { MEMES_DIR } from "./loader.mjs";
import "./runtime.mjs";

const args = process.argv.slice(2);
const title = args.find((a) => !a.startsWith("--"));
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

if (!title) {
  console.error(
    [
      "用法：npm run new -- \"<词条名>\" [--slug <slug>] [--category <分类>] [--confidence <等级>] [--aliases \"a,b\"] [--tags \"x,y\"]",
      `分类：${CATEGORIES.join(" / ")}`,
      `等级：${CONFIDENCE.join(" / ")}`,
    ].join("\n"),
  );
  process.exit(1);
}

// 中文标题没法直接转 slug，除非显式给 --slug，否则要求用户补一个
let slug = flag("slug");
if (!slug || !SLUG_RE.test(slug)) {
  console.error(
    `请用 --slug 给一个合法的英文 slug（小写字母、数字、连字符），例如：--slug yao-xiu-lao-li\n收到：${slug ?? "（空）"}`,
  );
  process.exit(1);
}

const category = flag("category", "社区文化");
const confidence = flag("confidence", "社区流传");
if (!CATEGORIES.includes(category)) {
  console.error(`分类 "${category}" 无效，只能是：${CATEGORIES.join(" / ")}`);
  process.exit(1);
}
if (!CONFIDENCE.includes(confidence)) {
  console.error(`等级 "${confidence}" 无效，只能是：${CONFIDENCE.join(" / ")}`);
  process.exit(1);
}

const dir = path.join(MEMES_DIR, slug);
if (fs.existsSync(dir)) {
  console.error(`${dir} 已存在：换一个 slug，或直接编辑现有词条。`);
  process.exit(1);
}

const listOf = (name) =>
  (flag(name) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const optLine = (key, values) =>
  values.length ? `${key}: [${values.map((v) => (v.includes(":") || v.includes("#") ? JSON.stringify(v) : v)).join(", ")}]` : null;

const today = new Date().toISOString().slice(0, 10);
const aliases = listOf("aliases");
const tags = listOf("tags");
const related = listOf("related");
const article = [
  "---",
  `slug: ${slug}`,
  `title: ${title.includes(":") ? JSON.stringify(title) : title}`,
  ...(optLine("aliases", aliases) ? [optLine("aliases", aliases)] : []),
  `category: ${category}`,
  `confidence: ${confidence}`,
  ...(optLine("tags", tags) ? [optLine("tags", tags)] : []),
  ...(optLine("related", related) ? [optLine("related", related)] : []),
  `updated_at: ${today}`,
  "---",
  "",
  `一句话说清这是什么，不超过 60 字。`,
  "",
  "## 这个梗",
  "",
  "它是什么、大家什么时候用。",
  "",
  "## 出处与来历",
  "",
  "来源交代一次，然后接着讲事。每条来源一个链接：",
  "",
  "- [来源标题](https://example.com/…) —— 站点或说明",
  "",
  "## 怎么用",
  "",
  "群聊、论坛、战报里怎么出现；典型句式可用引用行写。",
  "",
  "## 变体与近亲",
  "",
  "同一件事的其他叫法、上下游梗。",
  "",
  "## 为什么好笑",
  "",
  "一句到一段的锐评。",
  "",
].join("\n");

const material = [
  `# ${title} —— 取材记录`,
  "",
  `- 取材日期：${today}`,
  `- 证据等级：${confidence}`,
  `- 词条：src/memes/${slug}/${slug}.md`,
  "",
  "## 已核来源",
  "",
  "| 来源 | 读出什么 | 覆盖 / 缺口 |",
  "| --- | --- | --- |",
  "| [标题](https://example.com/…) | | |",
  "",
  "## 待核",
  "",
  "- ",
  "",
  "## 排除记录",
  "",
  "（搜过但没用上的、明确不属于本条的，写在这里，避免下轮重复搜。）",
  "",
].join("\n");

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `${slug}.md`), article);
fs.writeFileSync(path.join(dir, `sources-${slug}.md`), material);
console.log(`已创建 ${dir}`);
console.log(`  ${slug}.md           词条正文（先填一句话定义与来源）`);
console.log(`  sources-${slug}.md   取材记录`);
console.log("下一步：填内容 → npm run check → npm run build");
