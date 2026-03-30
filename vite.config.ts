/**
 * 文件用途：Vite 构建配置入口，负责注册 Vue 插件与开发/构建时的解析行为。
 */
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

function resolvePort(rawValue: string | undefined, fallback: number): number {
  const parsedPort = Number.parseInt(rawValue ?? "", 10);
  if (Number.isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    return fallback;
  }

  return parsedPort;
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

  return {
    // Electron 生产模式通过 file:// 加载页面，资源路径需使用相对路径。
    base: "./",
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
    },
    preview: {
      host,
      port: previewPort,
    },
  };
});
