// 极简 xlsx 读取：只用 node:zlib，不引第三方库。
//
// 支持：sharedStrings / inlineStr / 数字 / 布尔 / 公式缓存值；忽略样式、图表、批注、合并单元格。
// 日期单元格若在 Excel 里存成序列号，这里会返回序列号（本仓库的参考文献大多把日期存成文本）。
//
// 用法：
//   import { readXlsx } from "./xlsx.mjs";
//   const sheets = readXlsx("a.xlsx"); // [{ name, rows: [{ rowNum, cells: string[] }] }]

import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

function readZip(buf) {
  let eocd = -1;
  const stop = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= stop; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("不是有效的 zip（找不到 EOCD）");

  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = new Map();

  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CEN_SIG) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (buf.readUInt32LE(localOffset) !== LOC_SIG) continue;
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);
    entries.set(name, method === 0 ? raw : inflateRawSync(raw));
  }
  return entries;
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, g) => {
    if (g[0] === "#") {
      const code = g[1] === "x" || g[1] === "X" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[g] ?? m;
  });
}

function textOf(xml) {
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let m;
  while ((m = re.exec(clean))) out += decodeXml(m[1]);
  return out;
}

function attr(tag, name) {
  const m = tag.match(new RegExp("\\b" + name + "=\"([^\"]*)\""));
  return m ? decodeXml(m[1]) : "";
}

function colIndex(ref) {
  const letters = (ref.match(/^[A-Za-z]+/) || [""])[0].toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const rowAttrs = rm[1];
    const body = rm[2];
    const tag = "<row " + rowAttrs + ">";
    const rowNum = Number(attr(tag, "r")) || rows.length + 1;
    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(body))) {
      const cellAttrs = cm[1];
      const inner = cm[2] ?? "";
      const ctag = "<c " + cellAttrs + ">";
      const ref = attr(ctag, "r");
      const type = attr(ctag, "t");
      const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
      let value;
      if (type === "s") value = vm ? shared[Number(decodeXml(vm[1]))] ?? "" : "";
      else if (type === "inlineStr") value = textOf(inner);
      else if (type === "b") value = vm && decodeXml(vm[1]) === "1" ? "TRUE" : "FALSE";
      else if (type === "str") value = vm ? decodeXml(vm[1]) : textOf(inner);
      else value = vm ? decodeXml(vm[1]) : "";
      if (ref) cells[colIndex(ref)] = value;
    }
    rows.push({ rowNum, cells: Array.from(cells, (c) => c ?? "") });
  }
  return rows;
}

function sheetTargets(entries) {
  const wb = entries.get("xl/workbook.xml");
  const rels = entries.get("xl/_rels/workbook.xml.rels");
  if (!wb) throw new Error("缺少 xl/workbook.xml");
  const targets = new Map();
  if (rels) {
    const re = /<Relationship\b[^>]*>/g;
    let m;
    while ((m = re.exec(rels.toString("utf8")))) {
      const id = attr(m[0], "Id");
      const target = attr(m[0], "Target");
      if (id && target) targets.set(id, target.replace(/^\/?xl\//, "").replace(/^\//, ""));
    }
  }
  const out = [];
  const re = /<sheet\b[^>]*>/g;
  let m;
  while ((m = re.exec(wb.toString("utf8")))) {
    const name = attr(m[0], "name");
    const rid = attr(m[0], "r:id");
    out.push({ name, target: targets.get(rid) ?? "" });
  }
  return out;
}

export function readXlsx(file) {
  const buf = readFileSync(file);
  const entries = readZip(buf);
  const ssEntry = entries.get("xl/sharedStrings.xml");
  const shared = [];
  if (ssEntry) {
    const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    const xml = ssEntry.toString("utf8");
    let m;
    while ((m = re.exec(xml))) shared.push(textOf(m[1]));
  }
  const sheets = [];
  for (const { name, target } of sheetTargets(entries)) {
    const entry = entries.get("xl/" + target);
    if (!entry) continue;
    sheets.push({ name, rows: parseSheet(entry.toString("utf8"), shared) });
  }
  return sheets;
}
