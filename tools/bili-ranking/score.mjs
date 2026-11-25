/**
 * B 站热门 EVE 视频计分与分类引擎
 *
 * 计分公式严格采用 weekly-production 的 aigirl-weekly-score-v1（周刊哔哩哔哩排行榜 #852）：
 *   S = (V * P * A + R * B * 50 + K * C * 20 + F * C) * D
 *   P = round(4 / (N + 3), 3)
 *   A = min(1, (1,000,000 + V) / (2 * V))   // V=0 时取 1，不提前舍入
 *   B = round(min(1, (20 * F + 10 * K) / (V + 10 * K + 50 * R)), 2)
 *   C = round(min(1, (50 * R + M) / (2 * V + 10 * F + 20 * K)), 2)
 *   D = round(log10(R + M + 10) / log10(V + F + K + 10), 3)
 *
 * 舍入采用 ROUND_HALF_UP；点赞与分享单独记录展示，不参与计分。
 * 缺项、分 P 数 < 1 或指标为负时抛出错误，禁止直接排名。
 */

export const RULE_VERSION = "aigirl-weekly-score-v1";

/** 十进制 ROUND_HALF_UP（仅处理非负数，加微小偏移消除常见二进制浮点误差） */
export function roundHalfUp(value, decimals = 0) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`roundHalfUp 仅接受非负有限数，收到：${value}`);
  }
  const factor = 10 ** decimals;
  return Math.floor(value * factor + 0.5 + 1e-12) / factor;
}

function assertNonNegInt(val, name) {
  if (typeof val !== "number" || !Number.isFinite(val) || val < 0 || !Number.isInteger(val)) {
    throw new Error(`指标 ${name} 必须为非负整数，收到：${val}`);
  }
  return val;
}

/** 计算单条视频的综合得分与完整系数明细 */
export function scoreWork(work) {
  if (!work || typeof work !== "object") throw new Error("作品对象为空");
  const bvid = String(work.bvid || "").trim();
  if (!bvid) throw new Error("缺少 bvid");

  const V = assertNonNegInt(work.view, "view");
  const R = assertNonNegInt(work.reply, "reply");
  const M = assertNonNegInt(work.danmaku, "danmaku");
  const F = assertNonNegInt(work.favorite, "favorite");
  const K = assertNonNegInt(work.coin, "coin");
  const N = assertNonNegInt(work.partCount ?? work.part_count ?? work.videos, "partCount");
  if (N < 1) throw new Error(`分 P 数 partCount 必须 >= 1，收到：${N}`);

  const like = work.like == null ? null : assertNonNegInt(work.like, "like");
  const share = work.share == null ? null : assertNonNegInt(work.share, "share");

  if (V === 0 && R === 0 && M === 0 && F === 0 && K === 0) {
    return {
      P: roundHalfUp(4 / (N + 3), 3),
      A: 1,
      B: 0,
      C: 0,
      D: 1,
      viewTerm: 0,
      replyTerm: 0,
      coinTerm: 0,
      favoriteTerm: 0,
      rawScore: 0,
      score: 0,
      like,
      share,
    };
  }

  const P = roundHalfUp(4 / (N + 3), 3);
  const A = V === 0 ? 1 : Math.min(1, (1_000_000 + V) / (2 * V));

  const bDen = V + 10 * K + 50 * R;
  const B = bDen === 0 ? 0 : roundHalfUp(Math.min(1, (20 * F + 10 * K) / bDen), 2);

  const cDen = 2 * V + 10 * F + 20 * K;
  const C = cDen === 0 ? 0 : roundHalfUp(Math.min(1, (50 * R + M) / cDen), 2);

  const dDen = Math.log10(V + F + K + 10);
  const D = dDen === 0 ? 0 : roundHalfUp(Math.log10(R + M + 10) / dDen, 3);

  const viewTerm = V * P * A;
  const replyTerm = R * B * 50;
  const coinTerm = K * C * 20;
  const favoriteTerm = F * C;
  const rawScore = (viewTerm + replyTerm + coinTerm + favoriteTerm) * D;
  const score = roundHalfUp(rawScore, 0);

  return {
    P,
    A,
    B,
    C,
    D,
    viewTerm,
    replyTerm,
    coinTerm,
    favoriteTerm,
    rawScore,
    score,
    like,
    share,
  };
}

