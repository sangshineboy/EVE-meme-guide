import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, tokenize, termFreq } from "../tools/rag/lib/text.mjs";
import { splitLong, chunkMarkdown, chunkSheet, rowToText } from "../tools/rag/lib/chunk.mjs";
import { buildIndex, search } from "../tools/rag/lib/bm25.mjs";

// 检索层的回归测试：分词、切块、排序。纯函数，不碰 参考文献/，CI 里也能跑。

test("分词：中文按 bigram，英文按词", () => {
  assert.deepEqual(tokenize("红罐凉茶"), ["红罐", "罐凉", "凉茶"]);
  assert.deepEqual(tokenize("EVE 玩家"), ["eve", "玩家"]);
  assert.deepEqual(tokenize("M2-星城"), ["m2", "星城"]);
  // 全角数字/字母先归一化再切
  assert.deepEqual(tokenize("ＥＶＥ"), ["eve"]);
});

test("归一化保留全角标点，只清零宽字符与多余空白", () => {
  assert.equal(normalize("红罐凉茶（主梗）"), "红罐凉茶（主梗）");
  assert.equal(normalize("a\u200bb"), "ab");
  assert.equal(normalize("x \t y"), "x y");
});

test("词频统计合并同一词", () => {
  const tf = termFreq("凉茶 凉茶");
  assert.equal(tf.get("凉茶"), 2);
});

test("长文本按句号切块且不超过上限", () => {
  const text = "第一句。".repeat(400);
  const parts = splitLong(text);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(p.length <= 900, "块超长：" + p.length);
});

test("Markdown 按标题分块，标题路径进 ctx", () => {
  const md = ["# 总标题", "开场一句。", "## 溯源", "来自贴吧一帖。", "## 用法", "圈里这么说。"].join("\n");
  const chunks = chunkMarkdown(md, "示例文");
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.some((c) => c.ctx.includes("总标题 > 溯源")));
  assert.ok(chunks.some((c) => c.t.includes("来自贴吧一帖")));
});

test("表格行渲染跳过空格子并带上表头", () => {
  assert.equal(rowToText(["楼层", "内容"], ["3", ""]), "楼层: 3");
  assert.equal(rowToText([], ["a", "b"]), "a | b");
});

function sheet(name, rows) {
  return { name, rows: rows.map((cells, i) => ({ rowNum: i + 1, cells })) };
}

test("工作表分块：表头 + 行号进 ctx，标题行单独处理", () => {
  const chunks = chunkSheet(sheet("梗一览", [["楼层", "梗"], ["1", "红罐凉茶"], ["2", "洗机库"]]), "示例表");
  assert.ok(chunks.length >= 1);
  assert.match(chunks[0].ctx, /表「梗一览」/);
  assert.match(chunks[0].ctx, /第 2–3 行/);
  assert.match(chunks[0].t, /梗: 红罐凉茶/);

  const withTitle = chunkSheet(sheet("视频信息", [["某视频"], ["项目", "值"], ["标题", "投送泰坦"]]), "示例表");
  assert.match(withTitle[0].ctx, /某视频/);
  assert.match(withTitle[0].t, /投送泰坦/);
});

test("检索：相关块排前面，过滤生效，空查询无命中", () => {
  const chunks = [
    { p: "a.md", ctx: "红罐凉茶", t: "网吧认出对面是爆过自己的海盗，买一罐红罐凉茶过去爆头。" },
    { p: "b.md", ctx: "洗机库", t: "有权限的管理把军团机库物资洗劫一空。" },
    { p: "c.md", ctx: "投送泰坦", t: "泰坦用跳跃通道发生器投送舰队，操作失误把自己跳了出去。" },
  ];
  const index = buildIndex(chunks);

  const r1 = search(index, "红罐凉茶", { k: 3 });
  assert.equal(r1.top[0].path, "a.md");

  const r2 = search(index, "机库", { k: 3 });
  assert.equal(r2.top[0].path, "b.md");

  const r3 = search(index, "机库", { k: 3, filter: "a.md" });
  assert.deepEqual(r3.top, []);

  const r4 = search(index, "完全不存在的词zxqv", { k: 3 });
  assert.equal(r4.total, 0);
});
