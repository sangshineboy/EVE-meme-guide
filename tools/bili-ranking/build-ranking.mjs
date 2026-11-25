/**
 * B 站全历史热门 EVE 视频统计与导出脚本
 *
 * 用法：
 *   1) 从本地快照生成 Excel 榜单 + Markdown 摘要 + weekly-production episode.json：
 *      node tools/bili-ranking/build-ranking.mjs [--input 参考文献/B站热门EVE视频/videos-snapshot.json]
 *
 *   2) 联网采集 B 站公开接口（严格遵守联网纪律：串行 >=3 秒间隔，单轮上限 20 次请求，遇 403/412/429 立即停）：
 *      node tools/bili-ranking/build-ranking.mjs --fetch [--budget 20]
 *      （如无 Cookie 触发 412，可设置环境变量 BILI_COOKIE 后重试，或用浏览器导出 videos-snapshot.json）
 *
 * 输出目录：参考文献/B站热门EVE视频/
 *   - B站热门EVE视频榜-全历史.xlsx
 *   - B站热门EVE视频榜-全历史.md
 *   - episode.json（兼容 weekly-production/episode-v1）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RULE_VERSION,
  classifyPlatform,
  isRelevantEveVideo,
  rankWorks,
} from "./score.mjs";
import { writeXlsx } from "./xlsx-writer.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "参考文献", "B站热门EVE视频");
const DEFAULT_SNAPSHOT = path.join(OUT_DIR, "videos-snapshot.json");
const FETCH_LOG = path.join(OUT_DIR, "fetch-log.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function beijingIso(date = new Date()) {
  const shifted = new Date(date.getTime() + 8 * 3600 * 1000);
  return shifted.toISOString().replace("Z", "+08:00");
}

function beijingYmd(unixSec) {
  if (!unixSec) return "";
  const shifted = new Date(unixSec * 1000 + 8 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function stripEm(s) {
  return String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 严格限速的 B 站公开接口采集（遇 403/412/429 立即停止并留档） */
