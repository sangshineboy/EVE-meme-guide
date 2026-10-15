# 共享来源丙：贴吧与 B 站的可用访问方式

**类型**：取材基础设施（不是内容来源）
**归档日期**：2026-10-14
**用途**：记录「哪些入口能读、怎么读、读到什么程度」，避免下轮重复摸索。

---

## 1. 贴吧：网页端不可用，客户端接口可用

实测（2026-10-14，本机）：

| 入口 | 结果 |
| --- | --- |
| `tieba.baidu.com/p/<帖号>` 桌面网页 | **403 百度安全验证**（连首页也是） |
| `tieba.baidu.com/mo/q/m?kz=<帖号>` 移动网页 | **403 验证页** |
| 吧列表页 `tieba.baidu.com/f?kw=…`、站内搜索 | **403 验证页** |
| **`tiebac.baidu.com/c/f/pb/page`（客户端接口）** | ✅ **HTTP 200，`error_code: 0`，返回真实楼层** |
| **`tiebac.baidu.com/c/f/frs/page`（吧列表接口）** | ✅ HTTP 200，约 113 KB |

**关键点：客户端接口要求签名。** 把参数按字段名排序拼接，加盐 `tiebaclient!!!`，取 MD5 大写即 `sign`：

```
sign = MD5( 按字段名排序的 key=value 拼接 + "tiebaclient!!!" ).toUpperCase()
```

- 不带 `sign`：HTTP 200，但返回 `{"error_code":110001,"error_msg":"未知错误"}`——**这不是被拦截，是参数不合法**，容易误判成「贴吧封了」。
- 带 `sign`：`error_code: 0`，返回 `post_list` 等字段。

**数据形状**：`post_list[].content` 是**分段数组**，不是字符串——`type: 0` 是文本（取 `.text`），`type: 3` 是图片（含 `origin_src` 等三种尺寸链接），其余类型（表情、投票等）跳过。楼层号在 `post_list[].floor`，时间在 `post_list[].time`（Unix 秒）。

**纪律**：每页间隔 ≥2 秒、串行、不并发；单轮预算与其它站点合并计算；遇到非 0 错误码即停，不重试不改参数硬刷。

### 哪些接口可用（2026-10-14 实测）

| 用途 | 接口 | 结果 |
| --- | --- | --- |
| 读主题帖楼层 | `/c/f/pb/page`（`kz=<帖号>&pn=<页>`） | ✅ 可用，返回 `post_list` |
| 翻吧列表 / 发现新帖 | `/c/f/frs/page`（`kw=<吧名>&pn=<页>`） | ✅ 可用，返回 `thread_list`（含标题、回复数、首楼摘要） |
| **吧内搜索** | `/c/f/search`、`/c/s/search` | ❌ **HTTP 200 但返回空**（长度 0）——搜索不可用，别在这上面耗预算 |

**吧列表的字段坑**：标题在 `thread_list[].title`（是**字符串**，不是分段数组）；首楼在 `thread_list[].first_post_content`（**才是** `type:0` 分段数组）；时间字段有 `create_time` 与 `last_time`，**`last_time` 有时是空串**，换算日期前要先判断数值范围（>1e9 才当 Unix 秒），否则 `toISOString()` 会抛 `Invalid time value`。

**发现新帖的正确姿势**：搜索不可用，所以只能「按吧翻列表 + 按回复数筛选」。eve欧服吧首页 15 条主题里通常有 8–10 条回复数 ≥20 的有效帖，够用。

---

## 1.5 B 站欧服线的好入口（实战发现）

欧服战报类视频的评论区质量最高（UP 主会持续发同题材战报，评论区聚集当事人）。已验证的入口：

| UP 主 | 例 | 评论区特征 |
| --- | --- | --- |
| **EVE曼努尔** | [欧贝超旗泰坦战 BV1PNpg6FEHH](https://www.bilibili.com/video/BV1PNpg6FEHH/)、[总损失超8万亿 BV1BDp76rEbh](https://www.bilibili.com/video/BV1BDp76rEbh/) | 欧服会战实况，评论里有参战方当事人、战损讨论与圈内互喷（如「00 税猪 vs 低安精英」） |

**关键词建议**：`EVE欧服 FRT`、`EVE 凛冬`、`EVE 华人联盟` 这类**带服务器/联盟名的**查询，噪音远低于裸 `EVE 梗`（后者会被日本歌手 Eve、vtuber、同名手游淹没）。

---

## 2. B 站：数据接口基本可用，仅用户投稿接口被风控

实测（同日）：

| 入口 | 结果 |
| --- | --- |
| `/x/web-interface/view`（视频详情） | ✅ code 0 |
| `/x/web-interface/wbi/search/type`（**搜索**） | ✅ code 0，可指定 `search_type=video` |
| `/x/v2/reply`（**评论区**） | ✅ code 0（`oid` 用 aid） |
| `/x/web-interface/ranking/v2`（排行榜） | ✅ code 0 |
| `/x/space/arc/search`（用户投稿列表） | ❌ **412 request was banned** |
| `/x/space/acc/info`（用户信息） | ❌ -799 频率限制 |

**注意**：`/x/web-interface/search/type`（不带 wbi 那段）返回的是 **HTML 页面**而不是 JSON；要用 **`/x/web-interface/wbi/search/type`**。请求需带 `Referer: https://www.bilibili.com`。

**用户投稿接口返回 412 属风控**，本项目**不做绕过**（不伪造登录态、不换出口）；需要某位 UP 的投稿列表时记为覆盖缺口。

**关键词检索的噪音**：`EVE` 会被日本歌手 Eve、vtuber「Eve」、同名手游（无尽银河）、以及大量无关视频命中。有效做法：

- 加中文语境词（`EVE 黑话`、`EVE 抢暴`、`EVE 劝退`、`EVE 名场面`），并在标题里要求出现 `EVE` 或 `eve` 字样；
- 排除词：`eve's room`、`cos`、`梗百科`、`真白花音`、`自走棋`、`手游`（除非本条就是收手游梗）；
- 梗的真正产地是**评论区**（高赞评论），不是视频简介——`sort=2` 按热度取前 20 条。

工具：`tools/bili.mjs`（`search` / `video` / `replies` / `collect`），内置 3 秒间隔与 20 次/轮预算。

---

## 3. 这台机器上打不开的入口（记下来，别再试）

| 入口 | 现象 |
| --- | --- |
| `support.eveonline.com`（CCP 官方帮助中心） | Cloudflare 挑战页（403） |
| `forums.winterco.org` 正文本体 | TLS 被重置；**但 `.json` 端点与搜索引擎索引里的标题可用** |
| 知乎问题页 | 403 |
| NGA | 403，访客不可读 |
| `tieba.baidu.com` 网页端 | 全站 403（见上） |
| B 站 `space` 投稿接口 | 412 风控 |

**通用原则**：某个入口读不到，只记「未能取得」，不写成「不存在」；换入口要有依据，不做无限重试。
