"""梗排名：按「视频播放量 + 引用数量」给全部词条排序（夯 → 顶级 → 人上人 → NPC → 拉完了）。

口径：
  视频播放量 = 词条名/别名在视频标题+弹幕+评论里出现过的那些视频的播放数之和
  引用数量   = 出处链接数 + 参考语料命中数
  综合分     = 0.6 × 播放分（log 归一到 10）+ 0.4 × 引用分
输出：src/_data/ranking.json（站点排序用）+ 参考文献/EVE梗排名-播放量与引用.xlsx + 控制台榜单
"""

import json
import math
import re
from collections import Counter
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "参考文献"
CACHE = ROOT / ".cache"
OUT = REF / "EVE梗排名-播放量与引用.xlsx"

HEAD_FILL = PatternFill("solid", fgColor="1F4E79")
HEAD_FONT = Font(bold=True, color="FFFFFF", size=11)
TITLE_FONT = Font(bold=True, size=13, color="1F4E79")
thin = Side(style="thin", color="D9D9D9")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)

TIERS = [
    ("夯", 8.0, PatternFill("solid", fgColor="F8CBAD")),
    ("顶级", 6.0, PatternFill("solid", fgColor="FFE699")),
    ("人上人", 4.0, PatternFill("solid", fgColor="E2EFDA")),
    ("NPC", 2.0, PatternFill("solid", fgColor="DDEBF7")),
    ("拉完了", 0.0, PatternFill("solid", fgColor="F2F2F2")),
]

# ---------- 1) 词条 ----------
def parse(p):
    t = p.read_text(encoding="utf-8")
    fm = t.split("---")[1] if t.startswith("---") else ""
    title = re.search(r"^title:\s*(.+)$", fm, re.M)
    ali = re.search(r"^aliases:\s*(.+)$", fm, re.M)
    names = []
    if title:
        names.append(title.group(1).strip().strip('"'))
    if ali:
        names += [a.strip().strip('"') for a in re.findall(r'"([^"]+)"', ali.group(1))]
    body = t.split("---", 2)[2] if t.count("---") >= 2 else ""
    cat = re.search(r"^category:\s*(.+)$", fm, re.M)
    return {
        "slug": p.parent.name,
        "title": names[0] if names else p.parent.name,
        "names": [n for n in names if len(n) >= 2],
        "category": cat.group(1).strip() if cat else "",
        "body": body,
    }

entries = [parse(p) for p in sorted((ROOT / "src" / "memes").glob("*/*.md")) if not p.name.startswith("sources-")]

# ---------- 2) 视频 ----------
videos = []
for f in sorted(CACHE.glob("bili-BV*.json")):
    if "-full" in f.name:
        continue
    d = json.loads(f.read_text(encoding="utf-8"))
    info = d.get("info") or {}
    if not info.get("view"):
        continue
    text = [info.get("title", ""), info.get("desc", "") or ""]
    text += [x.get("text", "") for x in (d.get("danmaku") or [])]
    full = CACHE / f"bili-{f.stem.replace('bili-', '')}-full.json"
    if full.exists():
        for c in json.loads(full.read_text(encoding="utf-8")):
            text.append(c.get("text", ""))
            for r in c.get("replies", []):
                text.append(r.get("text", ""))
    videos.append({
        "bv": info.get("bvid") or f.stem.replace("bili-", ""),
        "title": info.get("title", ""),
        "view": info.get("view", 0),
        "text": "\n".join(text),
    })
print(f"视频 {len(videos)} 条，合计播放 {sum(v['view'] for v in videos):,}")

# ---------- 3) 引用语料 ----------
def xlsx_text(path, sheet=None):
    wb = load_workbook(path, data_only=True, read_only=True)
    ws = wb[sheet] if sheet else wb[wb.sheetnames[0]]
    out = []
    for row in ws.iter_rows(values_only=True):
        for c in row:
            if isinstance(c, str) and len(c) > 1:
                out.append(c)
    wb.close()
    return "\n".join(out)

