# Poprako Electron 前端说明

## 1. 项目概览

当前前端已升级为 Electron 桌面应用，渲染层仍使用 Vue 3 + TypeScript + Vite。

- 渲染层入口：`src/main.ts`
- Electron 主进程：`electron/main.cjs`
- Electron 预加载：`electron/preload.cjs`
- Electron Forge 配置：`forge.config.cjs`
- HTTP 客户端：`src/api/http.ts`
- API 模块聚合：`src/api/modules/index.ts`

## 1.1 状态管理（Pinia）

跨页面/跨组件共享状态统一使用 Pinia Store，入口：[`src/stores/index.ts`](src/stores/index.ts)。

| Store | 职责 |
|-------|------|
| `auth` | 登录令牌、用户资料、当前团队 |
| `theme` | 主题模式与界面密度 |
| `assetCache` | 资源 URL 跨页缓存 |
| `dashboard` | 工作台列表与下载弹窗 |
| `memberManagement` | 成员/团队/邀请管理 |
| `worksetDetail` | 工作集详情看板 |
| `superAdmin` | 超管后台 |
| `translatorUI` | 翻译器 UI 会话态 |
| `localProjects` / `onlineWorkspace` / `translatorCollaboration` / `translatorSettings` / `specialSymbols` | 翻译业务域 |

约定：
- 视图用 `storeToRefs(store)` 读响应式状态，actions 直接解构调用
- 需要持久化的 Store 继续在内部读写 `localStorage`
- 路由离开时可对纯 UI Store 调用 `$reset()` 或 `resetSession()`

## 2. 本地开发

```bash
pnpm install

# 仅前端 H5 调试
pnpm dev

# Electron + Vite 联调
pnpm electron:dev
```

说明：

- `pnpm electron:dev` 会先拉起 Vite，再自动等待服务可用后启动 Electron。
- 默认连接 `http://127.0.0.1:5173`，可通过当前 mode 对应 env 文件中的 `FRONTEND_HOST` / `FRONTEND_PORT` 覆盖。
- 当前已按模式拆分环境文件，日常开发优先使用 `.env.development`，可参考 `.env.example`。

## 2.1 模式环境变量

前端现在提供四套模式环境文件，按 Vite mode 自动切换：

- `.env.development`
- `.env.test`
- `.env.staging`
- `.env.production`

常用命令如下：

```bash
# 开发模式
pnpm dev

# 测试环境模式
pnpm dev:test

# 预发布环境构建
pnpm build:staging

# 正式环境构建（默认）
pnpm build
pnpm build:production
```

当前约定如下：

- `lpn.seastarss.cn` 是前端站点。
- 前端与后端 API 一起部署时，前端直接访问同域 `/api/v1`。
- 开发态和本地 preview 如需转发到独立后端，可在对应模式文件里配置 `VITE_API_PROXY_TARGET=http://127.0.0.1:18880`。
- SignalR 也走同域 `/hubs/translator-collaboration`，因此线上 Nginx 需要同时代理 `/api/` 和 `/hubs/`。

Vite 环境优先级仍然遵循 mode 规则，示例以 production 为例：

1. `.env.production`
2. `.env.production.local`
3. 当前 shell 已显式导出的环境变量

仓库里保留 `.env.example` 与 `.env.production.example` 作为参考样例。

## 3. 质量门禁（必须先通过）

在执行任何桌面打包或发布前，必须先通过以下校验：

```bash
pnpm lint
pnpm build
```

也可直接使用统一脚本（内部同样先做 lint + type-check + vite build）：

```bash
pnpm electron:verify
```

## 4. Electron Forge 三端构建

### 4.1 当前平台打包

```bash
pnpm electron:package
pnpm electron:make
```

### 4.2 指定平台构建

```bash
# Windows
pnpm electron:make:win

# macOS
pnpm electron:make:mac

# Linux
pnpm electron:make:linux
```

如果只想构建远程 Web 壳层，而不再把完整前端渲染资源打进 Electron 包，可使用 shell-only 构建：

```bash
# Windows 远程壳打包（推荐给线上 Electron 客户端）
pnpm electron:make:win:shell

# 仅本地打包壳层目录
pnpm electron:package:shell
```

说明：

- Forge 已配置三端 Maker：
  - Windows：Squirrel（Setup.exe / Setup.msi + RELEASES / nupkg）
  - macOS：ZIP
  - Linux：DEB / RPM
- 跨平台构建通常建议在对应系统执行（例如 macOS 产物建议在 macOS Runner 构建）。
- `electron:make:win:shell` 会在打包临时目录中裁剪为白名单内容，只保留 `package.json`、`.env.production` 以及 `electron/` 下的主进程、preload、回退页和运行时配置，不再把完整 `dist/`、`src/`、`node_modules/` 和其他开发文件打进安装包。

### 4.2.1 Electron 远程渲染入口

当设置以下环境变量后，打包后的 Electron 会优先加载线上站点，而不是本地 `dist/index.html`：

```bash
POPRAKO_RENDERER_REMOTE_URL=https://lpn.seastarss.cn
```

当前推荐的生产模式是：

- 业务页面、样式和大多数功能改动：只发布到 `https://lpn.seastarss.cn`
- Electron 主进程、preload、本地文件能力和壳层更新逻辑变动：才重新发布 Electron 安装包
- 远程站点不可达时：Electron 自动切回本地回退页，而不是直接空白

### 4.3 Windows MSI 首装与增量更新

当前 Windows 桌面端采用以下策略：

- 首次安装：使用 `pnpm electron:make:win` 生成的 MSI 分发。
- 后续更新：客户端运行后读取对象存储或 CDN 上的 Squirrel 更新源，通过 `RELEASES + *.nupkg` 执行后台增量更新。