/** 按综合得分降序排列；同分按区分大小写的 BV 号字典升序 */
export function rankWorks(works) {
  const scored = works.map((w) => ({
    ...w,
    calc: scoreWork(w),
  }));
  scored.sort((a, b) => {
    if (b.calc.score !== a.calc.score) return b.calc.score - a.calc.score;
    return a.bvid < b.bvid ? -1 : a.bvid > b.bvid ? 1 : 0;
  });
  return scored.map((item, idx) => ({
    rank: idx + 1,
    ...item,
  }));
}

/* ---------- 相关性过滤与端游 / 手游分类 ---------- */

// 常见同名噪音：日本歌手 Eve、星刃(伊芙)、寄生前夜、Vtuber、影视歌曲等
const NOISE_RE =
  /(咒术回战|廻廻奇谭|回廻奇谭|ドラマツルギー|心海|ぼくらの|歌い手|翻唱|vocaloid|初音|vtuber|虚拟主播|星刃|stellar\s*blade|剑星|伊芙|寄生前夜|parasite\s*eve|wall-?e|圣诞夜|christmas\s*eve|new\s*year'?s\s*eve|adam\s*and\s*eve|eve'?s\s*room|真白花音|黑执事|自走棋)/i;

// 强 EVE 游戏特征词
const EVE_STRONG_RE =
  /(星战前夜|无烬星河|无烬文明|eve\s*online|eve\s*ol|eve\s*echoes|evepc\.163\.com|star\.game\.163\.com\/evem|新伊甸|晨曦|宁静服|欧服|国际服|曙光服|加达里|艾玛|盖伦特|米玛塔尔|吉他海四|高安|低安|00区|虫洞|泰坦|超旗|大航|无畏舰|小航|乌鸦级|pibc|frt|凛冬|wwb2|星城|遥修老李|老李的蛋|馒头怒斥|十国联军|殷郡|蓝加|隐轰|星河通讯社)/i;

// 明确归属端游 / 手游的官方或垂直创作者
const MOBILE_AUTHORS = new Set(["EVE无烬星河"]);
const PC_AUTHORS = new Set(["EVE星战前夜晨曦", "银色汤勺", "舰长白杉", "hitncl"]);

const MOBILE_RE = /(无烬星河|无烬文明|eve\s*echoes|star\.game\.163\.com\/evem|手游|星战前夜[：:\s]*无烬|移动版|移动端|殷郡)/i;
const PC_RE =
  /(eve\s*online|eve\s*ol|evepc\.163\.com|星战前夜[：:\s]*晨曦|晨曦|曙光服|欧服|国际服|宁静服|tranquility|端游|pc端|pibc|frt|凛冬|wwb2|49会战|十国联军|这个频道不许录音|吉他海四|n老板|遥修老李|老李的蛋|馒头怒斥|星城)/i;

/** 判断一条视频是否为 EVE 游戏相关视频（排除歌手 Eve、星刃等噪音） */
export function isRelevantEveVideo({ title = "", desc = "", tname = "", author = "", tags = [] } = {}) {
  if (MOBILE_AUTHORS.has(author) || PC_AUTHORS.has(author)) return true;
  const text = [title, desc, tname, ...(Array.isArray(tags) ? tags : [])].join(" ");
  if (NOISE_RE.test(text) && !EVE_STRONG_RE.test(text)) return false;
  if (EVE_STRONG_RE.test(text)) return true;
  return /\beve\b/i.test(title) || /(星战前夜|无烬星河|新伊甸)/i.test(text);
}

/** 区分端游 / 手游 / 待核 */
export function classifyPlatform({ title = "", desc = "", tname = "", author = "", published_date = "", published_at = "", tags = [] } = {}) {
  if (MOBILE_AUTHORS.has(author)) return "手游";
  const head = [title, ...(Array.isArray(tags) ? tags : [])].join(" ");
  const full = `${head} ${desc} ${tname}`;
  const isMobileHead = MOBILE_RE.test(head);
  const isPcHead = PC_RE.test(head);
  if (isMobileHead && !isPcHead) return "手游";
  if (isPcHead && !isMobileHead) return "端游";
  if (PC_AUTHORS.has(author)) return "端游";
  const isMobile = MOBILE_RE.test(full);
  const isPc = PC_RE.test(full);
  if (isMobile && !isPc) return "手游";
  if (isPc && !isMobile) return "端游";
  if (isMobile && isPc) return isMobileHead ? "手游" : "端游";
  // EVE 手游《无烬星河》2018-10 才在 EVE Vegas 首次曝光，此前必为端游
  const pub = String(published_date || published_at || "").slice(0, 10);
  if (pub && pub < "2018-10-01") return "端游";
  return "待核";
}
