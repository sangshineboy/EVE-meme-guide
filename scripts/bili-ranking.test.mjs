import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  roundHalfUp,
  scoreWork,
  rankWorks,
  isRelevantEveVideo,
  classifyPlatform,
} from "../tools/bili-ranking/score.mjs";
import { writeXlsx } from "../tools/bili-ranking/xlsx-writer.mjs";
import { buildEpisodeJson } from "../tools/bili-ranking/build-ranking.mjs";
import { readXlsx } from "../tools/rag/lib/xlsx.mjs";

test("roundHalfUp 遵守十进制四舍五入", () => {
  assert.equal(roundHalfUp(1.005, 2), 1.01);
  assert.equal(roundHalfUp(2.5, 0), 3);
  assert.equal(roundHalfUp(0.125, 2), 0.13);
  assert.equal(roundHalfUp(4 / 4, 3), 1);
  assert.equal(roundHalfUp(4 / 5, 3), 0.8);
});

test("aigirl-weekly-score-v1 公式与边界条件计算正确", () => {
  // 全零输入得分 0
  const zero = scoreWork({
    bvid: "BV1zero",
    view: 0,
    reply: 0,
    danmaku: 0,
    favorite: 0,
    coin: 0,
    partCount: 1,
  });
  assert.equal(zero.score, 0);
  assert.equal(zero.A, 1);

  // 百万级以上播放触发 A 衰减系数 (< 1)
  const big = scoreWork({
    bvid: "BV1rx41147vd",
    view: 3952586,
    reply: 6608,
    danmaku: 21719,
    favorite: 50000,
    coin: 30000,
    like: 100000,
    share: 15000,
    partCount: 1,
  });
  assert.equal(big.P, 1);
  assert.ok(big.A < 1 && big.A > 0.6);
  assert.ok(big.B > 0 && big.B <= 1);
  assert.ok(big.C > 0 && big.C <= 1);
  assert.ok(big.D > 0 && big.D <= 1);
  assert.ok(Number.isInteger(big.score) && big.score > 0);

  // 缺指标或负数直接拒绝
  assert.throws(() =>
    scoreWork({ bvid: "BV1bad", view: 100, reply: 1, danmaku: 1, favorite: undefined, coin: 1, partCount: 1 }),
  );
  assert.throws(() =>
    scoreWork({ bvid: "BV1neg", view: -1, reply: 0, danmaku: 0, favorite: 0, coin: 0, partCount: 1 }),
  );
  assert.throws(() =>
    scoreWork({ bvid: "BV1p0", view: 100, reply: 0, danmaku: 0, favorite: 0, coin: 0, partCount: 0 }),
  );
});

test("rankWorks 按得分降序、同分按区分大小写的 BV 号升序", () => {
  const base = { view: 10000, reply: 100, danmaku: 50, favorite: 200, coin: 150, partCount: 1 };
  const ranked = rankWorks([
    { ...base, bvid: "BV1b" },
    { ...base, bvid: "BV1A" },
    { ...base, bvid: "BV1a", view: 50000, favorite: 1000, coin: 500 },
  ]);
  assert.deepEqual(
    ranked.map((x) => x.bvid),
    ["BV1a", "BV1A", "BV1b"],
  );
  assert.deepEqual(
    ranked.map((x) => x.rank),
    [1, 2, 3],
  );
});

test("相关性过滤排除歌手 Eve 与星刃，端游/手游准确分类", () => {
  assert.equal(isRelevantEveVideo({ title: "【Eve】廻廻奇谭 MV 咒术回战" }), false);
  assert.equal(isRelevantEveVideo({ title: "星刃 Stellar Blade 伊芙全服装展示" }), false);
  assert.equal(isRelevantEveVideo({ title: "EVE - 欧服华人正面决战十国联军！" }), true);
  assert.equal(isRelevantEveVideo({ title: "【EVE手游】星战前夜：无烬星河新手攻略" }), true);

  assert.equal(classifyPlatform({ title: "【EVE手游】无烬星河 T2 长枪无畏宣传片" }), "手游");
  assert.equal(classifyPlatform({ title: "【EVE欧服】N老板的黑历史" }), "端游");
  assert.equal(classifyPlatform({ title: "EVE国际服 极限集结" }), "端游");
  assert.equal(classifyPlatform({ title: "EVE 新手教程", published_date: "2017-10-20" }), "端游");
  assert.equal(classifyPlatform({ title: "EVE 最强配船思路", published_date: "2024-01-01" }), "待核");
});

test("writeXlsx 生成的 xlsx 可被 readXlsx 准确无损读回", () => {
  const tmp = path.join(os.tmpdir(), `bili-rank-test-${Date.now()}.xlsx`);
  try {
    writeXlsx(tmp, [
      {
        name: "总榜",
        rows: [
          ["名次", "综合得分", "平台", "标题"],
          [1, 123456, "端游", "EVE & <测试> 标题"],
        ],
        widths: [8, 12, 8, 30],
      },
      {
        name: "口径",
        rows: [["规则", "aigirl-weekly-score-v1"]],
      },
    ]);
    const sheets = readXlsx(tmp);
    assert.equal(sheets.length, 2);
    assert.equal(sheets[0].name, "总榜");
    assert.deepEqual(sheets[0].rows[0].cells, ["名次", "综合得分", "平台", "标题"]);
    assert.deepEqual(sheets[0].rows[1].cells, ["1", "123456", "端游", "EVE & <测试> 标题"]);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
});

test("buildEpisodeJson 生成符合 weekly-production/episode-v1 的模板", () => {
  const ranked = rankWorks([
    {
      bvid: "BV1rx41147vd",
      title: "EVE 欧服华人决战十国联军",
      author: "hitncl",
      platform: "端游",
      view: 3952586,
      reply: 6608,
      danmaku: 21719,
      favorite: 50000,
      coin: 30000,
      like: 100000,
      share: 15000,
      partCount: 1,
      duration: 1812,
    },
  ]);
  const ep = buildEpisodeJson(ranked, { observedAt: "2026-11-25T21:15:00+08:00" });
  assert.equal(ep.schema, "weekly-production/episode-v1");
  assert.equal(ep.metric_basis, "cumulative");
  assert.equal(ep.works.length, 1);
  assert.equal(ep.works[0].bvid, "BV1rx41147vd");
  assert.equal(ep.works[0].metrics.favorite, 50000);
  assert.equal(ep.works[0].part_count, 1);
});
