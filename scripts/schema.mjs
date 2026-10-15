// 梗词条的唯一数据规格：字段、枚举与校验规则都在这里。
// 模板、校验脚本、新建脚本共用本文件，改规格只改这一处。

/** 允许的分类（正文与卡片、分类页共用） */
export const CATEGORIES = [
  "玩法",
  "机制",
  "舰船",
  "组织政治",
  "名场面",
  "社区文化",
  "历史事件",
  "舰长轶事",
];

/** 证据等级：只有两档，避免“大概也许”式含糊 */
export const CONFIDENCE = ["已确认", "社区流传"];

/** 适用范围：端游 / 手游（EVE 端游与「无尽银河」手游的梗不通用，必须分开标） */
export const SCOPES = ["端游", "手游", "通用"];

/** 服务器归属：国服（晨曦）/ 欧服（宁静）/ 未标（来源没交代服务器时不猜） */
export const SERVERS = ["国服", "欧服", "未标"];

/** 词条文件里必须出现的正文小节（第二项是“找不到就报错”的必填标记） */
export const REQUIRED_SECTIONS = ["这个梗", "出处与来历"];
export const OPTIONAL_SECTIONS = ["怎么用", "变体与近亲", "为什么好笑"];

/** front matter 允许的字段（白名单，多写或拼错即报错） */
export const FIELDS = {
  slug: "必填，小写字母数字连字符，必须与目录名一致",
  title: "必填，词条名（中文优先，英文原文可放括号里）",
  aliases: "可选，别名 / 英文原词 / 常见变体，字符串列表",
  category: `必填，取值只能是：${CATEGORIES.join(" / ")}`,
  confidence: `必填，取值只能是：${CONFIDENCE.join(" / ")}`,
  scope: `必填，取值只能是：${SCOPES.join(" / ")}（端游 / 手游「无尽银河」/ 通用）`,
  server: `必填，取值只能是：${SERVERS.join(" / ")}（来源没交代服务器就写 未标，不要猜）`,
  labels: "可选，标签列表（不能含 / \\ ? # %）。注意：字段名用 labels，不要用 tags——Eleventy 会用 tags 建集合",
  related: "可选，相关词条 slug 列表",
  updated_at: "可选，YYYY-MM-DD，本次取材核对日期",
};

export const TAG_FORBIDDEN = /[/\\?#%]/;

/**
 * front matter 里的日期可能被 YAML 解析成 Date 对象（`2026-10-13` 无引号即如此），
 * 所以这里统一先归一化成 YYYY-MM-DD 字符串再校验。
 */
export function normalizeDate(v) {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? String(v) : v.toISOString().slice(0, 10);
  return String(v);
}

export const isStringList = (v) =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x.trim());

export const isOptionalStringList = (v) =>
  v == null || (Array.isArray(v) && v.every((x) => typeof x === "string" && x.trim()));

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 校验一条正文里的来源清单。
 * 正文「出处与来历」小节必须至少有一个 Markdown 链接，形如：
 *   - [标题](https://…) —— 媒体/站点/文件
 * 链接数 = 来源条数，正文里没有链接就说明没留出处。
 */
export function countSourceLinks(body) {
  return (body.match(/\]\(https?:\/\/[^)\s]+\)/g) ?? []).length;
}

/** 从正文抽取小节标题（`## 标题`） */
export function sectionsOf(body) {
  return [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1].trim());
}

/**
 * 校验单个词条的 front matter 与正文。
 * @returns {string[]} 错误信息（不含文件路径前缀）
 */
export function validateEntry({ data, body, slug, files = [] }) {
  const errs = [];

  for (const key of Object.keys(data)) {
    if (!(key in FIELDS)) {
      errs.push(`未知字段 "${key}"（允许的字段：${Object.keys(FIELDS).join(", ")}）`);
    }
  }

  if (!data.slug) errs.push("缺少 slug");
  else if (!SLUG_RE.test(data.slug)) errs.push(`slug "${data.slug}" 只能用小写字母、数字和连字符`);
  else if (data.slug !== slug) errs.push(`slug "${data.slug}" 与目录名 "${slug}" 不一致`);

  if (!data.title || typeof data.title !== "string") errs.push("缺少 title（字符串）");
  if (!CATEGORIES.includes(data.category)) {
    errs.push(`category "${data.category ?? ""}" 无效（只能是 ${CATEGORIES.join(" / ")}）`);
  }
  if (!CONFIDENCE.includes(data.confidence)) {
    errs.push(`confidence "${data.confidence ?? ""}" 无效（只能是 ${CONFIDENCE.join(" / ")}）`);
  }
  if (!SCOPES.includes(data.scope)) {
    errs.push(`scope "${data.scope ?? ""}" 无效（只能是 ${SCOPES.join(" / ")}）`);
  }
  if (!SERVERS.includes(data.server)) {
    errs.push(`server "${data.server ?? ""}" 无效（只能是 ${SERVERS.join(" / ")}）`);
  }
  if (data.aliases != null && !isStringList(data.aliases)) errs.push("aliases 必须是字符串列表");
  if (data.related != null && !isOptionalStringList(data.related)) errs.push("related 必须是字符串列表");
  const updated = normalizeDate(data.updated_at);
  if (updated != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(updated))) {
    errs.push("updated_at 必须是 YYYY-MM-DD");
  }
  if (data.labels != null) {
    if (!isStringList(data.labels)) errs.push("labels 必须是字符串列表");
    else if (data.labels.some((t) => TAG_FORBIDDEN.test(t))) errs.push("标签里不能含 / \\ ? # % 字符");
  }

  // 正文结构
  const sections = sectionsOf(body);
  for (const want of REQUIRED_SECTIONS) {
    if (!sections.includes(want)) errs.push(`正文缺少必填小节 "## ${want}"`);
  }
  for (const s of sections) {
    if (!REQUIRED_SECTIONS.includes(s) && !OPTIONAL_SECTIONS.includes(s)) {
      errs.push(`未知小节 "## ${s}"（只能是 ${[...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS].join(" / ")}）`);
    }
  }

  // 一句话定义：正文第一段必须存在，且不超过 60 字
  const firstPara = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith(">"));
  if (!firstPara) errs.push("正文缺少开头的一句话定义");
  else if (firstPara.length > 60) errs.push(`开头定义 ${firstPara.length} 字，超过 60 字上限`);

  // 出处
  const links = countSourceLinks(body);
  if (links === 0) errs.push("正文一个来源链接都没有：请在小节里写 - [标题](https://…)");

  // 目录内容
  const hasMaterial = files.some((f) => f === `sources-${slug}.md`);
  if (!hasMaterial) errs.push(`缺少素材文件 sources-${slug}.md（即便暂无外部来源，也要留一份取材记录）`);

  return errs;
}
