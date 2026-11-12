// 中文/英文混合分词与文本工具。
// 不引词典：CJK 走字符二元组（bigram），英文/数字走小写词；这是无依赖检索里最稳的中文近似。
// 缺点：查「红罐凉茶」时 bigram 会把「罐凉」「凉茶」都算上，语义近但字面不同的词不会命中——
// 所以词条名、标题这类上下文行会一并进索引，靠字面共现兜底。

const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const SEGMENT = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+|[a-z0-9_]+/g;

/** 清洗：去零宽字符、统一换行、折叠空白。保留全角标点，正文要能原样回显。 */
export function normalize(text) {
  return String(text ?? "")
    .replace(/[\u200b-\u200f\u2028\u2029\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .trim();
}

/** 切成检索词：CJK bigram + 拉丁词。 */
export function tokenize(text) {
  const s = normalize(text).normalize("NFKC").toLowerCase();
  const tokens = [];
  SEGMENT.lastIndex = 0;
  let m;
  while ((m = SEGMENT.exec(s))) {
    const seg = m[0];
    if (CJK_CHAR.test(seg)) {
      if (seg.length === 1) tokens.push(seg);
      else for (let i = 0; i < seg.length - 1; i++) tokens.push(seg.slice(i, i + 2));
    } else if (seg.length >= 2) {
      tokens.push(seg);
    }
  }
  return tokens;
}

/** 统计词频，返回 Map<term, tf>。 */
export function termFreq(text) {
  const tf = new Map();
  for (const t of tokenize(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

/** 在原文里截一段包含检索词的片段。 */
export function snippet(text, terms, pad = 40, max = 240) {
  const t = normalize(text).replace(/\n+/g, " ");
  if (!t) return "";
  let hit = -1;
  for (const term of terms) {
    const i = t.toLowerCase().indexOf(term);
    if (i >= 0 && (hit < 0 || i < hit)) hit = i;
  }
  if (hit < 0) hit = 0;
  const start = Math.max(0, hit - pad);
  const end = Math.min(t.length, start + max);
  return (start > 0 ? "…" : "") + t.slice(start, end) + (end < t.length ? "…" : "");
}
