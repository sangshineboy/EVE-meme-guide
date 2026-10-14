// 统一按 UTF-8 输出，避免 Windows 控制台把中文词条打成乱码。
for (const stream of [process.stdout, process.stderr]) {
  if (typeof stream.setDefaultEncoding === "function") stream.setDefaultEncoding("utf8");
}
