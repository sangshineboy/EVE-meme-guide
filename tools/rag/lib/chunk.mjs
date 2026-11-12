// 把文本/表格切成检索块。纯函数，不碰文件系统，方便测试。

import { normalize } from "./text.mjs";

export const MAX_CHUNK = 900;

/** 把长文本按句号/换行切成不超过 MAX_CHUNK 的片段。 */
export function splitLong(text) {
  const t = normalize(text);
  if (t.length <= MAX_CHUNK) return t ? [t] : [];
  const out = [];
  let rest = t;
  while (rest.length > MAX_CHUNK) {
    const win = rest.slice(0, MAX_CHUNK);
    let cut = Math.max(win.lastIndexOf("。"), win.lastIndexOf("\n"), win.lastIndexOf("；"), win.lastIndexOf("！"), win.lastIndexOf("？"));
    if (cut < MAX_CHUNK * 0.5) cut = MAX_CHUNK - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1);
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

/** Markdown → 块。按标题分节，超长再切；标题路径进 ctx。 */
export function chunkMarkdown(text, ctxBase) {
  const out = [];
  const lines = normalize(text).split("\n");
  let heads = [];
  let buf = [];
  let size = 0;

  const flush = () => {
    const body = buf.join("\n").trim();
    buf = [];
    size = 0;
    if (!body) return;
    const ctx = [ctxBase, heads.join(" > ")].filter(Boolean).join(" · ");
    for (const piece of splitLong(body)) out.push({ ctx, t: piece });
  };

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      flush();
      const level = m[1].length;
      heads = heads.slice(0, level - 1);
      heads[level - 1] = m[2].trim();
      heads = heads.filter(Boolean);
      continue;
    }
    buf.push(line);
    size += line.length;
    if (size >= MAX_CHUNK) flush();
  }
  flush();
  return out;
}

/** 一行表格 → 「表头: 值 | 表头: 值」。 */
export function rowToText(headers, cells) {
  const parts = [];
  for (let i = 0; i < cells.length; i++) {
    const v = String(cells[i] ?? "").trim();
    if (!v) continue;
    const h = String(headers[i] ?? "").trim();
    parts.push(h ? h + ": " + v : v);
  }
  return parts.join(" | ");
}

const nonEmpty = (r) => r.cells.filter((c) => String(c).trim()).length;

/** 一张工作表 → 块。首行表头，行号进 ctx；第一行只有一个格子时当标题处理。 */
export function chunkSheet(sheet, fileLabel) {
  const rows = sheet.rows.filter((r) => nonEmpty(r) > 0);
  if (!rows.length) return [];

  const lead = nonEmpty(rows[0]) === 1 && rows[1] && nonEmpty(rows[1]) >= 2 ? rowToText([], rows[0].cells) : "";
  const headerRow = lead ? rows[1] : rows[0];
  const headers = headerRow.cells.map((c) => String(c).trim());
  const bodyRows = rows.slice(lead ? 2 : 1);
  const ctx = fileLabel + " · 表「" + sheet.name + "」" + (lead ? " · " + lead : "");

  if (!bodyRows.length) {
    const t = normalize(rowToText([], headerRow.cells));
    return t ? [{ ctx, t }] : [];
  }

  const out = [];
  let buf = [];
  let size = 0;
  let startRow = null;
  let lastRow = null;

  const flush = () => {
    if (!buf.length) return;
    const body = buf.join("\n");
    const label = startRow === lastRow ? "第 " + startRow + " 行" : "第 " + startRow + "–" + lastRow + " 行";
    buf = [];
    size = 0;
    for (const piece of splitLong(body)) out.push({ ctx: ctx + " · " + label, t: piece });
    startRow = null;
    lastRow = null;
  };

  for (const r of bodyRows) {
    const line = rowToText(headers, r.cells);
    if (!line) continue;
    if (!buf.length) startRow = r.rowNum;
    buf.push(line);
    lastRow = r.rowNum;
    size += line.length;
    if (size >= MAX_CHUNK) flush();
  }
  flush();
  return out;
}
