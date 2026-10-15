# Involved（在场） —— 取材记录

- 取材日期：2026-10-14 ｜ 证据等级：已确认
- 来源政策：禁止引用任何第三方整理仓库；事实与出处只能来自公开网页

## 已核来源（本轮逐条核对）

| 来源 | 读出什么 | 覆盖 / 缺口 |
| --- | --- | --- |
| [ESI 角色接口 2118354268](https://esi.evetech.net/latest/characters/2118354268/?datasource=tranquility) | `description` 原文 = `Involved: ` + 九条 killReport 链接（阿扎里尔、神使、俄洛巴斯、冥府×3、夜神×2、万古）；游戏内 Character Title 为「少侠」 | CCP 官方公开接口，本条最硬的来源 |
| [zKillboard 角色统计](https://zkillboard.com/api/stats/characterID/2118354268/) | 同一段简介在 `info.description`；alltime 击杀约 891、总值约 3.83T、单杀 0；旗舰级击杀 112 条（泰坦 6、超级旗舰 4）；自身损失 43 次、约 135.5 亿 ISK | 统计随时间滚动，属**快照**；正文写「约 890／约 3.8 万亿」 |
| [KM 127229182](https://zkillboard.com/kill/127229182/) | 船型是 **Avatar（神使）**；2025-05-20 08:31、Erila；Total 244,562,305,834.65 ISK（页面标 244.56b）＝约 **2445.6 亿**；attackers 恰好 **64** 条；final blow = Young Renegade（2116709959） | 本轮实测值 |
| [KM 132527542](https://zkillboard.com/kill/132527542/) | 2026-01-10 04:20、4-HWWF（星门 YMJG-4）；Total 840,078,046,388.25 ISK ＝约 **8400.8 亿**；attackers **53** 条；final blow = zoriol the2nd（1019795244） | 本轮实测值 |
| [B 站《F1战士也是F1》](https://www.bilibili.com/video/BV1zku9zdEHe) | 标题《【EVEOnline】F1战士也是F1 - 2023-2025年中总结》；UP 主「少侠LNP」（mid 25786471）；简介原文「活成了自己最讨厌的样子。」；2025-07-20 发布 | 通过 B 站公开接口核对 |

## 本轮修正的错误（上一版写错的）

- **船型**：旧版写「Aphillo 那条神使」——KM 上的船是 **Avatar（神使）**，不是 Seraphim；攻击者 64 人无误，估值改为约 2445.6 亿。
- **KB 统计**：旧版「882 个击杀／约三万亿」是**旧快照**，现为约 891／约 3.83T；正文改为「约 890／约 3.8 万亿」并注明是滚动快照。
- **九条全部 `final_blow = false`**：已逐条确认，正文据此写「一条都不是自己打掉的」。

## 待核 / 已删

- **《侠盗猎坦手 Grand Theft Titan》与配文「千亿撤离，鼠鼠吃饱了」**：本轮在 B 站搜索、UP 主投稿接口与网页搜索里均**未找到**（space 接口返回 -403/-401，空间页是验证码页）。**已从正文删除**，不作为事实。
- 「Aphillo」这个称呼本轮未在 KM 页面确认到对应关系（final blow 是 Young Renegade），正文不再提该名字。

## 排除记录

- zKillboard 网页端不渲染角色简介，取证须走 ESI；已把 ESI 列为主来源。
- 已删除所有第三方整理仓库的引用。
