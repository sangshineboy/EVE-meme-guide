// 测试入口：**在当前进程内直接加载测试文件**，不 spawn 子进程。
//
// 为什么不用 `node --test scripts/*.test.mjs`：
//   · 受限沙箱里 node --test 会为每个文件 spawn 子进程，管道 stdio 被拒 → spawn EPERM；
//   · `--test-isolation=none` 能绕开沙箱，但那是新版本才有的选项，CI 的 Node 22 不认识、会直接退出。
// 同进程 import 两个问题都没有：node:test 在当前进程里注册并运行，退出码由测试结果决定，
// 而且不需要复制测试文件列表（改文件名不用同步改这里）。
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

if (!files.length) {
  console.error("没有找到任何 *.test.mjs 测试文件");
  process.exit(1);
}

for (const f of files) {
  await import(pathToFileURL(path.join(dir, f)).href);
}
