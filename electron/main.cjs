/**
 * 文件用途：Electron 主进程入口。
 * 负责窗口创建、页面装载与应用生命周期管理。
 */
const path = require("node:path");
const fs = require("node:fs/promises");
const {
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    shell,
} = require("electron");

/**
 * Electron 窗口图标路径。
 * 使用 Windows 标准 .ico 图标，保证任务栏与窗口图标一致。
 */
const appIconPath = path.join(__dirname, "..", "src", "assets", "poprako-logo.ico");

/**
 * 记录窗口控制 IPC 是否已注册，避免重复注册导致事件重复触发。
 */
let hasRegisteredWindowControlHandlers = false;

/**
 * 支持导入为本地项目的图片扩展名集合。
 * 当前按静态图片处理，后续如需支持 AVIF 等格式可继续扩展。
 */
const PROJECT_IMAGE_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
]);

/**
 * Squirrel 安装事件处理。
 * 在 Windows 安装/卸载阶段主进程会被短暂拉起，此时应立即退出。
 */
if (require("electron-squirrel-startup")) {
    app.quit();
}

/**
 * 是否开发模式。
 * 有 VITE_DEV_SERVER_URL 时表示走 Vite 开发服务器。
 */
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);

/**
 * 根据事件来源解析对应窗口实例。
 */
function resolveSenderWindow(event) {
    return BrowserWindow.fromWebContents(event.sender);
}

/**
 * 注册窗口控制相关 IPC。
 * 供渲染层自定义标题栏调用最小化、最大化与关闭能力。
 */
function registerWindowControlHandlers() {
    if (hasRegisteredWindowControlHandlers) {
        return;
    }

    hasRegisteredWindowControlHandlers = true;

    ipcMain.on("window:minimize", (event) => {
        const senderWindow = resolveSenderWindow(event);
        if (!senderWindow || senderWindow.isDestroyed()) {
            return;
        }
        senderWindow.minimize();
    });

    ipcMain.on("window:toggle-maximize", (event) => {
        const senderWindow = resolveSenderWindow(event);
        if (!senderWindow || senderWindow.isDestroyed()) {
            return;
        }
        if (senderWindow.isMaximized()) {
            senderWindow.unmaximize();
            return;
        }
        senderWindow.maximize();
    });

    ipcMain.on("window:close", (event) => {
        const senderWindow = resolveSenderWindow(event);
        if (!senderWindow || senderWindow.isDestroyed()) {
            return;
        }
        senderWindow.close();
    });

    ipcMain.handle("window:is-maximized", (event) => {
        const senderWindow = resolveSenderWindow(event);
        if (!senderWindow || senderWindow.isDestroyed()) {
            return false;
        }
        return senderWindow.isMaximized();
    });

    ipcMain.handle("project:select-image-directory", async () => {
        const dialogResult = await dialog.showOpenDialog({
            title: "选择项目图片目录",
            buttonLabel: "选择该目录",
            properties: ["openDirectory"],
        });

        if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
            return null;
        }

        const directoryPath = dialogResult.filePaths[0];
        const files = await collectProjectImageFiles(directoryPath, directoryPath);

        return {
            directoryPath,
            files,
        };
    });

    /**
     * 读取本地图片文件并以 data URL 返回给渲染层。
     * 用于解决开发模式 (http://localhost) 无法直接引用 file:// 资源的问题。
     */
    ipcMain.handle("project:read-image-file", async (_event, filePath) => {
        try {
            const fileBuffer = await fs.readFile(filePath);
            const fileExtension = path.extname(filePath).toLowerCase();
            const extensionToMimeType = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".webp": "image/webp",
                ".gif": "image/gif",
                ".bmp": "image/bmp",
            };
            const mimeType = extensionToMimeType[fileExtension] || "image/jpeg";
            return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
        } catch {
            return null;
        }
    });
}

/**
 * 递归收集目录中的图片文件。
 * 返回值中的 name 使用相对路径，便于在前端保留稳定的页面显示顺序与来源提示。
 */
