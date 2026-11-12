// BM25 索引与检索。纯函数：给块数组，返回倒排；给索引与查询，返回排序后的命中。

import { normalize, termFreq, tokenize } from "./text.mjs";

export const K1 = 1.2;
export const B = 0.75;
export const CTX_WEIGHT = 0.4; // 出处行（文件名/表名）只按 0.4 个词频计，别让标题词压过正文

/** chunks: [{p, ctx, t}] → { chunks, lens, postings: Map<term, number[]> } */
export function buildIndex(input) {
  const chunks = input.map((c) => [c.p, c.ctx || "", c.t]);
  const postings = new Map();
  const lens = [];
  for (let id = 0; id < chunks.length; id++) {
    const [, ctx, body] = chunks[id];
    const tfMap = new Map();
    for (const [term, tf] of termFreq(body)) tfMap.set(term, tf);
    for (const [term, tf] of termFreq(ctx)) tfMap.set(term, (tfMap.get(term) ?? 0) + tf * CTX_WEIGHT);
    let len = 0;
    for (const [term, tf] of tfMap) {
      len += tf;
      let arr = postings.get(term);
      if (!arr) postings.set(term, (arr = []));
      arr.push(id, tf);
    }
    lens.push(len);
  }
  return { chunks, lens, postings };
}

/** 检索：返回 [{id, score, path, ctx, text}]，已排序。 */
export function search(index, query, { k = 6, filter = "" } = {}) {
  const { chunks, postings, lens } = index;
  const N = chunks.length;
  const avgdl = lens.reduce((a, b) => a + b, 0) / Math.max(N, 1) || 1;
  const qTerms = [...new Set(tokenize(query))];

  const allowed = filter ? new Set(chunks.map((c, i) => (c[0].includes(filter) ? i : -1)).filter((i) => i >= 0)) : null;

  const scores = new Map();
  for (const term of qTerms) {
    const arr = postings.get(term);
    if (!arr) continue;
    const df = arr.length / 2;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (let j = 0; j < arr.length; j += 2) {
      const id = arr[j];
      if (allowed && !allowed.has(id)) continue;
      const tf = arr[j + 1];
      const dl = lens[id] || avgdl;
      const s = (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * Math.max(dl, 1)) / avgdl));
      scores.set(id, (scores.get(id) ?? 0) + s);
    }
  }

  const phrase = normalize(query).toLowerCase().replace(/\s+/g, "");
  const hits = [];
  for (const [id, base] of scores) {
    const [p, ctx, t] = chunks[id];
    let s = base;
    if (phrase) {
      if (t.toLowerCase().replace(/\s+/g, "").includes(phrase)) s = s * 1.2 + 2;
      else if ((ctx + " " + t).toLowerCase().replace(/\s+/g, "").includes(phrase)) s += 0.6;
    }
    s += qTerms.filter((q) => ctx.toLowerCase().includes(q)).length * 0.3;
    hits.push({ id, score: s, path: p, ctx, text: t });
  }

  hits.sort((a, b) => b.score - a.score || a.id - b.id);
  return { hits, qTerms, total: hits.length, top: hits.slice(0, k) };
}
