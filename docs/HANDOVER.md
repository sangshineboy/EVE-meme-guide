# 交接文档（HANDOVER）

> 写给下一位接手的人或代理。**最后核对：2026-11-16**（所有数字都是当天实测）。
> 规则以 [AGENTS.md](../AGENTS.md) 为准，本文只讲三件事：**现在真实状态、哪里还没做完、从哪接着干**。
> 本文取代 [NEXT-STEPS.md](NEXT-STEPS.md)——那份停在 2026-10-17（58 条时代），只作历史存档。

---

## 0. 一句话

Eleventy 静态站，**166 条词条**，最新代码在 `develop`；`main` 落后 4 个提交，**线上还是旧的 164 条三节版本，没上线**。

---

## 1. 当前状态快照

| 项 | 值 |
| --- | --- |
| 分支 | `develop`（HEAD `27ea5b7` 新增参考文献检索 RAG） |
| 本地 vs 远端 | `develop` 与 `EVE-meme-guide/develop` **一致**（0/0） |
| `main` | 比 `develop` **落后 4 个提交**（0/4），线上跑的是 main |
| 词条 | **166** 条（每条都有 `sources-*.md`） |
| 分类分布 | 舰长轶事 59 · 组织政治 43 · 社区文化 24 · 名场面 20 · 玩法 15 · 舰船 3 · 历史事件 2 |
| 黑话索引 | **615** 个术语（415 条对得上词条，380 条来自 `参考文献/`） |
| 热度排名 | `src/_data/ranking.json`，166 条 |
| 正文规模 | 33,463 字，单条中位数 **181 字** |
| `npm run check` | 通过（166 条） |
| `npm test` | **35/35** |
| `npm run build` | 通过，`_site/` **231 个页面** |
| 风格体检 | 硬指标超标 **31 条（19%）**；密度：破折号 19.7、分号 41.8、不是而是 2.4（每万字） |
| 待补清单 | 159 / 166 条有欠账（缺「用法」、缺别名、缺 related） |
| 参考文献仓库 | `EVE-meme-guide-references`，已提交、与远端一致、无未提交改动 |
| 工作区 | **6 个未提交改动**（见第 3 节） |
| 环境 | Node 24.22.1（要求 `>=20.11 <21 \|\| >=21.2`） |

---

## 2. 线上落后于本地（最该先处理的事）

| | 线上（`main`） | 本地（`develop`） |
| --- | --- | --- |
| 词条数 | 164 | **166** |
| 正文结构 | 旧三节：这个梗 / 出处与来历 / 怎么用 | **六节**：定义 / 溯源 / 用法 / 演变 / AI吐槽 / 参考文献 |
| 证据分级 | 有 `confidence` 字段 | 已删除 |
| RAG 检索 | 无 | 有 |

`develop` 领先的 4 个提交：

```
27ea5b7  新增参考文献检索（RAG）
223e51c  移除证据等级字段，正文禁用内联 HTML，收紧 Pages 权限
f0963e5  词条结构改为六节，新增三条欧服/录音类词条
97f82ce  清理 release 分支残留
```

**上线怎么做**（需要人工放行推送权限）：

```bash
git checkout main
git merge --ff-only develop
git push EVE-meme-guide main
```

推完 Actions 会自动构建并部署。注意两点：

- `github-pages` 环境**只允许 `main` 部署**，其他分支会被拒（`release` 已于 2026-10-23 删除）。
- 部署还受仓库变量 `ENABLE_PAGES = true` 控制；`Settings → Pages` 的 Source 必须是 "GitHub Actions"。

---

## 3. 未提交的 6 个改动（style-check 那一批）

| 文件 | 状态 |
| --- | --- |
| `tools/style-check.mjs` | 新增：扫破折号 / 分号 /「不是…而是」，挑出最像 AI 的条目 |
| `scripts/style.test.mjs` | 新增：13 条测试（`npm test` 从 22 → 35） |
| `docs/style.md` | 新增：阈值、真人基线对照、怎么改 |
| `AGENTS.md` | +3 行（第 4 节加「句子别左右摆」，第 5 节加 `style:check`） |
| `package.json` | +1 条脚本 `style:check` |
| `src/memes/kfc/kfc.md` | 按风格规范改写 8 处 |

