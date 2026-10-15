// 每个词条目录的默认数据：网址与布局。
// 网址用 slug，改标题不影响链接。
//
// 注意两件事：
// 1. 来源链接由模板用 `sourceCount` / `sourceIndex` 过滤器从页面原始 Markdown 现抽
//    （eleventyComputed 阶段拿不到 rawInput，放这里会得到空数组）。
// 2. 作者用的字段名是 `labels`（不是 `tags`，Eleventy 内置会用 tags 建集合）。
//    这里只补一个 `tags` 别名方便旧模板引用，绝不能反过来覆盖 labels。
export default {
  layout: "meme.njk",
  eleventyComputed: {
    permalink: (d) => `/m/${d.slug}/`,
    pageTitle: (d) => `${d.title} — EVE 梗指南`,
    pageDescription: (d) => d.summary || d.title,
    tags: (d) => d.labels ?? [],
  },
};
