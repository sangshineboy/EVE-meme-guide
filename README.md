# EVE 梗指南

**线上站点**：https://sangshineboy.github.io/EVE-meme-guide/ （GitHub Pages，推送到 `main` 自动发布）
**自定义域名**：`eve梗指南.top`（绑定中——DNS 里要填它的 punycode 形式 `xn--eve-0i3e503eduh.top`，步骤见 [docs/NEXT-STEPS.md](docs/NEXT-STEPS.md)）

EVE Online 中文社区的**梗、黑话、名场面与圈内典故**词条库（当前 **56 条**）—— 一条一页，讲清来历、用法，并且**逐条给出处**。

这不是词典，是**证据台账**：每条词条都标注证据等级（`已确认` / `社区流传`），来源写进正文并可点开；取材过程中的覆盖缺口、待核项与排除记录留在词条的素材文件里，不混进正文。

## 网站有什么

| 页面 | 说明 |
| --- | --- |
| `/` | 目录：按分类分组，支持关键词、分类、证据等级筛选，可按来源数或随机排序 |
| `/m/<slug>/` | 词条页：一句话定义、正文、来源数、相关词条、前后翻页 |
| `/lexicon/` | 黑话与别名索引：同一件事的三四个叫法都摊在这里 |
| `/sources/` | 出处总表：全站来源按站点归拢，方便批量核对 |
| `/tags/` | 标签云与标签页 |
| `/search/` | Pagefind 全文搜索 |
| `/random/` | 随机翻一条 |

## 快速开始

```bash
npm ci            # 安装依赖
npm run doctor    # 环境与指令副本预检
npm run build     # 校验 + 渲染 + 建搜索索引 → _site/
npm run serve     # 本地预览 http://localhost:8080/
```

节点版本要求 `>=20.11 <21 || >=21.2`。

## 加一条梗

```bash
npm run find -- "关键词"                      # 先查重（标题、别名、标签、正文都会搜）
npm run new -- "词条名" --slug <slug> --category 名场面 --confidence 社区流传
# 填 src/memes/<slug>/<slug>.md 与 sources-<slug>.md
npm run check                                 # 离线校验，不合格会指出文件与原因
npm run build
```

一条词条长这样：

```
src/memes/<slug>/
├─ <slug>.md            # 正文（渲染成 /m/<slug>/），front matter 只有 6 个字段
└─ sources-<slug>.md    # 取材记录：已核来源表、待核、排除记录（必填，不生成页面）
```

正文小节固定：一句话定义（≤60 字）+ `## 这个梗` + `## 出处与来历`（**至少一个来源链接**），可选 `## 怎么用`、`## 变体与近亲`、`## 为什么好笑`。完整模板见 [docs/meme-template.md](docs/meme-template.md)。

## 设计原则

这个仓库由三个互补的部分组成：**词条**（结论与出处）、**取材记录**（来源、覆盖缺口、待核、排除记录）、**规格与校验**（把写作纪律变成构建期的硬失败）。三者的关系：

| 原则 | 具体做法 |
| --- | --- |
| 来源必须可点开 | 词条正文的「出处与来历」至少一个链接，`npm run check` 会数；出处总表由构建自动汇总 |
| 素材与成品分离 | 取材记录（`sources-*.md`）与词条正文分离，正文只写确定的结论，缺口与排除记录有地方落 |
| 格式即代码 | 构建期硬校验字段白名单、正文小节、来源链接数、`sources-*.md` 存在、slug 与别名查重、related 引用 |
| 代词条定位 | 用 slug 定位（`/m/<slug>/`），别名参与查重，同一梗的不同叫法不会裂成两条 |
| 文档不手抄 | `docs/lexicon.md`（术语与别名索引）与 `docs/pending.md`（待补清单）都由脚本从词条数据生成 |
| 来源只看公开网页 | 事实与出处只能来自公开网络（原帖、官方新闻、媒体、wiki、可查的 KM/API 数据）或本仓库自己的素材；**不借用任何第三方整理仓库**，见 [AGENTS.md](AGENTS.md) 第 3 节 |

取材纪律（预算、按站间隔、403/429 立即停止、失败≠零结果、覆盖缺口如实声明）见 [AGENTS.md](AGENTS.md) 第 3 节。

## 文档

- [AGENTS.md](AGENTS.md) —— 代理与维护者规范（**唯一权威说明**）
- [docs/workflow.md](docs/workflow.md) —— 工作流：部件职责、一条梗的完整生命周期、哪里会自动拦住你
- [docs/meme-template.md](docs/meme-template.md) —— 词条模板
- [docs/lexicon.md](docs/lexicon.md) —— 术语表（由脚本生成）
- [docs/pending.md](docs/pending.md) —— 待补清单（由脚本生成）
- [docs/shared-sources/](docs/shared-sources/) —— 多条目共用的来源档

## 免责

词条内容来自公开社区资料与玩家自述，**多为一说之辞**；条目分级只表示「有无可核对来源」，不表示内容已被证实。本站与 CCP Games 无关，EVE Online 及相关名称为 CCP Games 所有。

**来源政策**：本站的事实与出处只取自公开网页（原帖、官方新闻与论坛、媒体报道、社区 wiki、可查的 KM/API 数据），不接受任何第三方整理仓库的内容；已有的词条如混入过这类引用，发现即删并用公开来源重立。

如你是文中当事人，认为内容有误或不当，请开 Issue，维护者处理。

## 许可

代码与站点结构采用 [MIT 许可](LICENSE)（Copyright (c) 2026 sangshineboy）。词条正文与取材记录引用的是公开社区内容，转载或引用请保留每条的出处链接。