async function fetchFromBilibili({ snapshotPath, budget = 20, keywords }) {
  const existing = fs.existsSync(snapshotPath)
    ? JSON.parse(fs.readFileSync(snapshotPath, "utf8"))
    : { observed_at: "", works: [] };
  const byBvid = new Map((existing.works || []).map((w) => [w.bvid, w]));

  const headers = {
    "User-Agent": UA,
    Referer: "https://www.bilibili.com/",
    Accept: "application/json, text/plain, */*",
  };
  if (process.env.BILI_COOKIE) headers.Cookie = process.env.BILI_COOKIE;

  let used = 0;
  let blocked = null;
  const logEntries = [];

  async function reqJson(url) {
    if (used >= budget) return { stop: "budget" };
    if (used > 0) await sleep(3200);
    used++;
    const ts = beijingIso();
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    logEntries.push({ time: ts, url, status: res.status });
    if (res.status === 403 || res.status === 412 || res.status === 429) {
      blocked = { time: ts, url, status: res.status };
      return { stop: "blocked", status: res.status };
    }
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      blocked = { time: ts, url, status: res.status, reason: "非 JSON 响应（疑似风控页）" };
      return { stop: "blocked", status: res.status };
    }
    if (json.code === -352 || json.code === -412 || json.code === -799) {
      blocked = { time: ts, url, status: res.status, code: json.code, message: json.message };
      return { stop: "blocked", code: json.code };
    }
    return { data: json };
  }

  const candidateBvids = [];
  const seenCand = new Set();

  for (const kw of keywords) {
    const searchUrl =
      "https://api.bilibili.com/x/web-interface/wbi/search/type?" +
      new URLSearchParams({
        search_type: "video",
        keyword: kw,
        order: "click", // 最多播放
        page: "1",
        page_size: "30",
      }).toString();

    const r = await reqJson(searchUrl);
    if (r.stop) break;
    const list = r.data?.data?.result || [];
    for (const v of list) {
      const bvid = v.bvid;
      if (!bvid || seenCand.has(bvid)) continue;
      const meta = { title: stripEm(v.title), desc: stripEm(v.description), tname: v.typename || "" };
      if (!isRelevantEveVideo(meta)) continue;
      seenCand.add(bvid);
      candidateBvids.push(bvid);
    }
  }

  for (const bvid of candidateBvids) {
    if (blocked || used >= budget) break;
    if (byBvid.has(bvid)) continue; // 断点续抓：已拉过的跳过
    const viewUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
    const r = await reqJson(viewUrl);
    if (r.stop) break;
    const d = r.data?.data;
    if (!d || !d.stat) continue;
    const nowIso = beijingIso();
    const title = stripEm(d.title);
    const desc = stripEm(d.desc);
    const tname = d.tname || "";
    const platform = classifyPlatform({ title, desc, tname });
    byBvid.set(bvid, {
      bvid: d.bvid,
      aid: d.aid,
      title,
      author: d.owner?.name || "",
      tname,
      platform,
      source_url: `https://www.bilibili.com/video/${d.bvid}/`,
      published_at: d.pubdate ? beijingIso(new Date(d.pubdate * 1000)) : "",
      published_date: beijingYmd(d.pubdate),
      observed_at: nowIso,
      duration: Number(d.duration || 0),
      partCount: Number(d.videos || 1),
      view: Number(d.stat.view),
      reply: Number(d.stat.reply),
      danmaku: Number(d.stat.danmaku),
      favorite: Number(d.stat.favorite),
      coin: Number(d.stat.coin),
      like: Number(d.stat.like),
      share: Number(d.stat.share),
      desc: desc.slice(0, 200),
    });
  }

  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  const payload = {
    rule_version: RULE_VERSION,
    scope: "全历史累计（端游 + 手游《无烬星河》）",
    observed_at: beijingIso(),
    works: [...byBvid.values()],
  };
  fs.writeFileSync(snapshotPath, JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(
    FETCH_LOG,
    JSON.stringify({ used, budget, blocked, entries: logEntries }, null, 2),
    "utf8",
  );

  if (blocked) {
    console.error(
      `[联网纪律触发停止] ${blocked.time} ${blocked.url} status=${blocked.status}` +
        (blocked.code ? ` code=${blocked.code}` : "") +
        (blocked.reason ? ` (${blocked.reason})` : "") +
        "。请至少冷却 30 分钟后再恢复，或改用浏览器导出快照。",
    );
  }
  return payload;
}

/** 构造兼容 weekly-production/episode-v1 的数据包模板 */
export function buildEpisodeJson(ranked, { observedAt, limit = 25 } = {}) {
  const top = ranked.slice(0, limit);
  const now = observedAt || beijingIso();
  return {
    schema: "weekly-production/episode-v1",
    id: `eve-alltime-${now.slice(0, 10)}`,
    title: "EVE B 站全历史热门视频榜（端游＋手游）",
    period: {
      begin: "2006-06-01T00:00:00+08:00",
      end: now,
      timezone: "Asia/Shanghai",
    },
    metric_basis: "cumulative",
    rule_version: RULE_VERSION,
    works: top.map((w) => ({
      rank: w.rank,
      score: w.calc.score,
      bvid: w.bvid,
      title: w.title,
      short_title: w.title.slice(0, 28),
      author: w.author || "",
      platform: w.platform || "待核",
      source_url: w.source_url || `https://www.bilibili.com/video/${w.bvid}/`,
      published_at: w.published_at || "",
      observed_at: w.observed_at || now,
      part_count: w.partCount ?? w.part_count ?? 1,
      metrics: {
        view: w.view,
        reply: w.reply,
        danmaku: w.danmaku,
        favorite: w.favorite,
        coin: w.coin,
        like: w.like ?? 0,
        share: w.share ?? 0,
      },
      // 占位字段：使用 weekly-production 剪片时再填入本地原片与片段起止秒
      video: `videos/${w.bvid}.mp4`,
      clip: { start: 0, end: Math.min(30, Number(w.duration || 30)) },
    })),
    copy: {
      subtitle: "收录 B 站全历史高热 EVE 端游与手游《无烬星河》视频，按周刊 #852 累计综合得分排序。",
      outro: "数据快照归档于 EVE 梗指南参考文献库，点击标题前往 B 站支持原作者。",
    },
    music: {
      file: "audio/bgm.flac",
      title: "待填入本地 BGM",
      artist: "",
      source: "",
    },
    branding: {
      producer: "EVE 梗指南",
      site_name: "EVE 梗指南",
      site_url: "https://sangshineboy.github.io/EVE-meme-guide/",
    },
  };
}

