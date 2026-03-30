/**
 * 文件用途：Electron 预加载脚本。
 * 在开启 contextIsolation 的前提下，向渲染层安全暴露只读运行时信息。
 */
const {
    contextBridge
} = require("electron");

contextBridge.exposeInMainWorld(
    "poprakoDesktop",
    Object.freeze({
        platform: process.platform,
        versions: {
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            node: process.versions.node,
        },
    }),
);