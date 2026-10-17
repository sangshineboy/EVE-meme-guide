// 通用种子工具：按数据数组批量生成词条文件。
// 用法：node tools/seed.mjs <批次文件.mjs>
// 批次文件默认导出 { today, entries: [...] }，条目字段见下方 build 函数。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const memes = path.join(root, "src/memes");

export function build(entries, today) {
  // YAML 会把 425、68.75e 这类值解析成数字/科学计数，别名一律用引号包起来
  const q = (s) => JSON.stringify(String(s));
  let n = 0;
  for (const e of entries) {
    const dir = path.join(memes, e.slug);
    fs.mkdirSync(dir, { recursive: true });
    const doc = [
      "---",
      `slug: ${e.slug}`,
      `title: ${/[:"#]/.test(e.title) ? JSON.stringify(e.title) : e.title}`,
      `aliases: [${(e.aliases ?? []).map(q).join(", ")}]`,
      `category: ${e.category}`,
      `confidence: ${e.confidence}`,
      `scope: ${e.scope ?? "端游"}`,
      `server: ${e.server}`,
      ...(e.related?.length ? [`related: [${e.related.join(", ")}]`] : []),
      `labels: [${(e.labels ?? []).join(", ")}]`,
      `updated_at: ${today}`,
      "---",
      "",
      e.intro,
      "",
      "## 这个梗",
      "",
      e.body,
      "",
      "## 出处与来历",
      "",
      ...(e.note ? [e.note, ""] : []),
      ...(e.links ?? []).map(([t, u]) => `- [${t}](${u})`),
      "",
      ...(e.quotes?.length
        ? ["原帖原文（本轮通过贴吧客户端接口读取）：", "", ...e.quotes.map(([who, q]) => `> 【${who}】${q}`), ""]
        : []),
    ];
    for (const [h, t] of e.extra ?? []) doc.push(`## ${h}`, "", t, "");
    fs.writeFileSync(path.join(dir, `${e.slug}.md`), doc.join("\n"));

    fs.writeFileSync(
      path.join(dir, `sources-${e.slug}.md`),
      [
        `# ${e.title} —— 取材记录`,
        "",
        `- 取材日期：${today} ｜ 证据等级：${e.confidence} ｜ ${e.scope ?? "端游"} / ${e.server}`,
        "- 来源政策：禁止引用任何第三方整理仓库；只记公开网页与公开数据接口可核内容",
        "",
        "## 已核来源",
        "",
        "| 来源 | 链接 | 读出什么 | 缺口 |",
        "| --- | --- | --- | --- |",
        ...(e.links ?? []).map(([t, u]) => `| ${t} | ${u} | 见正文 | — |`),
        "",
        "## 说明",
        "",
        ...(e.material ?? []).map((m) => `- ${m}`),
        "",
        "## 排除记录",
        "",
        "- 未采用任何第三方整理站的内容（含被禁止引用的那个仓库）。",
        "",
      ].join("\n"),
    );
    n++;
    console.log(`写入 ${e.slug}`);
  }
  return n;
}

// 直接运行时：加载批次文件并生成
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const batchFile = process.argv[2];
  if (!batchFile) {
    console.error("用法：node tools/seed.mjs <批次文件.mjs>");
    process.exit(1);
  }
  // Windows 下动态 import 必须用 file:// URL
  const batch = await import(pathToFileURL(path.resolve(batchFile)).href);
  const cfg = batch.default ?? batch;
  const n = build(cfg.entries, cfg.today ?? new Date().toISOString().slice(0, 10));
  console.log(`共 ${n} 条`);
}
