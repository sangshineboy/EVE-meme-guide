# EVE 梗指南

EVE Online 中文社区的**梗、黑话、名场面与圈内典故**词条库 —— 一条一页，讲清来历、用法，并且**逐条给出处**。

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

## 和参考项目的关系

本站的架构参照 [EVE-Online-Tranquility-Chinese-Personas](https://github.com/dddd4512kk-source/EVE-Online-Tranquility-Chinese-Personas)（「新伊甸野史」华人列传站）重做，保留了它最值钱的三件东西，并针对「梗」这种没有唯一 ID 的对象改了数据模型：

| 参考项目的做法 | 本站的对应做法 |
| --- | --- |
| 游戏数据一次性快照入库，构建不联网 | 词条不依赖外部接口；来源以链接形式沉淀，构建纯离线 |
| 素材（`materials-*.md`）与成品（列传）分离 | 取材记录（`sources-*.md`）与词条正文分离，缺口与排除记录有地方落 |
| 构建期硬校验 front matter、`:::` 块、军团 ticker | 构建期硬校验字段白名单、正文小节、来源链接数、`sources-*.md` 存在、slug 与别名查重、related 引用 |
| 代词条 ID 定位（`/p/<角色ID>/`） | 用 slug 定位（`/m/<slug>/`），别名参与查重，同一梗的不同叫法不会裂成两条 |
| 术语表驱动全站称谓 | 术语表由 `tools/gen-lexicon.mjs` 从参考仓术语表生成，**不手抄** |
| —— | `tools/gen-pending.mjs` 从词条数据生成待补清单，谁欠来源/别名/用法一目了然 |

取材纪律（预算、按站间隔、403/429 立即停止、失败≠零结果、覆盖缺口如实声明）见 [AGENTS.md](AGENTS.md) 第 3 节。

## 文档

- [AGENTS.md](AGENTS.md) —— 代理与维护者规范（**唯一权威说明**，[CLAUDE.md](CLAUDE.md) 是逐字副本）
- [docs/workflow.md](docs/workflow.md) —— 工作流：部件职责、一条梗的完整生命周期、哪里会自动拦住你
- [docs/meme-template.md](docs/meme-template.md) —— 词条模板
- [docs/lexicon.md](docs/lexicon.md) —— 术语表（由脚本生成）
- [docs/pending.md](docs/pending.md) —— 待补清单（由脚本生成）
- [docs/shared-sources/](docs/shared-sources/) —— 多条目共用的来源档

## 免责

词条内容来自公开社区资料与玩家自述，**多为一说之辞**；条目分级只表示「有无可核对来源」，不表示内容已被证实。本站与 CCP Games 无关，EVE Online 及相关名称为 CCP Games 所有。

如你是文中当事人，认为内容有误或不当，请开 Issue，维护者处理。
