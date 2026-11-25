# 访问人数统计（腾讯云对接说明）

首页 `.intro` 下方已预留「累计访问人数」与「今日访问人数（按北京时间 00:00 重置）」展示组件（样式参考 `modeldial.com`）。

## 1. 前端已做的事

- 模板：[src/index.njk](../src/index.njk) 插入 `#visit-counter`，读取 `site.counterEndpoint`。
- 样式：[src/assets/css/site.css](../src/assets/css/site.css) 新增 `.visit-counter*`，适配亮色/暗色主题与手机窄屏。
- 脚本：[src/assets/js/counter.js](../src/assets/js/counter.js) 按北京时间当日去重上报（当天首次发 `POST`，同日刷新发 `GET`），接口未配置或请求失败时自动保持隐藏。
- 本地样式预览：运行 `npm run serve` 后访问 `http://localhost:8080/?preview-counter` 即可预览效果。

## 2. 腾讯云后端部署（`console.cloud.tencent.com`）

参考实现已放在 [tools/tencent-counter/index.js](../tools/tencent-counter/index.js)（Node.js Web 函数，监听 `9000` 端口）。

1. 在腾讯云控制台创建一个 **云函数 SCF（Web 函数，Node.js 20）**，开启公网访问（函数 URL 或 API 网关）。
2. 将 `tools/tencent-counter/index.js` 上传为代码包，若使用腾讯云 Redis 持久化，在代码目录下安装 `npm install redis` 后打包上传，并设置环境变量：
   - `REDIS_URL`：你的 Redis 连接串（如 `redis://:密码@内网IP:6379/0`）
   - `ALLOWED_ORIGINS`：`https://sangshineboy.github.io,http://localhost:8080`
   - `BASE_TOTAL`：可选，累计人数起始基数（默认 `0`）
3. 拿到公网 HTTPS 地址后，二选一启用前端接入：
   - 直接写进 [src/_data/site.js](../src/_data/site.js) 的 `counterEndpoint`；
   - 或在 GitHub 仓库 `Settings → Secrets and variables → Actions → Variables` 中新增 `COUNTER_ENDPOINT`，并在 `.github/workflows/deploy.yml` 的 build 步骤传入 `env: COUNTER_ENDPOINT: ${{ vars.COUNTER_ENDPOINT }}`。