corpora = {}
cand = {
    "163百科·梗": REF / "163百科" / "资料区各页" / "163百科-66-EVE的各种梗.xlsx",
    "163百科·习语": REF / "163百科" / "资料区各页" / "163百科-48-游戏习语.xlsx",
    "贴吧·梗合集": REF / "贴吧" / "EVE梗合集-贴吧5906210225.xlsx",
    "贴吧·红罐凉茶": REF / "贴吧" / "EVE梗-红罐凉茶-贴吧8050878800.xlsx",
    "贴吧·冰岛原神": REF / "贴吧" / "冰岛原神-梗图对照表.xlsx",
    "贴吧·40电池": REF / "贴吧" / "EVE40衍生大电池事件-贴吧三帖合辑.xlsx",
    "领航员·642篇": REF / "EVE领航员" / "EVE领航员-梗素材候选.xlsx",
    "欧服吧·346帖": REF / "贴吧" / "EVE欧服吧-梗候选主题链接.xlsx",
}
for k, p in cand.items():
    if p.exists():
        corpora[k] = xlsx_text(p)
for p in (REF / "B站视频转录").glob("*.md"):
    corpora[f"B站转录·{p.stem[:6]}"] = p.read_text(encoding="utf-8")
for d in ("梗图", "聊天记录"):
    p = REF / d
    if p.exists():
        corpora[f"{d}文件名"] = "\n".join(x.name for x in p.iterdir())
wc = REF / "WinterCo-N老板小作文" / "文章"
if wc.exists():
    corpora["WinterCo·53篇"] = "\n".join(x.read_text(encoding="utf-8") for x in wc.glob("*.md"))

# ---------- 4) 打分 ----------
rows = []
for e in entries:
    hit_videos, views, matched_by = [], 0.0, set()
    for v in videos:
        if len(e["title"]) < 2:
            continue
        if len(e["title"]) >= 2 and e["title"] in v["text"]:
            views += v["view"]
            hit_videos.append(v)
            matched_by.add("标题")
        else:
            alias_hit = [n for n in e["names"] if n != e["title"] and n in v["text"]]
            if alias_hit:
                best = max(len(a) for a in alias_hit)
                views += v["view"] * (0.7 if best >= 4 else 0.25)   # 长别名 70%、短别名 25%
                hit_videos.append(v)
                matched_by.add("别名")
    views = int(views)
    hit_corp = [k for k, t in corpora.items() if any(n in t for n in e["names"])]
    links = len(re.findall(r"\]\((https?://[^)\s]+)\)", e["body"]))
    citations = links + len(hit_corp)

    view_score = min(10.0, math.log10(1 + views) * 2.5) if views else 0.0
    cite_score = min(10.0, citations * 1.4)
    total = round(0.6 * view_score + 0.4 * cite_score, 2)
    tier = ""  # 排序后按分位赋值

    rows.append({
        **e, "views": views, "videoCount": len(hit_videos),
        "videoTitles": "、".join(v["title"][:18] for v in hit_videos[:2]),
        "links": links, "corpora": len(hit_corp), "corpusNames": "、".join(hit_corp[:3]),
        "citations": citations, "viewScore": round(view_score, 1), "citeScore": round(cite_score, 1),
        "total": total, "tier": tier, "matchedBy": "+".join(sorted(matched_by)) or "—",
    })

rows.sort(key=lambda r: (-r["total"], -r["views"], -r["citations"]))
n = len(rows)
for i, r in enumerate(rows):
    q = i / n
    r["tier"] = "夯" if q < 0.10 else "顶级" if q < 0.30 else "人上人" if q < 0.70 else "NPC" if q < 0.90 else "拉完了"

print("\n=== 夯（前 12）===")
for r in rows[:12]:
    print(f"  {r['total']:>5}  | 播放 {r['views']:>7,}  | 引用 {r['citations']:>2} | {r['title'][:24]}")
print("\n=== 拉（后 8）===")
for r in rows[-8:]:
    print(f"  {r['total']:>5}  | 播放 {r['views']:>7,}  | 引用 {r['citations']:>2} | {r['title'][:24]}")

