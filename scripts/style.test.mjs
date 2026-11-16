import { test } from "node:test";
import assert from "node:assert/strict";
import { stripBody, splitSentences, analyze, HARD } from "../tools/style-check.mjs";

// 体检工具的回归：切正文、切句、计次、触发阈值。

test("stripBody 去掉 front matter、参考文献与固定落款", () => {
  const md = ["---", "slug: x", "title: X", "---", "正文第一句。", "", "## 定义", "这是定义。", "", "## 参考文献", "- [a](https://e.com)", "（AI 观点，不构成事实陈述。）"].join("\n");
  const body = stripBody(md);
  assert.ok(!body.includes("slug: x"), "front matter 没去掉");
  assert.ok(!body.includes("参考文献"), "参考文献小节没去掉");
  assert.ok(!body.includes("https://e.com"), "来源链接没去掉");
  assert.ok(!body.includes("AI 观点"), "落款没去掉");
  assert.ok(body.includes("这是定义"));
});

test("splitSentences 按标点与换行断句，丢掉空句与表格行", () => {
  const s = splitSentences("第一句。第二句！\n第三句？\n\n");
  assert.deepEqual(s, ["第一句", "第二句", "第三句"]);
  const t = splitSentences("正文一句。\n| 说法 | 含义 |\n| --- | --- |\n| 吃 KFC | 卖掉物资 |");
  assert.deepEqual(t, ["正文一句", "| 说法 | 含义 |", "| --- | --- |", "| 吃 KFC | 卖掉物资 |"].filter((x) => !x.startsWith("|")));
});

test("analyze 计次正确，单处破折号不触发（阈值 2）", () => {
  const one = analyze("这条只有一处——插入语。");
  assert.equal(one.counts.dash, 1);
  assert.equal(one.hard.some((h) => h.key === "dash"), false);

  const two = analyze("第一处——这里。第二处——那里。");
  assert.equal(two.counts.dash, 2);
  assert.equal(two.hard.some((h) => h.key === "dash"), true);
});

test("「不是…而是」一次就触发，并挑出病灶句", () => {
  const r = analyze("这不是运气的问题，而是补损的问题；满编能团灭，补不起就只剩名词。");
  assert.equal(r.counts.turn, 1);
  assert.equal(r.counts.semi, 1);
  assert.equal(r.hard.some((h) => h.key === "turn"), true);
  assert.equal(r.hard.some((h) => h.key === "semi"), false, "单处分号不该触发（阈值 2）");
  assert.ok(r.worst.length >= 1, "应当挑出病灶句");
});

test("阈值表本身是明文可读的", () => {
  assert.equal(HARD.dash.limit, 2);
  assert.equal(HARD.semi.limit, 2);
  assert.equal(HARD.turn.limit, 1);
});
