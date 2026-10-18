"""把 参考文献/ 里的术语类素材抽成 src/_data/lexicon-refs.json。

只在「参考文献有更新」之后手动跑一次：

    python tools/import-refs.py

产物 src/_data/lexicon-refs.json 要提交进仓库——CI 上没有 参考文献/（它在 .gitignore 里）。

抽取来源：
  1. 参考文献/163百科-游戏习语.xlsx      —— 110 条术语对照（分类 / 习语 / 释义）
  2. 参考文献/EVE手游黑话.txt            —— 手游黑话科普（按【分类】分段）
  3. 参考文献/B站视频转录/*.md           —— 视频里的「**术语**：释义」条目
  4. 参考文献/163百科-EVE的各种梗.xlsx    —— 梗名与别名（释义取正文首句）
"""

import json
import re
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "参考文献"
OUT = ROOT / "tools" / "data" / "lexicon-refs.json"

rows = []  # {term, desc, source, group, url}


def find(name):
    """按文件名在 参考文献/ 下递归找（目录结构会变，别写死路径）。"""
    hits = sorted(REF.rglob(name))
    return hits[0] if hits else None


def add(term, desc, source, group, url):
    term = (term or "").strip(" 　:：*「」 ")
    desc = re.sub(r"\s+", " ", (desc or "")).strip()
    # 页面模板字会被混进释义（小米社区那篇的尾部尤其明显），先切掉再截断
    desc = re.split(r"推荐资料|相关攻略|文章收藏成功|详情请进入个人中心|激活百科|你必须有一个|昵称[：:]|热门推荐", desc)[0]
    desc = re.sub(r"\s*(人\s*人|关闭|收藏)\s*$", "", desc).strip()
    if not term or len(term) > 30:
        return
    rows.append({"term": term, "desc": desc[:150], "source": source, "group": group, "url": url})


# ---------- 1) 163百科《游戏习语》（资料区通用格式：小节 / 条目号 / 正文） ----------
p = find("163百科-48-游戏习语.xlsx")
if p:
    ws = load_workbook(p, data_only=True)["内容"]
    for r in list(ws.iter_rows(values_only=True))[1:]:
        group, _no, text = r[:3]
        term, _, desc = str(text or "").partition(" —— ")
        add(term, desc, "百科·习语", group, "https://evepc.baike.163.com/ziliao/48.html")

# ---------- 2) 手游黑话科普 ----------
p = find("EVE手游黑话.txt")
if p:
    group = "手游黑话"
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"^【([^】]+)】$", line)
        if m:
            group = m.group(1)
            continue
        m = re.match(r"^(.{1,20}?)\s*[：:]\s*(.+)$", line)
        if m and "http" not in m.group(1):
            # 文本末尾混进了站点模板字，截掉
            desc = re.split(r"推荐资料|相关攻略|热门推荐|小编推荐", m.group(2))[0]
            desc = re.sub(r"\s*(人\s*人|分享到|收藏)\s*$", "", desc).strip()
            add(m.group(1), desc, "小米·手游黑话", group,
                "https://game.xiaomi.com/viewpoint/1103611977_1654096587098_16")

# ---------- 3) B站视频转录 ----------
for p in sorted(REF.rglob("B站视频转录/*.md")) if REF.exists() else []:
    part = "上集" if "上集" in p.name else "下集"
    text = p.read_text(encoding="utf-8")
    for line in text.splitlines():
        m = re.match(r"^\s*-\s*\*\*(.+?)\*\*\s*[：:]\s*(.+)$", line)
        if not m:
            continue
        head, desc = m.group(1), m.group(2)
        # 「推子/微驱」这类合称拆开，各自登记，释义保持一致
        for term in re.split(r"[/／]", head):
            add(term, desc, f"B站·黑话{part}", "视频黑话",
                "https://www.bilibili.com/video/BV1dC4y1X7eP/" if part == "上集"
                else "https://www.bilibili.com/video/BV1pN4y1474K/")

# ---------- 4) 163百科《EVE的各种梗》：梗名与别名（资料区通用格式） ----------
p = find("163百科-66-EVE的各种梗.xlsx")
if p:
    ws = load_workbook(p, data_only=True)["内容"]
    for r in list(ws.iter_rows(values_only=True))[1:]:
        status, no, text = r[:3]
        head, _, desc = str(text or "").partition(" —— ")
        # 变形：梗名（别名：A、B）  或  梗名
        m = re.match(r"^(.*?)（别名：(.*?)）$", head)
        name, aliases = (m.group(1), [a for a in m.group(2).split("、") if a]) if m else (head, [])
        desc = re.sub(r"\s+", " ", desc)
        if not desc or "仅列名" in desc:
            desc = "（百科仅列名，未给解释）"
        url = "https://evepc.baike.163.com/ziliao/66.html"
        add(name, desc[:160], f"百科·梗#{no}", "梗名", url)
        for a in aliases:
            add(a, desc[:160], f"百科·梗#{no}（别名）", "梗名", url)

# ---------- 去重：同名词条合并来源 ----------
merged = {}
for r in rows:
    key = r["term"].lower()
    cur = merged.get(key)
    if not cur:
        merged[key] = dict(r)
        continue
    # 合并来源标签
    srcs = cur["source"].split("；")
    if r["source"] not in srcs:
        cur["source"] = cur["source"] + "；" + r["source"]
    # 释义保留更长的一条
    if len(r["desc"]) > len(cur["desc"]):
        cur["desc"] = r["desc"]
    # group 保留更具体的（梗名 < 习语 < 视频黑话）
    if cur["group"] == "梗名" and r["group"] != "梗名":
        cur["group"] = r["group"]

out = sorted(merged.values(), key=lambda x: x["term"])
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

groups = {}
for x in out:
    groups[x["group"]] = groups.get(x["group"], 0) + 1
print(f"已写出 {OUT.relative_to(ROOT)}：{len(out)} 个术语（合并前 {len(rows)} 条）")
print("分组：" + "、".join(f"{k} {v}" for k, v in sorted(groups.items(), key=lambda i: -i[1])))
