// B 站取材工具：搜索视频、读视频详情与评论。
//
//   node tools/bili.mjs search "EVE 梗" [页数]
//   node tools/bili.mjs video BV1xx... [评论页数]
//   node tools/bili.mjs replies <aid或BV号> [页数]
//
// 纪律（沿用项目取材手册）：
//   · 只走公开数据接口，不碰需要登录态的接口（用户投稿接口当前返回 412，不做绕过）
//   · 串行 + 每次请求间隔 3 秒；预算：默认单次运行不超过 20 次请求
//   · 命中的内容输出到 stdout，供人工提炼进词条素材；不自动写仓库
import { createHash } from "node:crypto";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REFERER = "https://www.bilibili.com";
const GAP = 3000;
const BUDGET = 20;

let used = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, params, { signed = false } = {}) {
  if (used >= BUDGET) throw new Error(`预算用尽（${BUDGET} 次）；未查部分记为覆盖缺口`);
  if (used > 0) await sleep(GAP);
  used++;
  const url = new URL(path, "https://api.bilibili.com");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  if (signed) {
    const q = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    url.searchParams.set("wts", String(Math.floor(Date.now() / 1000)));
    const query = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    // 无 cookie 时 wbi 签名只影响返回完整性；本项目不做登录态，故按公开参数直取
    void q; void query;
  }
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: REFERER, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`非 JSON 响应（HTTP ${res.status}）`);
  if (json.code !== 0) throw new Error(`code ${json.code} ${json.message ?? ""}`);
  return json.data;
}

const stripEm = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
const ymd = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "?");

const cmd = process.argv[2];
const arg = process.argv[3];
const extra = Number(process.argv[4] || 1);

if (cmd === "search") {
  const pages = Math.max(1, Math.min(extra || 1, 3));
  for (let pn = 1; pn <= pages; pn++) {
    const data = await api("/x/web-interface/wbi/search/type", {
      search_type: "video",
      keyword: arg,
      page: pn,
      page_size: 30,
    });
    console.log(`\n===== 搜索「${arg}」第 ${pn} 页（共 ${data.numResults ?? "?"} 条） =====`);
    for (const v of data.result ?? []) {
      console.log(
        [
          `[${v.bvid}]`,
          stripEm(v.title),
          `｜UP ${v.author}`,
          `｜播放 ${v.play}`,
          `｜弹幕 ${v.video_review ?? "?"}`,
          `｜评论 ${v.review ?? "?"}`,
          `｜${ymd(v.pubdate)}`,
          `｜aid ${v.aid}`,
        ].join(" "),
      );
    }
  }
} else if (cmd === "collect") {
  // 批量：依次搜索多个关键词 → 关键词过滤 → 拉详情与热评，输出可直接进素材的摘要。
  const keywords = (arg ?? "").split("|").filter(Boolean);
  if (!keywords.length) {
    console.error("用法：node tools/bili.mjs collect \"EVE 黑话|EVE 梗|EVE名场面\" [每个关键词抓取的视频数=2]");
    process.exit(1);
  }
  const perKeyword = Math.max(1, Math.min(extra || 2, 4));
  // 排除明显无关的（vtuber「Eve」、其他游戏、卖号招人等）
  const NOISE = /(eve'?s room|ideal\s*-?\s*eve|cos|女仆|马尔福|真白花音|梗百科|乔妹|小狗|交友|自走棋|手游|婚礼|恋爱|虚拟主播|vtuber)/i;
  const seen = new Set();
  for (const kw of keywords) {
    const data = await api("/x/web-interface/wbi/search/type", { search_type: "video", keyword: kw, page: 1, page_size: 30 });
    const hits = (data.result ?? [])
      .map((v) => ({ ...v, plain: stripEm(v.title) }))
      .filter((v) => !NOISE.test(v.plain))
      .filter((v) => /eve/i.test(v.plain) || /EVE/.test(kw))
      .sort((a, b) => Number(b.review ?? 0) - Number(a.review ?? 0))
      .slice(0, perKeyword);
    console.log(`\n########## 关键词「${kw}」命中 ${data.numResults ?? "?"} 条，取评论最多的 ${hits.length} 条 ##########`);
    for (const v of hits) {
      if (seen.has(v.bvid)) continue;
      seen.add(v.bvid);
      console.log(`\n[${v.bvid}] ${v.plain}`);
      console.log(`  UP ${v.author} ｜ 播放 ${v.play} ｜ 弹幕 ${v.video_review ?? "?"} ｜ 评论 ${v.review ?? "?"} ｜ ${ymd(v.pubdate)} ｜ aid ${v.aid}`);
      try {
        const d = await api("/x/web-interface/view", { bvid: v.bvid });
        if (d.desc) console.log(`  简介：${stripEm(d.desc).replace(/\n+/g, " / ").slice(0, 200)}`);
        const r = await api("/x/v2/reply", { type: 1, oid: d.aid, sort: 2, ps: 20, pn: 1 });
        console.log(`  ---- 热评（共 ${r.page?.count ?? 0} 条，取赞数前几） ----`);
        for (const c of (r.replies ?? []).slice(0, 6)) {
          const msg = stripEm(c.content?.message).replace(/\n+/g, " ").slice(0, 180);
          if (msg) console.log(`  · [${c.like} 赞] ${msg}`);
        }
      } catch (e) {
        console.log(`  （详情/评论未取到：${e.message}）`);
      }
    }
  }
} else if (cmd === "video") {
  const data = await api("/x/web-interface/view", { bvid: arg });
  console.log(`# ${data.title}`);
  console.log(`UP：${data.owner?.name}（mid ${data.owner?.mid}）｜发布 ${ymd(data.pubdate)}｜播放 ${data.stat?.view}｜弹幕 ${data.stat?.danmaku}｜评论 ${data.stat?.reply}`);
  console.log(`aid：${data.aid}｜bvid：${data.bvid}｜分区：${data.tname}`);
  console.log(`\n简介：\n${stripEm(data.desc)}\n`);
  console.log(`封面：${data.pic}`);
  if (extra > 1) {
    const r = await api("/x/v2/reply", { type: 1, oid: data.aid, sort: 2, ps: 20, pn: 1 });
    console.log(`\n===== 热评（${r.page?.count ?? 0} 条） =====`);
    for (const c of r.replies ?? []) {
      console.log(`\n[${c.like} 赞] ${c.member?.uname}（${ymd(c.ctime)}）`);
      console.log(stripEm(c.content?.message).slice(0, 400));
    }
  }
} else if (cmd === "replies") {
  const pages = Math.max(1, Math.min(extra || 1, 5));
  let oid = arg;
  if (/^BV/.test(arg)) {
    const v = await api("/x/web-interface/view", { bvid: arg });
    oid = v.aid;
    console.log(`# ${v.title}（aid ${oid}）`);
  }
  for (let pn = 1; pn <= pages; pn++) {
    const r = await api("/x/v2/reply", { type: 1, oid, sort: 2, ps: 20, pn });
    console.log(`\n===== 第 ${pn} 页（共 ${r.page?.count ?? 0} 条） =====`);
    for (const c of r.replies ?? []) {
      console.log(`\n[${c.like} 赞] ${c.member?.uname}（${ymd(c.ctime)}）`);
      console.log(stripEm(c.content?.message).slice(0, 400));
    }
  }
} else {
  console.error("用法：node tools/bili.mjs search \"关键词\" [页数] | video <BV号> [1|2] | replies <BV号|aid> [页数]");
  process.exit(1);
}
console.log(`\n--- 本次使用请求 ${used}/${BUDGET} 次 ---`);