这批**已经跑通**（check 通过、test 35/35、build 成功），只差提交。建议单独一个提交：「新增风格体检工具」。

---

## 4. 规格速查（改词条前必看）

### front matter：只允许 8 个字段

```yaml
slug: kfc            # 必填，与目录名一致
title: KFC           # 必填
aliases: ["肯德基"]   # 可选，影响搜索命中，建议多写
category: 社区文化    # 必填
scope: 端游          # 必填：端游 / 手游 / 通用
server: 国服         # 必填：国服 / 欧服 / 未标
labels: ["163百科"]  # 可选，字段名是 labels，不是 tags
related: [rmt]       # 可选，必须真实存在的 slug
updated_at: 2026-11  # 可选
```

### 正文：六节，名字与顺序固定

```
一句话定义（≤60 字）
## 定义        ← 必填，排第一
## 溯源
## 用法
## 演变
## AI吐槽      ← 末尾必须带「（AI 观点，不构成事实陈述。）」
## 参考文献     ← 必填，排最后，至少一条链接
```

小节名写错、顺序不对、`参考文献` 没有链接，`npm run check` 直接失败。

### 两个已删除的东西，**不要再加回来**

1. **证据分级**（`confidence: 已确认 / 社区流传`）——2026-11-08 按维护者要求整体删除。理由：梗不一定要有明确溯源，讲清意思就行。
2. **旧三节结构**（这个梗 / 变体与近亲 / 出处与来历）——2026-10-25 迁移到六节。

---

## 5. 命令清单

```bash
npm ci                  # 装依赖
npm run check           # 词条校验（改完必跑）
npm test                # 35 条仓库基线测试
npm run build           # 校验 + 渲染 + Pagefind 索引
npm run serve           # 本地预览 http://localhost:8080/
npm run clean           # 清 _site（删词条/改 slug 后必须先跑）
npm run new -- "名字" --slug x --category 名场面 --scope 端游 --server 未标
npm run find -- "关键词"   # 查重
npm run rag -- "关键词"    # 在 参考文献/ 里检索（改素材后先 npm run rag:build）
npm run style:check       # 风格体检，不卡构建，退出码恒 0
npm run gen:docs          # 重新生成 docs/lexicon.md 与 docs/pending.md
```

---

## 6. 已经完成的三次大迁移（别改回去）

| 时间 | 事件 | 影响面 |
| --- | --- | --- |
| 2026-10-22 前后 | 词条从 58 条扩到 166 条 | 105 条新词条进库 |
| 2026-10-25 | 三节 → **六节**（含 AI吐槽） | 166 条全量重写，`tools/migrate-sections.mjs` |
| 2026-11-08 | **删除证据分级** + 正文禁内联 HTML + CI 权限收紧 | schema、166 条词条、166 份素材、4 个页面 |
| 2026-11-08 | 新增 **RAG 本地检索**（BM25 + 中文 bigram） | `tools/rag/`、`docs/rag.md` |

同一天还修了 review 发现的一批问题：`find-meme` 的 `tags→labels`、`new-meme` 的 YAML 注入与漏字段、README 数字过期、双锁文件、CI 权限。

---

## 7. 已知遗留问题（按优先级）