async function collectProjectImageFiles(currentDirectoryPath, rootDirectoryPath) {
    const entries = await fs.readdir(currentDirectoryPath, {
        withFileTypes: true,
    });

    const collectedFiles = [];

    for (const entry of entries) {
        const absolutePath = path.join(currentDirectoryPath, entry.name);

        if (entry.isDirectory()) {
            const nestedFiles = await collectProjectImageFiles(
                absolutePath,
                rootDirectoryPath,
            );
            collectedFiles.push(...nestedFiles);
            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        const extension = path.extname(entry.name).toLowerCase();
        if (!PROJECT_IMAGE_EXTENSIONS.has(extension)) {
            continue;
        }

        collectedFiles.push({
            name: path.relative(rootDirectoryPath, absolutePath).replace(/\\/g, "/"),
            path: absolutePath,
        });
    }

    collectedFiles.sort((leftFile, rightFile) => {
        return leftFile.name.localeCompare(rightFile.name, "zh-CN", {
            numeric: true,
            sensitivity: "base",
        });
    });

    return collectedFiles;
}

/**
 * 解析渲染层入口地址。
 * 开发模式返回 dev server URL，生产模式返回 dist/index.html。
 */
function resolveRendererEntry() {
    const devServerURL = process.env.VITE_DEV_SERVER_URL;
    if (devServerURL) {
        return {
            type: "url",
            value: devServerURL,
        };
    }

    return {
        type: "file",
        value: path.join(__dirname, "..", "dist", "index.html"),
    };
}

/**
 * 判断目标 URL 是否属于应用内部导航。
 * 内部导航应留在当前窗口，不应交给系统浏览器处理。
 */
function isInternalNavigationTarget(targetURL, currentURL) {
    try {
        const parsedTargetURL = new URL(targetURL);
        const parsedCurrentURL = new URL(currentURL);

        if (parsedTargetURL.protocol === "about:") {
            return true;
        }

        if (
            parsedTargetURL.protocol === "file:" &&
            parsedCurrentURL.protocol === "file:"
        ) {
            return true;
        }

        return parsedTargetURL.origin === parsedCurrentURL.origin;
    } catch {
        return false;
    }
}

/**
 * 配置窗口导航安全策略。
 * 所有外链统一在系统浏览器打开，避免应用内跳转到未知站点。
 */
function setupNavigationPolicy(mainWindow) {
    mainWindow.webContents.setWindowOpenHandler(({
        url
    }) => {
        const currentURL = mainWindow.webContents.getURL();

        if (isInternalNavigationTarget(url, currentURL)) {
            void mainWindow.webContents.loadURL(url);
            return {
                action: "deny"
            };
        }

        void shell.openExternal(url);
        return {
            action: "deny"
        };
    });

    mainWindow.webContents.on("will-navigate", (event, url) => {
        const currentURL = mainWindow.webContents.getURL();

        if (url === currentURL) {
            return;
        }

        if (isInternalNavigationTarget(url, currentURL)) {
            return;
        }

        event.preventDefault();
        void shell.openExternal(url);
    });
}

/**
 * 绑定窗口状态事件，主动向渲染层广播最大化状态变化。
 */
function bindWindowStateEvents(mainWindow) {
    const emitMaximizeState = () => {
        if (mainWindow.isDestroyed()) {
            return;
        }
        mainWindow.webContents.send("window:maximize-changed", mainWindow.isMaximized());
    };

    mainWindow.on("maximize", emitMaximizeState);
    mainWindow.on("unmaximize", emitMaximizeState);
    mainWindow.on("enter-full-screen", emitMaximizeState);
    mainWindow.on("leave-full-screen", emitMaximizeState);
    mainWindow.webContents.on("did-finish-load", emitMaximizeState);
}

/**
 * 创建主窗口并装载渲染页面。
 */
async function createMainWindow() {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 1024,
        minHeight: 680,
        icon: appIconPath,
        show: false,
        frame: false,
        autoHideMenuBar: true,
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    setupNavigationPolicy(mainWindow);
    bindWindowStateEvents(mainWindow);

    let hasShownWindow = false;

    /**
     * 统一窗口显示逻辑。
     * ready-to-show 可能在 loadURL/loadFile 过程中触发，需提前注册并做幂等保护。
     */
    const revealMainWindow = () => {
        if (hasShownWindow || mainWindow.isDestroyed()) {
            return;
        }

        hasShownWindow = true;
        mainWindow.show();
    };

    mainWindow.once("ready-to-show", revealMainWindow);
    mainWindow.webContents.once("did-finish-load", () => {
        console.info("[electron:main] 渲染层加载完成，准备显示窗口。");
        revealMainWindow();
    });
    mainWindow.webContents.on(
        "did-fail-load",
        (_event, errorCode, errorDescription, validatedURL) => {
            console.error(
                `[electron:main] 页面加载失败：code=${errorCode}, message=${errorDescription}, url=${validatedURL}`,
            );
            revealMainWindow();
        },
    );

    const rendererEntry = resolveRendererEntry();
    console.info(`[electron:main] 正在加载渲染入口：${rendererEntry.value}`);

    if (rendererEntry.type === "url") {
        await mainWindow.loadURL(rendererEntry.value);
    } else {
        await mainWindow.loadFile(rendererEntry.value);
    }

    if (isDevelopment && process.env.ELECTRON_OPEN_DEVTOOLS === "true") {
        mainWindow.webContents.openDevTools({
            mode: "detach"
        });
    }
}

app.whenReady().then(async () => {
    console.info("[electron:main] 应用已就绪，开始创建主窗口。");
    registerWindowControlHandlers();
    await createMainWindow();

    app.on("activate", async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createMainWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});