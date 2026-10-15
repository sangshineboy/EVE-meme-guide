import "./runtime.mjs";
import { createRequire } from "node:module";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// 环境预检：Node 版本、依赖、规格文件与站点数据是否齐全。
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../package.json", import.meta.url));
const errors = [];

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 11)) {
  errors.push(`Node 版本过低（当前 ${process.versions.node}，需要 ≥20.11）`);
}

for (const name of ["@11ty/eleventy", "gray-matter"]) {
  try {
    require.resolve(name);
  } catch {
    errors.push(`缺少依赖 ${name}：请先运行 npm ci`);
  }
}
try {
  await access(new URL("../node_modules/pagefind/lib/runner/bin.cjs", import.meta.url));
} catch {
  errors.push("缺少依赖 pagefind：请先运行 npm ci");
}

for (const file of ["scripts/schema.mjs", "scripts/loader.mjs", "src/_data/site.js"]) {
  try {
    await access(new URL(`../${file}`, import.meta.url));
  } catch {
    errors.push(`缺少文件 ${file}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`环境与规格通过（Node ${process.versions.node}）。`);
}
