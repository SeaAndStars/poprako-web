/**
 * 文件用途：声明 Vite 客户端环境类型，提供 import.meta 的类型提示。
 */
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Electron 自定义标题栏可调用的窗口控制 API。
 */
interface DesktopWindowControls {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  getMaximized: () => Promise<boolean>;
  onMaximizeChanged: (callback: (isMaximized: boolean) => void) => () => void;
}

/**
 * Electron 客户端额外提供的项目目录选择能力。
 * web 环境下该能力不存在，前端需自行回退到 input 选择方案。
 */
interface DesktopProjectDialog {
  selectProjectDirectory: () => Promise<
    | {
        directoryPath: string;
        files: Array<{
          name: string;
          path: string;
        }>;
      }
    | null
  >;
}

/**
 * Electron 预加载脚本注入到渲染层的桥接对象。
 */
interface PoprakoDesktopBridge {
  platform: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
  windowControls?: DesktopWindowControls;
  projectDialog?: DesktopProjectDialog;
}

interface Window {
  poprakoDesktop?: PoprakoDesktopBridge;
}
