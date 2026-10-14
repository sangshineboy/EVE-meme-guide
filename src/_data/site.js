export default {
  // 站点名称：改这里即可全站生效
  title: "EVE 梗指南",
  seal: "梗", // 左上角印章字
  subtitle: "EVE Online 中文社区梗、黑话与名场面",
  description:
    "EVE Online 中文社区的梗、黑话、名场面与圈内典故词条库：一条一页，讲清来历、用法与出处。",
  lang: "zh-CN",
  // 分类与证据等级的展示顺序（与 scripts/schema.mjs 保持一致）
  categoryOrder: ["名场面", "历史事件", "组织政治", "玩法", "机制", "舰船", "社区文化", "舰长轶事"],
  confidenceOrder: ["已确认", "社区流传"],
  build: Date.now().toString(36), // 每次构建变化，用于给 CSS/JS 加版本号
};