# 站内排序用的数据：slug → 排名 / 档位 / 分数
rank_map = {
    r["slug"]: {"rank": i + 1, "tier": r["tier"], "total": r["total"],
                 "views": r["views"], "citations": r["citations"]}
    for i, r in enumerate(rows)
}
out_json = ROOT / "src" / "_data" / "ranking.json"
out_json.write_text(json.dumps(rank_map, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"已写 {out_json.relative_to(ROOT)}")

dist = Counter(r["tier"] for r in rows)
print("\n档位分布：", dict(dist))
with_video = [r for r in rows if r["views"] > 0]
print(f"有视频覆盖的词条：{len(with_video)} / {len(rows)}")

# ---------- 5) Excel ----------
wb = Workbook()
ws = wb.active
ws.title = "梗排名"
cols = ["排名", "档", "综合分", "词条", "分类", "播放量合计", "涉及视频数", "引用数", "出处链接", "语料命中", "播放分", "引用分", "匹配方式", "命中语料", "涉及视频"]
ws.append(cols)
for c in ws[1]:
    c.fill, c.font, c.border = HEAD_FILL, HEAD_FONT, BORDER
    c.alignment = Alignment(horizontal="center", vertical="center")
ws.row_dimensions[1].height = 28

tier_fill = {name: fill for name, _, fill in TIERS}
for i, r in enumerate(rows, 1):
    ws.append([i, r["tier"], r["total"], r["title"], r["category"], r["views"], r["videoCount"],
               r["citations"], r["links"], r["corpora"], r["viewScore"], r["citeScore"], r["matchedBy"],
               r["corpusNames"], r["videoTitles"]])
    row = ws.max_row
    ws.cell(row, 2).fill = tier_fill[r["tier"]]
    ws.cell(row, 3).fill = tier_fill[r["tier"]]
    for col in range(1, len(cols) + 1):
        cell = ws.cell(row, col)
        cell.border = BORDER
        cell.alignment = Alignment(vertical="top", wrap_text=col in (4, 13, 14),
                                   horizontal="center" if col not in (4, 5, 13, 14) else "left")

for col, w in zip("ABCDEFGHIJKLMNO", (6, 5, 7, 32, 11, 12, 10, 7, 8, 8, 7, 7, 9, 32, 40)):
    ws.column_dimensions[col].width = w
ws.freeze_panes = "D2"
ws.auto_filter.ref = f"A1:O{ws.max_row}"

# 口径页
s2 = wb.create_sheet("口径与分布")
s2["A1"] = "排名口径"
s2["A1"].font = TITLE_FONT
s2.append([])
s2.append(["项目", "说明"])
for c in s2[3]:
    c.fill, c.font, c.border = HEAD_FILL, HEAD_FONT, BORDER
    s2.append(["视频播放量", f"词条名/别名出现在视频标题、弹幕或评论里，就把该视频播放数计入；本次覆盖 {len(videos)} 条视频，合计 {sum(v['view'] for v in videos):,} 次播放"])
s2.append(["引用数", "出处链接数 + 命中的参考语料数（百科/贴吧/B站转录/领航员/欧服吧/WinterCo/梗图/聊天记录）"])
s2.append(["播放分", "log10(1+播放量) × 2.5，封顶 10"])
s2.append(["引用分", "引用数 × 1.4，封顶 10"])
s2.append(["综合分", "0.6 × 播放分 + 0.4 × 引用分"])
s2.append(["档位", "夯（前 10%）→ 顶级（20%）→ 人上人（40%）→ NPC（20%）→ 拉完了（后 10%），按综合分排名分位划定"])
s2.append(["局限", f"只有 {len(with_video)} 条词条能被视频覆盖；其余播放量为 0，排名主要靠引用数——这是素材覆盖的差距，不完全是梗的知名度"])
for row in s2.iter_rows(min_row=4, max_row=s2.max_row):
    for cell in row:
        cell.border = BORDER
        cell.alignment = Alignment(vertical="top", wrap_text=True)
s2.column_dimensions["A"].width = 14
s2.column_dimensions["B"].width = 100

wb.save(OUT)
print(f"\n已生成 {OUT.name}：{len(rows)} 行")
