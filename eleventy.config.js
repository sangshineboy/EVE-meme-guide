// 站点数据：排序规则、集合、过滤器。
import path from "node:path";
import site from "./src/_data/site.js";

export default function (eleventyConfig) {
  // 模板里拿到的可能是「全局数据对象」（src/_data/memes.js）或「Eleventy 页面对象」，
  // 两者字段位置不同（页面对象把 front matter 放在 .data 上，也没有 summary / sources）。
  // 这里统一成一份「完整词条数据」，并缓存，避免反复计算。
  const summaryOf = (raw) =>
    String(raw ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith(">")) ?? "";
  const cache = new WeakMap();
  const d = (m) => {
    if (!m || typeof m !== "object") return m;
    if (cache.has(m)) return cache.get(m);
    const data = m.data && m.data.slug ? m.data : m;
    const rich = {
      ...data,
      summary: data.summary ?? summaryOf(m.rawInput),
      sources: data.sources ?? linksOf(m.rawInput),
      sourceCount: data.sourceCount ?? linksOf(m.rawInput).length,
    };
    cache.set(m, rich);
    return rich;
  };

  // 站点样式与脚本
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.ignores.add("src/memes/*/sources-*.md");
  eleventyConfig.ignores.add("src/memes/_*");

  // 词条集合：素材文件与词条同目录，只收 <slug>.md
  eleventyConfig.addCollection("memes", (api) =>
    api
      .getFilteredByGlob("src/memes/*/*.md")
      .filter((p) => path.basename(p.inputPath, ".md") === p.data.slug)
      .sort((a, b) => a.data.title.localeCompare(b.data.title, "zh")),
  );

  // 分类 → 词条，按 site.categoryOrder 排序
  eleventyConfig.addFilter("groupByCategory", (memes) => {
    const groups = new Map();
    for (const raw of memes) {
      const m = d(raw);
      if (!groups.has(m.category)) groups.set(m.category, []);
      groups.get(m.category).push(m);
    }
    return [...groups]
      .map(([category, items]) => ({ category, items }))
      .sort((a, b) => {
        const ia = site.categoryOrder.indexOf(a.category);
        const ib = site.categoryOrder.indexOf(b.category);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.category.localeCompare(b.category, "zh");
      });
  });

  // 证据等级 → 词条
  eleventyConfig.addFilter("groupByConfidence", (memes) => {
    const groups = new Map();
    for (const raw of memes) {
      const m = d(raw);
      if (!groups.has(m.confidence)) groups.set(m.confidence, []);
      groups.get(m.confidence).push(m);
    }
    return [...groups]
      .map(([confidence, items]) => ({ confidence, items }))
      .sort(
        (a, b) =>
          site.confidenceOrder.indexOf(a.confidence) - site.confidenceOrder.indexOf(b.confidence),
      );
  });

  // 适用范围（端游/手游/通用）→ 词条
  eleventyConfig.addFilter("groupByScope", (memes) => {
    const groups = new Map();
    for (const raw of memes) {
      const m = d(raw);
      if (!groups.has(m.scope)) groups.set(m.scope, []);
      groups.get(m.scope).push(m);
    }
    return [...groups]
      .map(([scope, items]) => ({ scope, items }))
      .sort((a, b) => site.scopeOrder.indexOf(a.scope) - site.scopeOrder.indexOf(b.scope));
  });

  // 服务器归属 → 词条
  eleventyConfig.addFilter("groupByServer", (memes) => {
    const groups = new Map();
    for (const raw of memes) {
      const m = d(raw);
      if (!groups.has(m.server)) groups.set(m.server, []);
      groups.get(m.server).push(m);
    }
    return [...groups]
      .map(([server, items]) => ({ server, items }))
      .sort((a, b) => site.serverOrder.indexOf(a.server) - site.serverOrder.indexOf(b.server));
  });

  // 全部别名（黑话索引页用）
  eleventyConfig.addFilter("aliasIndex", (memes) => {
    const rows = [];
    for (const raw of memes) {
      const m = d(raw);
      for (const alias of m.aliases ?? []) rows.push({ alias, meme: m });
    }
    return rows.sort((a, b) => a.alias.localeCompare(b.alias, "zh"));
  });

  // 从词条正文里抽来源链接（页面对象上没有现成的 sources，统一用这个过滤器算）
  const linksOf = (raw) =>
    [...String(raw ?? "").matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => ({
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
  eleventyConfig.addFilter("sourceLinks", (raw) => linksOf(raw));
  // 全局数据对象上已经算好 sources；页面对象则回退到原始 Markdown
  const rawOf = (m) =>
    typeof m === "string" ? m : (m?.sources ? "" : (m?.rawInput ?? m?.templateContent ?? ""));
  eleventyConfig.addFilter("sourceCount", (m) =>
    typeof m === "object" && Array.isArray(m?.sources) ? m.sources.length : linksOf(rawOf(m)).length,
  );

  // 全部来源（出处总表用）
  eleventyConfig.addFilter("sourceIndex", (memes) => {
    const rows = [];
    for (const raw of memes) {
      const m = d(raw);
      for (const s of linksOf(rawOf(raw))) rows.push({ ...s, meme: m });
    }
    return rows.sort(
      (a, b) => a.host.localeCompare(b.host, "en") || a.meme.title.localeCompare(b.meme.title, "zh"),
    );
  });

  // 供筛选用的检索串（首页即时筛选）
  eleventyConfig.addFilter("searchKey", (raw) => {
    const m = d(raw);
    return [m.title, ...(m.aliases ?? []), m.category, m.confidence, m.scope, m.server, ...(m.labels ?? []), m.summary]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  });

  // 词条 slug 列表（随机页用）
  eleventyConfig.addFilter("slugsOf", (memes) => memes.map((m) => m.slug ?? d(m).slug));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));

  // 标签网址：Eleventy 内置 slugify 不带 lang 时会把中文清空，导致所有中文标签落到同一网址；
  // 这里用码点拼 slug（「欧服」→ 27431-26381），ASCII 标签保持原样可读。
  eleventyConfig.addFilter("tagSlug", (tag) =>
    [...String(tag)]
      .map((ch) => (/[A-Za-z0-9]/.test(ch) ? ch.toLowerCase() : ch.codePointAt(0)))
      .join("-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, ""),
  );

  eleventyConfig.addFilter("formatDate", (iso) => {
    if (!iso) return "";
    return iso instanceof Date ? iso.toISOString().slice(0, 10) : String(iso);
  });
  // 取网址的站点名（出处总表用）
  eleventyConfig.addFilter("hostname", (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  });

  // Markdown 渲染设置。
  // 注意：Eleventy 默认给的是 markdown-it 的 "default" preset，**不含**表格、删除线、
  // 也不开 `breaks`——不显式设置的话，中文写作里「单个换行即换行」的习惯会失效，
  // 一行一句的引用/口诀会被合并成一段。这里显式打开。
  eleventyConfig.amendLibrary("md", (md) => {
    md.set({ breaks: true, linkify: false, html: true });
    md.enable(["table", "strikethrough"]);
  });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    // GitHub Pages 项目站点挂在 /<仓库名>/ 下，由 CI 通过环境变量传入
    pathPrefix: process.env.PATH_PREFIX || "/",
    // Markdown 正文不经过模板引擎，作者写 {{ }} 之类字符不会出错
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
  };
}
