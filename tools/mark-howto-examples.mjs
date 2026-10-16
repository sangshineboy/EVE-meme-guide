// 给缺标注的「怎么用」小节补上示例性质说明（可重复运行，已标注的会跳过）。
import fs from "node:fs";
import path from "node:path";

const memes = path.resolve(import.meta.dirname, "../src/memes");
const NOTE = "*说明：本节示例是常见句式的说明性写法，不是社区原话；带具体人名、数字或事件的句子会标明出处。*";

let added = 0;
for (const slug of fs.readdirSync(memes)) {
  const file = path.join(memes, slug, `${slug}.md`);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = src.match(/^##\s+怎么用\s*$/m);
  if (!m) continue;
  // 小节内容里已有该说明就跳过
  const after = src.slice(m.index + m[0].length);
  const nextHeading = after.search(/^##\s/m);
  const section = nextHeading === -1 ? after : after.slice(0, nextHeading);
  if (section.includes("说明性写法")) continue;
  const at = m.index + m[0].length;
  src = src.slice(0, at) + `\n\n${NOTE}\n` + src.slice(at);
  fs.writeFileSync(file, src);
  added++;
}
console.log(`补标注：${added} 条`);
