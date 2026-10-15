# 工作流说明

这一页是给维护者看的：这套东西由哪些部件组成、一条梗从被发现到上线走了哪些步骤、哪里会自动拦住你。

规范条文在 [AGENTS.md](../AGENTS.md)；本页只讲**流程与机制**。

---

## 1. 一图流

```
        ┌──────────── 取材 ────────────┐
查重 → 本仓库词条 + 公开网络 → 归档摘要 + 出处
        └──────────────┬───────────────┘
                       ↓
              写词条：<slug>.md（正文只留结论与出处）
                       ↓
        npm run check      字段、结构、来源、素材、查重（离线，会失败）
                       ↓
        npm test           脚本与仓库基线（AGENTS/CLAUDE 一致性）
                       ↓
        npm run build      Eleventy 渲染 + Pagefind 建索引 → _site/
                       ↓
        npm run serve      本地预览 http://localhost:8080/
                       ↓
          CI（PR 只构建，main 推送即发布 GitHub Pages）
```

---

## 2. 部件与职责

| 部件 | 文件 | 职责 |
| --- | --- | --- |
| 词条规格 | `scripts/schema.mjs` | 字段白名单、分类/等级/适用范围/服务器枚举、正文小节、来源与一句话定义规则。**改规格只改这里** |
| 词条加载 | `scripts/loader.mjs` | 命令行侧的读取（校验、查重、生成清单都用它） |
| 站点数据 | `src/_data/memes.js` | Eleventy 侧读取：解析 front matter、抽出正文里的来源链接与一句话定义 |
| 校验 | `scripts/validate-memes.mjs` | 逐条校验 + 全局查重（slug、别名）+ related 引用是否存在 |
| 建条目 | `scripts/new-meme.mjs` | 从模板生成 `<slug>.md` 与 `sources-<slug>.md` |
| 查重 | `scripts/find-meme.mjs` | 在标题、别名、标签、分类、正文里找关键词 |
| 环境预检 | `scripts/doctor.mjs` | Node 版本、依赖、规格文件、`AGENTS.md`/`CLAUDE.md` 一致性 |
| **B 站采集** | `tools/bili.mjs` | `search` / `video` / `replies` / `collect`：走公开数据接口搜视频、读热评；内置 3 秒间隔与 20 次/轮预算 |
| 术语表生成 | `tools/gen-lexicon.mjs` | 从本仓库词条生成 `docs/lexicon.md`（术语与别名总表） |
| 待补清单生成 | `tools/gen-pending.mjs` | 从词条数据生成 `docs/pending.md`（谁还欠来源/别名/用法） |

**为什么规格只有一个文件**：校验脚本、站点数据、建条目脚本三处都必须遵守同一套字段。规格写进 `schema.mjs` 后，三处引用同一份枚举，就不会出现「校验放行了、站点读不出来」这类漂移。

**为什么待补清单是生成的**：手维护的清单一定会过期。`docs/pending.md` 每次生成都重新读全部词条，欠什么一目了然；要清掉一行，只能去改词条本身。

---

## 3. 一条梗的完整生命周期

### 步骤 1：查重
```bash
npm run find -- "关键词"
```
命中已有词条就**补充**它（加料、加来源、改 `updated_at`），不要另立重复条目。别名会参与查重，所以「同一个梗的不同叫法」不会变成两条。

### 步骤 2：取材
先查本仓库已有词条（`npm run find`），确有必要再联网。**来源只能是公开网页**：原帖、官方新闻与论坛、媒体报道、社区 wiki、可查的 KM/API 数据。**不得引用任何第三方整理仓库的内容**（含其术语表、列传、事件摘要），见 AGENTS.md 第 3 节的禁止条款。

- 来源只认三类：**本地资料路径**、**可点击 URL**、**可查的公开数据**（KM / API）。
- 遇 403 / 429 / 412 / 验证码，停止该站点并记录状态码，不换路径硬刷（见 AGENTS.md 第 3 节）。
- 读到的内容**当场消化成摘要**：事件经过、关键原话、上下文、出处、待核点。原图与原文不长期保存。

