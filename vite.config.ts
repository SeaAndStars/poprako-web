/**
 * 文件用途：Vite 构建配置入口，负责注册 Vue 插件与开发/构建时的解析行为。
 */
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

function resolvePort(rawValue: string | undefined, fallback: number): number {
  const parsedPort = Number.parseInt(rawValue ?? "", 10);
  if (Number.isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    return fallback;
  }

  return parsedPort;
}

function resolveOptionalValue(
  rawValue: string | undefined,
): string | undefined {
  const trimmedValue = rawValue?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function createProxyTable(
  apiProxyTarget: string | undefined,
): Record<string, ProxyOptions> {
  const proxyTable: Record<string, ProxyOptions> = {
    // 绕过本地开发环境下的 CDN 防机器人的 SameSite Cookie 多重重定向拦截限制
    "/_dev_avatar_proxy/": {
      target: "https://p1.seastarss.cn",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/_dev_avatar_proxy\//, "/"),
    },
  };

  if (!apiProxyTarget) {
    return proxyTable;
  }

  // 本地/预发布调试时通过 Vite 代理把同域 API 和 SignalR 请求转发到后端源站。
  proxyTable["/api"] = {
    target: apiProxyTarget,
    changeOrigin: true,
  };
  proxyTable["/hubs"] = {
    target: apiProxyTarget,
    changeOrigin: true,
    ws: true,
  };

  return proxyTable;
}

/**
 * 创建 Vite 配置对象。
 * 这里统一定义 Vue 插件、路径别名和可配置端口，确保开发环境灵活。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devPort = resolvePort(env.FRONTEND_PORT, 5173);
  const previewPort = resolvePort(env.FRONTEND_PREVIEW_PORT, 4173);
  const host = env.FRONTEND_HOST || "127.0.0.1";
  const apiProxyTarget = resolveOptionalValue(env.VITE_API_PROXY_TARGET);
  const proxyTable = createProxyTable(apiProxyTarget);
  const rendererTarget =
    process.env.POPRAKO_RENDERER_TARGET?.trim().toLowerCase() || "web";
  const assetBase = rendererTarget === "desktop" ? "./" : "/";

  return {
    // Web 部署使用绝对根路径，避免 history 路由刷新时把资源请求解析到子路径下；
    // Electron 打包后的 file:// 入口仍需相对路径资源。
    base: assetBase,
    plugins: [vue()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host,
      port: devPort,
      // Electron 开发模式依赖固定端口，避免 Vite 自动切换端口导致主进程加载失败。
      strictPort: true,
      proxy: proxyTable,
    },
    preview: {
      host,
      port: previewPort,
      proxy: proxyTable,
    },
  };
});
