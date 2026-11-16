// 新建梗词条：从模板生成 src/memes/<slug>/<slug>.md 与 sources-<slug>.md
//
//   npm run new -- "Drake 能行" --slug drake-can-do --aliases "Drake,德雷克"
//
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, SCOPES, SERVERS, SLUG_RE } from "./schema.mjs";
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
      "用法：npm run new -- \"<词条名>\" [--slug <slug>] [--category <分类>] [--scope <端游|手游|通用>] [--server <国服|欧服|未标>] [--aliases \"a,b\"] [--labels \"x,y\"]",
      `分类：${CATEGORIES.join(" / ")}`,
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
if (!CATEGORIES.includes(category)) {
  console.error(`分类 "${category}" 无效，只能是：${CATEGORIES.join(" / ")}`);
  process.exit(1);
}

// scope / server 是必填字段，必须显式给——此前生成的骨架漏了这两个，产物过不了 check
const scope = flag("scope", "端游");
const server = flag("server", "未标");
if (!SCOPES.includes(scope)) {
  console.error(`适用范围 "${scope}" 无效，只能是：${SCOPES.join(" / ")}`);
  process.exit(1);
}
if (!SERVERS.includes(server)) {
  console.error(`服务器 "${server}" 无效，只能是：${SERVERS.join(" / ")}`);
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
// 一律 JSON.stringify：双引号是合法 YAML，且不会被 `#` `:` 之类的字符截断
const optLine = (key, values) =>
  values.length ? `${key}: [${values.map((v) => JSON.stringify(v)).join(", ")}]` : null;

const today = new Date().toISOString().slice(0, 10);
const aliases = listOf("aliases");
const labels = listOf("labels");
const related = listOf("related");
const article = [
  "---",
  `slug: ${slug}`,
  `title: ${JSON.stringify(title)}`,
  ...(optLine("aliases", aliases) ? [optLine("aliases", aliases)] : []),
  `category: ${category}`,
  `scope: ${scope}`,
  `server: ${server}`,
  ...(optLine("labels", labels) ? [optLine("labels", labels)] : []),
  ...(optLine("related", related) ? [optLine("related", related)] : []),
  `updated_at: ${today}`,
  "---",
  "",
  `一句话说清这是什么，不超过 60 字。`,
  "",
  "## 定义",
  "",
  "它是什么：性质、指向、边界。先讲人和事，再解释。",
  "",
  "## 溯源",
  "",
  "它从哪来：谁、在哪、什么时候、原话怎么说的。",
  "",
  "## 用法",
  "",
  "圈里怎么用、什么时候说。没有就删掉这一节。",
  "",
  "## 演变",
  "",
  "同一件事的其他叫法、上下游梗。没有就删掉这一节。",
  "",
  "## AI吐槽",
  "",
  "一到三句锐评，只能基于上文事实，不新增人名、数字、时间。",
  "",
  "（AI 观点，不构成事实陈述。）",
  "",
  "## 参考文献",
  "",
  "来源交代一次，然后接着讲事。每条来源一个链接：",
  "",
  "- [来源标题](https://example.com/…) —— 站点或说明",
  "",
].join("\n");

const material = [
  `# ${title} —— 取材记录`,
  "",
  `- 取材日期：${today}`,
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
