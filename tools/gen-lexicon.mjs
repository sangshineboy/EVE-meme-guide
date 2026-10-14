// 生成 docs/lexicon.md：从参考仓术语表里挑出「看梗会用到的词」，并保留出处归属。
//
//   node tools/gen-lexicon.mjs
//
// 说明：舰船译名（备注以「舰船名；」开头的词条）不重复搬运，
// 只保留机制、玩法、组织、术语类词条，并按「参考仓 + 原表」注明来源。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF = path.join(root, "..", "EVE-Online-Tranquility-Chinese-Personas", "docs", "glossary.md");
const OUT = path.join(root, "docs", "lexicon.md");
const REF_URL =
  "https://github.com/dddd4512kk-source/EVE-Online-Tranquility-Chinese-Personas/blob/main/docs/glossary.md";

if (!fs.existsSync(REF)) {
  console.error(`找不到参考仓术语表：${REF}\n请确认 ../EVE-Online-Tranquility-Chinese-Personas 存在。`);
  process.exit(1);
}

const rows = fs
  .readFileSync(REF, "utf8")
  .split("\n")
  .filter((l) => l.startsWith("| ") && !l.startsWith("| 英文") && !l.startsWith("| ---"))
  .map((l) => l.slice(1, -1).split("|").map((c) => c.trim()))
  .map(([term, cn, avoid, note, status]) => ({ term, cn, avoid, note, status }))
  .filter((r) => r.term && r.cn && r.note);

const isShip = (r) => r.note.startsWith("舰船名；");
const terms = rows.filter((r) => !isShip(r));
const ships = rows.filter(isShip);

const esc = (s) => String(s).replace(/\|/g, "\\|");
const table = (list) =>
  [
    "| 英文 / 黑话 | 中文（社区说法） | 不要译作 | 备注 | 状态 |",
    "| --- | --- | --- | --- | --- |",
    ...list.map(
      (r) => `| ${esc(r.term)} | ${esc(r.cn)} | ${esc(r.avoid === "—" ? "—" : r.avoid)} | ${esc(r.note)} | ${esc(r.status)} |`,
    ),
  ].join("\n");

const doc = `# 术语表（生成文件）

> 本文件由 \`node tools/gen-lexicon.mjs\` 从参考仓术语表生成，**不要手改**；要加词请改下面说明的来源表，再重新生成。
> 来源：[EVE-Online-Tranquility-Chinese-Personas/docs/glossary.md](${REF_URL})（CCP SDE 中文船名 + 社区通行说法）。

用途：写梗词条时统一称谓。表里没有的词，正文先保留原词或写一条有上下文的说明，**不要自造译名**。

- 原表共 ${rows.length} 条，其中舰船译名 ${ships.length} 条、其他术语 ${terms.length} 条。
- 舰船译名不在这里重复搬运，需要时查 [原表](${REF_URL})；本站只收「因某条船形成的说法」（见词条分类「舰船」）。
- **已确认** = 社区说法明确；**待复核** = 解释够读者理解上下文，但不强制据此改写正文。

## 机制、玩法与组织类术语（${terms.length} 条）

${table(terms)}

## 舰船译名索引（${ships.length} 条，仅列名）

> 完整备注见[原表](${REF_URL})。

${ships.map((r) => `- **${esc(r.term)}** → ${esc(r.cn)}`).join("\n")}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, doc);
console.log(`已生成 ${path.relative(root, OUT)}：术语 ${terms.length} 条、舰船 ${ships.length} 条。`);
