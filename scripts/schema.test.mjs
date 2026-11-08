import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEntry, CATEGORIES, SCOPES, SERVERS } from "./schema.mjs";

const base = (over = {}) => ({
  slug: "test-meme",
  data: {
    slug: "test-meme",
    title: "测试梗",
    category: CATEGORIES[0],
    confidence: "已确认",
    scope: SCOPES[0],
    server: SERVERS[0],
    ...over,
  },
  body: [
    "一句话说清这是什么。",
    "",
    "## 定性",
    "",
    "正文。",
    "",
    "## 参考文献",
    "",
    "- [来源](https://example.com/x) —— 说明",
    "",
  ].join("\n"),
  files: ["sources-test-meme.md"],
});

test("合规词条没有错误", () => {
  const e = base();
  assert.deepEqual(validateEntry({ ...e, slug: e.data.slug }), []);
});

test("未知 front matter 字段被拒绝", () => {
  const e = base({ 舰船: "Rifter" });
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("未知字段")));
});

test("slug 与目录名不一致被拒绝", () => {
  const e = base();
  const errs = validateEntry({ ...e, slug: "other-dir" });
  assert.ok(errs.some((x) => x.includes("与目录名")));
});

test("非法分类被拒绝", () => {
  const e = base({ category: "随便写的" });
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("category")));
});

test("非法 scope / server 被拒绝", () => {
  const e1 = base({ scope: "页游" });
  assert.ok(validateEntry({ ...e1, slug: e1.data.slug }).some((x) => x.includes("scope")));
  const e2 = base({ server: "台服" });
  assert.ok(validateEntry({ ...e2, slug: e2.data.slug }).some((x) => x.includes("server")));
});

test("缺少 scope / server 被拒绝", () => {
  const e = base({ scope: undefined, server: undefined });
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("scope")));
  assert.ok(errs.some((x) => x.includes("server")));
});

test("缺少必填小节与来源被拒绝", () => {
  const e = base();
  e.body = "只有一句话定义。";
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("## 定性")));
  assert.ok(errs.some((x) => x.includes("## 参考文献")));
});

test("参考文献里没有链接被拒绝", () => {
  const e = base();
  e.body = "一句话说清这是什么。\n\n## 定性\n\n正文。\n\n## 参考文献\n\n只有说明，没有链接。\n";
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("来源链接")));
});

test("参考文献必须排在最后", () => {
  const e = base();
  e.body = "一句话。\n\n## 定性\n\n正文。\n\n## 参考文献\n\n- [来源](https://example.com/x)\n\n## 用法\n\n用法。\n";
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("最后一个小节")));
});

test("小节顺序不对被拒绝", () => {
  const e = base();
  e.body = "一句话。\n\n## 定性\n\n正文。\n\n## 演变\n\n演变。\n\n## 溯源\n\n溯源。\n\n## 参考文献\n\n- [来源](https://example.com/x)\n";
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("小节顺序")));
});

test("未知小节被拒绝", () => {
  const e = base();
  e.body += "\n## 我自己发明的小节\n\n内容\n";
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("未知小节")));
});

test("一句话定义超过 60 字被拒绝", () => {
  const e = base();
  e.body = `${"很长".repeat(31)}\n\n## 定性\n\nx\n\n## 参考文献\n\n- [s](https://example.com)\n`;
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("60 字")));
});

test("缺少素材文件被拒绝", () => {
  const e = base();
  e.files = [];
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("sources-test-meme.md")));
});

test("标签里的禁用字符被拒绝", () => {
  const e = base({ labels: ["00/区"] });
  const errs = validateEntry({ ...e, slug: e.data.slug });
  assert.ok(errs.some((x) => x.includes("标签")));
});
