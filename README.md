# Neon Game Box

一个基于 Vue 3 和 Vite 构建的霓虹风浏览器小游戏合集。项目内置多款经典街机、益智、策略和休闲游戏，并提供本地进度记录、星级目标、每日挑战、战役路线和多人贪吃蛇联机房间。

## 项目亮点

- **30+ 款小游戏**：覆盖贪吃蛇、2048、俄罗斯方块、扫雷、数独、五子棋、飞机大战、泡泡龙等玩法。
- **统一游戏外壳**：所有游戏共享顶部信息栏、暂停、重开、结算弹窗、星级目标和进度反馈。
- **本地进度系统**：使用 `localStorage` 保存最高分、排行榜、最近游玩、星级成就和奖励解锁。
- **每日挑战**：每天生成推荐挑战和规则变体，适合短时间连续游玩。
- **战役与马拉松模式**：通过章节路线推进游戏目标，也可以进行每日 5 局马拉松挑战。
- **多人贪吃蛇**：支持创建房间、房间码加入、2-6 人实时对战，后端使用 Cloudflare Workers Durable Objects。
- **移动端友好**：开发服务器默认监听 `0.0.0.0`，方便在同一局域网内用手机调试。

## 在线玩法

首页展示的主要游戏包括：

| 类型 | 游戏 |
| --- | --- |
| 街机动作 | 贪吃蛇、打砖块、Flappy Bird、俄罗斯方块、飞机大战、飞船躲避陨石、贪吃蛇大作战、Boss Rush 飞机大战 |
| 益智解谜 | 2048、扫雷、数独、推箱子、迷宫探索、激光反射、汉诺塔、Lights Out、数字华容道 |
| 策略休闲 | 猜数字、井字棋、连连看、泡泡龙、五子棋、中文猜词 |
| 联机模式 | 多人贪吃蛇房间 |

部分实验性游戏已经保留在代码中，但暂未在首页开放。

## 技术栈

- **前端框架**：Vue 3
- **构建工具**：Vite
- **路由**：Vue Router，使用 Hash 路由以适配静态部署
- **图标**：lucide-vue-next + 自定义 SVG 游戏图标
- **数据存储**：浏览器 `localStorage`
- **联机服务**：Cloudflare Workers + Durable Objects + WebSocket

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- npm

### 安装依赖

```bash
npm install
```

### 启动开发服务

```bash
npm run dev
```

启动后在浏览器打开终端输出的本地地址。由于开发服务使用 `--host 0.0.0.0`，也可以用同一局域网内的移动设备访问对应地址进行测试。

### 构建生产版本

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。

### 预览生产构建

```bash
npm run preview
```

## 项目结构

```text
.
├── public/                 # 静态资源与 favicon
├── scripts/                # 图标、皮肤、食物素材生成脚本
├── src/
│   ├── assets/             # 游戏图标、贪吃蛇皮肤和食物素材
│   ├── components/         # 通用组件
│   ├── data/               # 游戏注册表和素材数据
│   ├── games/              # 每个小游戏的独立 Vue 组件
│   ├── router/             # 路由配置
│   ├── styles/             # 全局主题与游戏通用样式
│   ├── utils/              # 存储、进度、战役、触控等工具
│   └── views/              # 首页、战役、马拉松、联机大厅
├── worker/                 # Cloudflare Worker 联机房间服务
├── wrangler.toml           # Cloudflare Workers 部署配置
└── vite.config.js          # Vite 配置
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动本地开发服务 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 本地预览生产构建 |

## 部署说明

项目已包含 Cloudflare Workers 配置和 GitHub Actions 工作流。

### 使用 GitHub Actions 部署

推送到 `main` 分支后，`.github/workflows/deploy-worker.yml` 会自动执行：

1. 安装依赖
2. 执行 `npm run build`
3. 使用 Wrangler 部署到 Cloudflare Workers

需要在 GitHub 仓库中配置以下 Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 静态站点部署

由于项目使用 Hash 路由，`dist/` 也可以部署到 GitHub Pages、Cloudflare Pages、Netlify、Vercel 等静态托管平台。

如果要使用多人贪吃蛇联机功能，需要同时部署 `worker/` 中的 Cloudflare Worker 服务。

## 添加新游戏

1. 在 `src/games/` 下创建新的游戏组件。
2. 使用 `GameLayout.vue` 作为游戏页面外壳。
3. 在 `src/data/games.js` 中注册游戏名称、路由、图标、标签和描述。
4. 在 `src/router/index.js` 中添加懒加载路由。
5. 如需星级目标、每日规则或战役节点，可继续扩展 `src/utils/progress.js` 和 `src/utils/campaign.js`。

## 本地数据

游戏进度保存在浏览器 `localStorage` 中，键名前缀为：

```text
neon-game-box:
```

如需重置进度，可以在浏览器开发者工具中清除对应前缀的数据。

## 许可证

当前仓库暂未声明开源许可证。如需公开发布或允许他人复用代码，建议补充合适的 `LICENSE` 文件。