推荐把 Windows 产物发布到固定目录，例如：

```text
https://cdn.example.com/poprako/stable/win32/x64/
```

目录下至少应包含：

- `Poprako Desktop Setup.msi`
- `Poprako Desktop Setup.exe`
- `RELEASES`
- `*.nupkg`

构建与运行时会读取以下环境变量：

```bash
# 打包后的桌面客户端从这里检查更新
POPRAKO_DESKTOP_UPDATE_BASE_URL=https://cdn.example.com/poprako/stable/win32/x64

# 构建下一版 Windows 安装包时，从这里拉取历史 RELEASES 以生成 delta 包
POPRAKO_DESKTOP_REMOTE_RELEASES_URL=https://cdn.example.com/poprako/stable/win32/x64

# 是否在打包后的桌面客户端自动检查更新
POPRAKO_DESKTOP_AUTO_UPDATE=true

# 自动检查更新间隔（分钟）
POPRAKO_DESKTOP_UPDATE_INTERVAL_MINUTES=60
```

说明：

- `POPRAKO_DESKTOP_UPDATE_BASE_URL` 指向包含 `RELEASES` 的最终目录，而不是站点根目录。
- `POPRAKO_DESKTOP_REMOTE_RELEASES_URL` 用于**发布构建**时生成 delta 包；本地 `electron:make:win` 默认不拉取历史包。发布到 CDN 前请用 `pnpm electron:make:win:release`（等价于设置 `POPRAKO_ELECTRON_ENABLE_DELTA=true`）。
- 配置了 `POPRAKO_RENDERER_REMOTE_URL` 时，`pnpm electron:make:win` 自动走 shell 打包（仅 lint/type-check，不跑桌面 vite 全量构建）。
- 需要完整内置 `dist/` 的安装包：`pnpm electron:make:win:full`。
- 迭代打包跳过门禁：`pnpm electron:make:win:fast`（shell 白名单复制；产物在 `out-shell/build-<时间戳>/make/`）。
- 仅加快 Windows 安装器生成（跳过 MSI）：`cross-env POPRAKO_ELECTRON_SKIP_MSI=true pnpm electron:make:win:fast`。
- 首次安装后的第一次启动会因 Squirrel 文件锁自动延后首次检查，避免 `--squirrel-firstrun` 阶段报错。
- 从“完整渲染层内置包”首次切换到“远程 Web 壳包”时，生成的首个 delta 仍可能较大；完成这次迁移后，后续只改 Web 业务页面时通常不需要重新发布桌面包。
- 若未开启 `POPRAKO_DESKTOP_AUTO_UPDATE` 或未配置更新源，客户端会跳过自动更新初始化，但不影响正常启动。

## 5. Electron Forge 发布（GitHub Release）

发布前在环境变量配置以下字段：

```bash
ELECTRON_GITHUB_OWNER=<仓库拥有者>
ELECTRON_GITHUB_REPO=<仓库名>
GITHUB_TOKEN=<具备 repo 权限的令牌>
```

然后执行：

```bash
pnpm electron:publish
```

说明：

- 发布器采用 `@electron-forge/publisher-github`。
- 若未配置 `ELECTRON_GITHUB_OWNER` 和 `ELECTRON_GITHUB_REPO`，将不会注入发布器。
- 当前 Windows 自动更新主路径默认面向对象存储或 CDN；GitHub Release 更适合作为备用发布通道。

## 6. API 层约定（与后端 Swagger 对齐）

### 6.1 单一请求出口

所有请求统一走 `src/api/http.ts` 的 `httpClient`：

- 自动注入 `Authorization`
- 解包后端响应 `{ code, message, data }`
- 401 时清理 token 并跳转登录页
- 查询参数支持 `includes[]`

### 6.2 已覆盖模块

- `auth.ts`：登录、注册、用户资料、用户头像预留/确认
- `team.ts`：团队列表、创建、更新、删除、团队头像预留/确认
- `workset.ts`：工作集列表、创建、更新、删除
- `comic.ts`：漫画列表、创建、更新、删除
- `chapter.ts`：章节列表、创建、更新、删除
- `assignment.ts`：分配列表、我的分配、创建、更新、删除
- `invitation.ts`：邀请列表、创建、更新、删除
- `member.ts`：成员列表、我的成员身份、创建、加入、更新角色、删除
- `page.ts`：页面列表、页面预留、页面状态更新、按章节清理页面
- `unit.ts`：页面单元列表、保存 unit diff

### 6.3 类型定义

- 通用类型：`src/types/common.ts`
- 领域类型：`src/types/domain.ts`

说明：为兼容历史页面，保留了部分旧字段（如 `username` / `avatar` / `title` / `role`）作为可选字段。

## 7. 后端 Swagger 同步流程

当后端接口更新时，建议按以下顺序同步：

1. 更新 `src/types/common.ts` 与 `src/types/domain.ts`
2. 更新 `src/api/modules/*` 的请求/响应类型与方法
3. 执行 `pnpm lint && pnpm build`

这样可以最早暴露类型漂移问题，减少运行时错误。

## 8. 常见问题排查

### 8.1 `pnpm electron:dev` 无窗口、看起来卡住

请先观察终端是否出现以下日志：

- `[electron:main] 正在加载渲染入口...`
- `[electron:main] 渲染层加载完成，准备显示窗口。`

若两条日志都出现，通常表示窗口已进入可显示阶段。

### 8.2 端口冲突导致 Electron 启动异常

开发模式固定使用 `5173` 端口，如果被旧进程占用会导致 Vite 启动失败。

可在 Windows PowerShell 执行：

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object OwningProcess
```

确认占用进程后结束它，再重新执行 `pnpm electron:dev`。