function toSheetRows(list) {
  const header = [
    "名次",
    "综合得分",
    "平台",
    "BV号",
    "标题",
    "UP主",
    "发布日期",
    "分P",
    "播放(V)",
    "评论(R)",
    "弹幕(M)",
    "收藏(F)",
    "投币(K)",
    "点赞",
    "分享",
    "系数P",
    "系数A",
    "系数B",
    "系数C",
    "系数D",
    "观测时间",
    "链接",
  ];
  const body = list.map((w, i) => [
    i + 1,
    w.calc.score,
    w.platform || "待核",
    w.bvid,
    w.title,
    w.author || "",
    w.published_date || (w.published_at || "").slice(0, 10),
    w.partCount ?? w.part_count ?? 1,
    w.view,
    w.reply,
    w.danmaku,
    w.favorite,
    w.coin,
    w.like ?? "",
    w.share ?? "",
    w.calc.P,
    Number(w.calc.A.toFixed(4)),
    w.calc.B,
    w.calc.C,
    w.calc.D,
    w.observed_at || "",
    w.source_url || `https://www.bilibili.com/video/${w.bvid}/`,
  ]);
  return [header, ...body];
}

const SHEET_WIDTHS = [6, 12, 8, 15, 42, 16, 12, 6, 12, 10, 10, 10, 10, 10, 10, 8, 8, 8, 8, 8, 22, 42];