| # | 问题 | 现状 | 怎么办 |
| --- | --- | --- | --- |
| 1 | `main` 落后 4 个提交 | 线上还是旧版 | 见第 2 节，合并上线 |
| 2 | **9 条词条把「未验证可达性」的链接挂进了参考文献** | `49-hui-zhan`、`cheng-shi-shou-xin-kang-shi-fu`、`jiang-shi-tiao-chao-qi-bao`、`lan-hui`、`qian-cheng-si-jin`、`ren-zai-ta-zai`、`wo-zhi-bo-chi-xiang`、`xue-mai-bu-xiang`、`ye-ye-yi-lu-zou-hao` | 逐条实测；打不开就改写成「圈里一说」并注明原链接失效 |
| 3 | **来源过度集中**：191 条参考文献链接里 **162 条（85%）**指向同一个 163 百科页 | 该页自述「网上收集，不保证准确性」 | 用 `npm run rag` 从 `参考文献/` 找新来源；B 站、贴吧、WinterCo 素材都已在库 |
| 4 | `jesus-n` 素材自相矛盾 | 排除记录写「攻击性称呼未写进正文」，正文却有 | 二者改一处 |
| 5 | `tou-song-tai-tan` 的 `server: 未标` | 来源视频标题明写「EVE 欧服」 | 改成 `欧服` |
| 6 | 33 条词条「溯源」不足 30 字（占位式） | 多为百科一句话存根 | 补料，或维持但标注待补 |
| 7 | 31 条风格硬指标超标 | 破折号 7 条、分号 22 条、不是而是 8 条 | `npm run style:check -- --slug <slug>` 单条改 |
| 8 | 159/166 条有欠账 | 主要缺「用法」与 `related` | `docs/pending.md` 按欠得多的排了序 |

---

## 8. 取材红线（不可越）

1. **禁用仓库**：严禁使用第三方华人列传整理仓库（「新伊甸野史」）的任何内容，具体仓名与 `grep` 自查命令见根目录 `AGENTS.md` 第 3 节（`src` 与 `docs` 下必须零输出）。
2. **死链不作出处**：外链写进「参考文献」前先验可达性；只剩二手来源时正文写明是转述。
3. **不编造**：没有出处的事件、对话、时间、数字、当事人一律不写；查不到就写进 `sources-*.md` 的「待核」。
4. **不写现实隐私**：真名、单位、住址、照片一律不写；不做地域、民族、性别、外貌歧视。
5. **遇 403 / 429 / 验证码**：立刻停止该站点，记 URL 与状态码，至少冷却 30 分钟，不换出口硬刷。

---

## 9. 踩过的坑

| 坑 | 说明 |
| --- | --- |
| 删词条或改 slug 后没 clean | `_site/` 不自动清理，旧页面会被 Pagefind 索引，搜索能搜到已撤下的内容。**先 `npm run clean` 再 build** |
| 手改生成文件 | `docs/lexicon.md`、`docs/pending.md`、`src/_data/lexicon.json` 都是生成的，改词条或改 `tools/` 脚本 |
| 中文搜索没词干 | Pagefind 对 zh-cn 是精确子串匹配，**别名写得全**才能搜到 |
| Windows 换行警告 | git 提示 `CRLF will be replaced by LF`，无害 |
| bash 在沙箱下不可用 | 本机 `workspace-write` 模式没有可用沙箱后端，跑不进 bash；需要 `danger-full-access`，或在 Settings → Plugins → dsh-gitbash-shell 关掉 fail-closed |
| `.cache/` 不进 git | 临时脚本与 RAG 索引都在里面，别当源码依赖 |
| `参考文献/` 是独立仓库 | `EVE-meme-guide-references`，在主仓库里被 gitignore；改素材要单独提交 |

---

## 10. 建议的下一步

1. **先提交 style-check 那批，再合并上线**（线上落后 4 个提交，用户看到的是旧站）。
2. **修第 7 节的第 2、4、5 项**：都是小改动，但直接关系到「出处可信」这条底线。
3. **继续扩源**：用 `npm run rag` 从本地素材里给已有词条补第二条来源，把 85% 的单源占比降下来——这是唯一的战略性问题。

---

## 11. 接手先跑一遍

```bash
cd EVE-meme-guide
node scripts/doctor.mjs        # 期望：环境与规格通过
npm run check                  # 期望：词条校验通过：166 条
npm test                       # 期望：tests 35 / pass 35 / fail 0
npm run build                  # 期望：exit 0，Indexed 166 pages，_site 共 231 页
npm run style:check            # 期望：硬指标超标 31 条（19%）
git status --short             # 期望：只有第 3 节那 6 个改动
```

四项都对得上，说明你看到的世界和这份文档一致，可以开始干活了。
