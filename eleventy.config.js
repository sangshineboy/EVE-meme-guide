// 站点数据：排序规则、集合、过滤器。
import fs from "node:fs";
import path from "node:path";
import site from "./src/_data/site.js";

// 梗排名（tools/gen-ranking.py 生成）：slug → { rank, tier, ... }
const ranking = JSON.parse(
  fs.readFileSync(new URL("./src/_data/ranking.json", import.meta.url), "utf8"),
);

export default function (eleventyConfig) {
  // 模板里拿到的可能是「全局数据对象」（src/_data/memes.js）或「Eleventy 页面对象」，
  // 两者字段位置不同（页面对象把 front matter 放在 .data 上，也没有 summary / sources）。
  // 这里统一成一份「完整词条数据」，并缓存，避免反复计算。
  const summaryOf = (raw) =>
    String(raw ?? "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith(">")) ?? "";
  const SITE_FIRST_YEAR = 2026;
  const SOURCE_URL_YEARS = {
    "https://evepc.baike.163.com/ziliao/66.html": 2014,
    "https://evepc.baike.163.com/ziliao/48.html": 2019,
    "https://game.xiaomi.com/viewpoint/1103611977_1654096587098_16": 2022,
    "https://www.bilibili.com/video/BV1dC4y1X7eP/": 2023,
    "https://www.bilibili.com/video/BV1pN4y1474K/": 2023,
  };
  const YEAR_RE = /(?<!\d)(200[3-9]|201\d|202[0-6])(?:\s*年|-(?:0[1-9]|1[0-2]))/g;
  const yearOf = (raw) => {
    const text = String(raw ?? "");
    const [beforeRef, refPart = ""] = text.split(/^## 参考文献/m);
    const years = [
      ...[...beforeRef.matchAll(YEAR_RE)].map((x) => Number(x[1])),
      ...[...refPart.matchAll(YEAR_RE)].map((x) => Number(x[1])),
    ];
    for (const [u, y] of Object.entries(SOURCE_URL_YEARS)) {
      if (refPart.includes(u)) years.push(y);
    }
    return years.length ? Math.min(...years) : SITE_FIRST_YEAR;
  };
  const cache = new WeakMap();
  const d = (m) => {
    if (!m || typeof m !== "object") return m;
    if (cache.has(m)) return cache.get(m);
    const data = m.data && m.data.slug ? m.data : m;
    const raw = m.rawInput ?? data.body ?? "";
    const rich = {
      ...data,
      summary: data.summary ?? summaryOf(m.rawInput),
      sources: data.sources ?? linksOf(m.rawInput),
      sourceCount: data.sourceCount ?? linksOf(m.rawInput).length,
      year: data.year ?? yearOf(raw),
    };
    cache.set(m, rich);
    return rich;
  };

  // 站点样式与脚本
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // 自定义域名：GitHub 要求产物里有 CNAME 文件，否则每次部署后自定义域名会被清掉。
  // 源文件放 src/CNAME，这里复制到 _site/CNAME。
  eleventyConfig.addPassthroughCopy({ "src/CNAME": "CNAME" });
  eleventyConfig.ignores.add("src/memes/*/sources-*.md");
  eleventyConfig.ignores.add("src/memes/_*");

  // 词条集合：素材文件与词条同目录，只收 <slug>.md
  eleventyConfig.addCollection("memes", (api) =>
    api
      .getFilteredByGlob("src/memes/*/*.md")
      .filter((p) => path.basename(p.inputPath, ".md") === p.data.slug)
      .sort((a, b) => a.data.title.localeCompare(b.data.title, "zh")),
  );

  // 按热度（播放量 + 引用数算出的名次）排序；没有名次的排最后
  eleventyConfig.addFilter("byRank", (memes) =>
    [...memes]
      .map(d)
      .sort(
        (a, b) =>
          (ranking[a.slug]?.rank ?? 999) - (ranking[b.slug]?.rank ?? 999) ||
          a.title.localeCompare(b.title, "zh"),
      ),
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

  // 热度档位 → 词条（夯 → 顶级 → 人上人 → NPC → 拉完了）
  eleventyConfig.addFilter("groupByTier", (memes) => {
    const ORDER = ["夯", "顶级", "人上人", "NPC", "拉完了"];
    const groups = new Map(ORDER.map((t) => [t, []]));
    for (const raw of memes) {
      const m = d(raw);
      const tier = ranking[m.slug]?.tier;
      if (tier && groups.has(tier)) groups.get(tier).push(m);
    }
    return ORDER.map((tier) => ({ tier, items: groups.get(tier) })).filter((g) => g.items.length);
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

  // 全部来源（出处总表用）：**按链接去重**，每条链接带上引用它的词条列表。
  // 之前是按「词条×链接」平铺，58 条词条引用同一个百科页就会出现 58 行一样的记录。
  eleventyConfig.addFilter("sourceIndex", (memes) => {
    const byUrl = new Map();
    for (const raw of memes) {
      const m = d(raw);
      for (const s of linksOf(rawOf(raw))) {
        const key = String(s.url).replace(/^https?:\/\//i, "").replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
        const cur = byUrl.get(key);
        if (!cur) byUrl.set(key, { ...s, memes: [m], titles: new Set([s.title]) });
        else {
          cur.titles.add(s.title);
          if (!cur.memes.some((x) => x.slug === m.slug)) cur.memes.push(m);
        }
      }
    }
    // 已知汇总页在出处总表中的统一标题（避免因各词条写成「第 N 条」而被降级成裸 URL）
    const CANONICAL_SOURCE_TITLES = {
      "evepc.baike.163.com/ziliao/66.html": "《EVE的各种梗》（163百科）",
      "evepc.baike.163.com/ziliao/48.html": "《游戏习语》（163百科）",
    };
    for (const [key, r] of byUrl.entries()) {
      if (CANONICAL_SOURCE_TITLES[key]) {
        r.title = CANONICAL_SOURCE_TITLES[key];
      } else if (r.titles.size > 1) {
        // 同一链接在正文与参考文献里写法不同时，保留信息最完整的标题
        r.title = [...r.titles].sort((a, b) => b.length - a.length)[0];
      } else {
        r.title = [...r.titles][0];
      }
      r.memes.sort((a, b) => a.title.localeCompare(b.title, "zh"));
    }
    return [...byUrl.values()].sort(
      (a, b) => a.host.localeCompare(b.host, "en") || a.title.localeCompare(b.title, "zh"),
    );
  });

  // 供筛选用的检索串（首页即时筛选）
  eleventyConfig.addFilter("searchKey", (raw) => {
    const m = d(raw);
      return [m.title, ...(m.aliases ?? []), m.category, m.scope, m.server, ...(m.labels ?? []), m.summary]
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
  //
  // `html: false`：正文一律不允许内联 HTML。
  // 词条正文是 AI 从公开网络抓取改写的，若混进 <img onerror=…> 或 <script>，
  // 经 meme.njk / base.njk 的 `| safe` 就会直出到全站——关掉这层渲染即从源头失效。
  // 需要内联 HTML 时（目前没有），改为在 schema 白名单里显式放行。
  eleventyConfig.amendLibrary("md", (md) => {
    md.set({ breaks: true, linkify: false, html: false });
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
