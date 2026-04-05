# Poprako Electron 前端说明

## 1. 项目概览

当前前端已升级为 Electron 桌面应用，渲染层仍使用 Vue 3 + TypeScript + Vite。

- 渲染层入口：`src/main.ts`
- Electron 主进程：`electron/main.cjs`
- Electron 预加载：`electron/preload.cjs`
- Electron Forge 配置：`forge.config.cjs`
- HTTP 客户端：`src/api/http.ts`
- API 模块聚合：`src/api/modules/index.ts`

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
- 开发态和本地 preview 如需转发到独立后端，可在对应模式文件里配置 `VITE_API_PROXY_TARGET=http://127.0.0.1:5485`。
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

说明：

- Forge 已配置三端 Maker：
  - Windows：Squirrel
  - macOS：ZIP
  - Linux：DEB / RPM
- 跨平台构建通常建议在对应系统执行（例如 macOS 产物建议在 macOS Runner 构建）。

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
