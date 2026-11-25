/**
 * 腾讯云函数（SCF Web 函数，兼容 Node.js 12.16+）访问人数统计后端
 * 用法：直接将本文件内容全选替换腾讯云在线编辑器中的 src/app.js，保留 scf_bootstrap 不变，点击「部署」。
 *
 * 可选环境变量（在「函数配置 -> 环境变量」中设置）：
 * - REDIS_URL        Redis 连接串（如 redis://:密码@内网IP:6379/0）；不填时暂用内存计数（实例休眠后会重置）
 * - ALLOWED_ORIGINS  允许跨域的来源，逗号分隔，默认允许 GitHub Pages 与本地预览
 * - BASE_TOTAL       初始累计人数基数，默认 0
 */

const http = require("http");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 9000);
const BASE_TOTAL = Number(process.env.BASE_TOTAL || 0);
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "https://sangshineboy.github.io,http://localhost:8080,http://127.0.0.1:8080"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function beijingDay() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function hashVisitor(vid, ip) {
  return crypto
    .createHash("sha256")
    .update((vid || "") + "|" + (ip || ""))
    .digest("hex")
    .slice(0, 16);
}

/* ---------- 内存存储（未配 REDIS_URL 时兜底） ---------- */
const mem = { total: BASE_TOTAL, days: new Map() };

/* ---------- 可选 Redis 存储（需在 src 目录安装 ioredis 或 redis@3） ---------- */
let redisClient = null;
function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;
  const Redis = require("ioredis");
  redisClient = new Redis(process.env.REDIS_URL);
  redisClient.on("error", (err) => console.error("Redis error:", err));
  return redisClient;
}

async function readCounts(day) {
  const r = getRedis();
  if (!r) {
    const set = mem.days.get(day);
    return {
      total: mem.total,
      today: set ? set.size : 0,
      day: day,
    };
  }
  const results = await Promise.all([
    r.get("eve_meme:total_uv"),
    r.scard("eve_meme:day_uv:" + day),
  ]);
  return {
    total: Number(results[0] !== null ? results[0] : BASE_TOTAL),
    today: Number(results[1] || 0),
    day: day,
  };
}

async function recordVisit(day, visitorHash) {
  const r = getRedis();
  if (!r) {
    if (!mem.days.has(day)) mem.days.set(day, new Set());
    const set = mem.days.get(day);
    if (!set.has(visitorHash)) {
      set.add(visitorHash);
      mem.total += 1;
    }
    return { total: mem.total, today: set.size, day: day };
  }

  const dayKey = "eve_meme:day_uv:" + day;
  const added = await r.sadd(dayKey, visitorHash);
  await r.expire(dayKey, 48 * 3600);
  if (added === 1) {
    await r.setnx("eve_meme:total_uv", String(BASE_TOTAL));
    await r.incr("eve_meme:total_uv");
  }
  return readCounts(day);
}

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : (ALLOWED_ORIGINS[0] || "*");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      if (body.length < 4096) body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", () => resolve(""));
  });
}

const server = http.createServer(async (req, res) => {
  const headers = corsHeaders(req.headers.origin || "");
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const day = beijingDay();
  try {
    if (req.method === "GET") {
      const data = await readCounts(day);
      res.writeHead(200, headers);
      res.end(JSON.stringify(data));
      return;
    }

    if (req.method === "POST") {
      const raw = await readBody(req);
      let vid = "";
      try {
        vid = (JSON.parse(raw || "{}").vid) || "";
      } catch (e) {}
      const fwd = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
      const ip = String(fwd).split(",")[0].trim();
      const data = await recordVisit(day, hashVisitor(vid, ip));
      res.writeHead(200, headers);
      res.end(JSON.stringify(data));
      return;
    }

    res.writeHead(405, headers);
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
  } catch (err) {
    console.error(err);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: "Internal Error" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Counter server listening on http://0.0.0.0:" + PORT);
});