### 步骤 3：归档
```bash
npm run new -- "词条名" --slug <slug> --category 名场面 --confidence 社区流传 --aliases "a,b" --tags "贴吧,欧服"
```
会生成两个文件：

- `src/memes/<slug>/<slug>.md` —— 词条正文，会渲染成 `/m/<slug>/`
- `src/memes/<slug>/sources-<slug>.md` —— 取材记录：已核来源表、待核、排除记录

**素材文件是必填的**（缺了校验直接失败）。它的价值在于：正文可以只写确定的结论，而「查过什么、哪条没查到、为什么排除」全部有地方落。

### 步骤 4：写词条
按 [docs/meme-template.md](meme-template.md) 填。硬规则：

- 一句话定义 ≤60 字，写在正文最前面；
- 必须有 `## 这个梗` 与 `## 出处与来历`，且「出处与来历」里**至少一个链接**；
- 不写刹车句，来源交代一次就继续讲事；
- 具体人名、时间、金额、战果必须有出处；推演动机可以，但要用「大概」「看样子」领起。

### 步骤 5：校验与构建
```bash
npm run check     # 离线；失败会列出「哪个文件、哪一行、什么问题」
npm test          # 脚本测试 + 仓库基线（全部词条合规、无重复、指令副本一致）
npm run build     # 渲染 + 建搜索索引
npm run serve     # 预览
```

### 步骤 6：发布
推送到 `main` 由 CI 构建并发布；PR 只构建。`PATH_PREFIX` 由 CI 注入，所以本地构建出的链接用 `/` 根路径，线上是 `/<仓库名>/`，这是正常的。

---

## 4. 自动拦住你的地方

| 情况 | 会在哪一步失败 | 提示 |
| --- | --- | --- |
| front matter 多了个字段（比如把来源写成 `source:`） | `npm run check` | 「未知字段 …（允许的字段：…）」 |
| `slug` 与目录名不一致 | `npm run check` | 「slug 与目录名不一致」 |
| 分类或证据等级填了枚举外的值 | `npm run check` | 「category … 无效（只能是 …）」 |
| 正文缺 `## 出处与来历` 或一个链接都没有 | `npm run check` | 「正文一个来源链接都没有」 |
| 一句话定义超过 60 字 | `npm run check` | 「开头定义 N 字，超过 60 字上限」 |
| 忘了建 `sources-<slug>.md` | `npm run check` | 「缺少素材文件 …」 |
| 两条词条的别名撞了 | `npm run check` | 「别名重复："…" 同时属于 … 与 …」 |
| `related` 指向不存在的词条 | `npm run check` | 「related 指向不存在的词条 …」 |
| 改了 `AGENTS.md` 没同步 `CLAUDE.md` | `npm test` / `npm run doctor` | 「AGENTS.md 与 CLAUDE.md 不一致」 |
| 词汇量/风格问题（刹车句、来源辩护） | 不会自动拦 | 靠 AGENTS.md 第 4 节人工通读 |

---

## 5. 想扩展时改哪里

| 想做的事 | 改哪里 |
| --- | --- |
| 加一个分类 | `scripts/schema.mjs` 的 `CATEGORIES` + `src/_data/site.js` 的 `categoryOrder` + AGENTS.md 的分类表 |
| 加一个正文小节 | `scripts/schema.mjs` 的 `OPTIONAL_SECTIONS` |
| 收紧/放宽来源规则 | `scripts/schema.mjs` 的 `validateEntry` |
| 加一个站点页面 | 新增 `src/<page>.njk`；需要新过滤逻辑时加到 `eleventy.config.js` |
| 换站名、印章字 | `src/_data/site.js` |
| 换配色 | `src/assets/css/site.css` 顶部的 CSS 变量 |
| 术语与别名总表要更新 | 改词条本身，再跑 `node tools/gen-lexicon.mjs`（表是生成的，不手改） |

改完任何一处，都要 `npm run check && npm test && npm run build` 三连。