function exportAll(snapshot, { filterNoise = true } = {}) {
  const valid = [];
  const skipped = [];
  const excluded = [];
  const seen = new Set();
  for (const raw of snapshot.works || []) {
    if (!raw?.bvid || seen.has(raw.bvid)) continue;
    seen.add(raw.bvid);
    if (filterNoise && !isRelevantEveVideo(raw)) {
      excluded.push({ bvid: raw.bvid, title: raw.title || "", reason: "非 EVE 游戏相关（自动去噪）" });
      continue;
    }
    const item = {
      ...raw,
      platform: raw.platform || classifyPlatform(raw),
      partCount: raw.partCount ?? raw.part_count ?? raw.videos ?? 1,
    };
    try {
      // 预校验指标完整性
      rankWorks([item]);
      valid.push(item);
    } catch (err) {
      skipped.push({ bvid: raw.bvid || "?", title: raw.title || "", reason: err.message });
    }
  }

  const rankedAll = rankWorks(valid);
  const rankedPc = rankedAll.filter((w) => w.platform === "端游");
  const rankedMobile = rankedAll.filter((w) => w.platform === "手游");
  const observedAt = snapshot.observed_at || beijingIso();

  // 1) Excel 榜单
  const xlsxPath = path.join(OUT_DIR, "B站热门EVE视频榜-全历史.xlsx");
  const metaRows = [
    ["项目", "说明"],
    ["规则版本", RULE_VERSION],
    ["口径", "全历史累计指标（端游 EVE Online + 手游《无烬星河》）"],
    ["计分公式", "S = (V*P*A + R*B*50 + K*C*20 + F*C) * D（点赞/分享单列展示，不参与计分）"],
    ["舍入与同分", "十进制 ROUND_HALF_UP（P/D 三位，B/C 两位，A 不提前舍入，S 取整）；同分按 BV 号字典升序"],
    ["数据观测时间", observedAt],
    ["有效入榜数", rankedAll.length],
    ["端游数", rankedPc.length],
    ["手游数", rankedMobile.length],
    ["待核平台数", rankedAll.filter((w) => w.platform === "待核").length],
    ["缺指标未排数", skipped.length],
    ["自动排除噪音数", excluded.length],
  ];
  writeXlsx(xlsxPath, [
    { name: "总榜", rows: toSheetRows(rankedAll), widths: SHEET_WIDTHS },
    { name: "端游榜", rows: toSheetRows(rankedPc), widths: SHEET_WIDTHS },
    { name: "手游榜", rows: toSheetRows(rankedMobile), widths: SHEET_WIDTHS },
    { name: "口径与计分说明", rows: metaRows, widths: [18, 80] },
  ]);

  // 2) Markdown 摘要（可直接供 npm run rag 检索）
  const mdPath = path.join(OUT_DIR, "B站热门EVE视频榜-全历史.md");
  const fmt = (n) => (typeof n === "number" ? n.toLocaleString("en-US") : "—");
  const mdLines = [
    "# B 站热门 EVE 视频榜（全历史累计）",
    "",
    `> 规则版本：\`${RULE_VERSION}\`（周刊哔哩哔哩排行榜 #852 综合公式）`,
    `> 范围：端游 EVE Online + 手游《无烬星河》 · 数据观测时间：${observedAt}`,
    `> 共收录 **${rankedAll.length}** 条有效作品（端游 ${rankedPc.length} · 手游 ${rankedMobile.length} · 待核 ${rankedAll.filter((w) => w.platform === "待核").length}）`,
    "",
    "## 总榜",
    "",
    "| 名次 | 综合得分 | 平台 | 标题 | UP主 | 发布日期 | 播放 | 评论 | 弹幕 | 收藏 | 投币 | 点赞 | 链接 |",
    "| --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rankedAll.map(
      (w) =>
        `| ${w.rank} | ${fmt(w.calc.score)} | ${w.platform} | ${String(w.title).replace(/\|/g, "\\|")} | ${String(w.author || "").replace(/\|/g, "\\|")} | ${w.published_date || (w.published_at || "").slice(0, 10)} | ${fmt(w.view)} | ${fmt(w.reply)} | ${fmt(w.danmaku)} | ${fmt(w.favorite)} | ${fmt(w.coin)} | ${fmt(w.like)} | [${w.bvid}](${w.source_url || `https://www.bilibili.com/video/${w.bvid}/`}) |`,
    ),
    "",
  ];
  if (skipped.length) {
    mdLines.push("## 未参与排名的记录（缺必需计分指标）", "");
    for (const s of skipped) mdLines.push(`- ${s.bvid} ${s.title}：${s.reason}`);
    mdLines.push("");
  }
  fs.writeFileSync(mdPath, mdLines.join("\n"), "utf8");

  // 3) weekly-production episode.json 模板
  const epPath = path.join(OUT_DIR, "episode.json");
  fs.writeFileSync(
    epPath,
    JSON.stringify(buildEpisodeJson(rankedAll, { observedAt }), null, 2),
    "utf8",
  );

  console.log(
    `已输出：\n  - ${path.relative(ROOT, xlsxPath)}\n  - ${path.relative(ROOT, mdPath)}\n  - ${path.relative(ROOT, epPath)}\n` +
      `合计入榜 ${rankedAll.length} 条（端游 ${rankedPc.length} / 手游 ${rankedMobile.length}），排除噪音 ${excluded.length} 条，跳过缺指标 ${skipped.length} 条。`,
  );
}

/* ---------- CLI 入口 ---------- */
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const doFetch = args.includes("--fetch");
  const filterNoise = !args.includes("--no-filter");
  const inputIdx = args.indexOf("--input");
  const snapshotPath = inputIdx >= 0 && args[inputIdx + 1] ? path.resolve(args[inputIdx + 1]) : DEFAULT_SNAPSHOT;
  const budgetIdx = args.indexOf("--budget");
  const budget = budgetIdx >= 0 ? Number(args[budgetIdx + 1] || 20) : 20;

  let snapshot;
  if (doFetch) {
    snapshot = await fetchFromBilibili({
      snapshotPath,
      budget,
      keywords: ["EVE Online", "EVE 星战前夜", "EVE 无烬星河"],
    });
  } else {
    if (!fs.existsSync(snapshotPath)) {
      console.error(`找不到快照文件：${snapshotPath}\n请先运行 --fetch 采集，或按 参考文献/B站热门EVE视频/README.md 从浏览器导出快照。`);
      process.exit(1);
    }
    snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  }
  exportAll(snapshot, { filterNoise });
}
