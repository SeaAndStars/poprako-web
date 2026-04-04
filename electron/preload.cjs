/**
 * 文件用途：Electron 预加载脚本。
 * 在开启 contextIsolation 的前提下，向渲染层安全暴露只读运行时信息。
 */
const {
    contextBridge,
    ipcRenderer,
} = require("electron");

/**
 * 绑定最大化状态变化监听。
 * 返回值用于在组件销毁时解除订阅，避免内存泄漏。
 */
function onMaximizeChanged(callback) {
    if (typeof callback !== "function") {
        return () => {};
    }

    const listener = (_event, isMaximized) => {
        callback(Boolean(isMaximized));
    };

    ipcRenderer.on("window:maximize-changed", listener);

    return () => {
        ipcRenderer.removeListener("window:maximize-changed", listener);
    };
}

contextBridge.exposeInMainWorld(
    "poprakoDesktop",
    Object.freeze({
        platform: process.platform,
        versions: {
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            node: process.versions.node,
        },
        windowControls: Object.freeze({
            minimize: () => ipcRenderer.send("window:minimize"),
            toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
            close: () => ipcRenderer.send("window:close"),
            getMaximized: () => ipcRenderer.invoke("window:is-maximized"),
            onMaximizeChanged,
        }),
        projectDialog: Object.freeze({
            selectProjectDirectory: () =>
                ipcRenderer.invoke("project:select-image-directory"),
            readImageFile: (filePath) =>
                ipcRenderer.invoke("project:read-image-file", filePath),
        }),
    }),
);