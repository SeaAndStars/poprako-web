/**
 * 文件用途：Electron 主进程入口。
 * 负责窗口创建、页面装载与应用生命周期管理。
 */
const path = require("node:path");
const {
    spawn
} = require("node:child_process");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const {
    app,
    autoUpdater,
    BrowserWindow,
    dialog,
    ipcMain,
    shell,
} = require("electron");
const {
    resolveDesktopUpdateConfig
} = require("./runtime-config.cjs");

const appRootPath = path.join(__dirname, "..");
const WINDOWS_APP_USER_MODEL_ID = "com.squirrel.poprako_desktop.poprako-desktop";
const AUTO_UPDATE_DEFAULT_DELAY_MS = 5000;
const AUTO_UPDATE_FIRST_RUN_DELAY_MS = 10000;
const WINDOWS_APP_ICON_FILE_NAME = "poprako-logo.ico";
const REMOTE_RENDERER_FALLBACK_PAGE_PATH = path.join(
    __dirname,
    "remote-renderer-fallback.html",
);

let hasRegisteredAutoUpdaterHandlers = false;
let isAutoUpdateCheckInFlight = false;
let hasDownloadedPendingUpdate = false;
let autoUpdateCheckIntervalHandle = null;

/**
 * Electron 窗口图标路径。
 * 使用 Windows 标准 .ico 图标，保证任务栏与窗口图标一致。
 */
const sourceAppIconPath = path.join(
    __dirname,
    "..",
    "src",
    "assets",
    WINDOWS_APP_ICON_FILE_NAME,
);

function resolveAppIconPath() {
    const packagedAppIconPath = path.join(
        process.resourcesPath,
        WINDOWS_APP_ICON_FILE_NAME,
    );

    if (app.isPackaged && fsSync.existsSync(packagedAppIconPath)) {
        return packagedAppIconPath;
    }

    if (fsSync.existsSync(sourceAppIconPath)) {
        return sourceAppIconPath;
    }

    return undefined;
}

const appIconPath = resolveAppIconPath();

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

function runDetachedWindowsProcess(executablePath, args) {
    try {
        const childProcess = spawn(executablePath, args, {
            detached: true,
            stdio: "ignore",
        });
        childProcess.unref();
        return true;
    } catch (error) {
        console.error("[electron:main] 拉起 Windows 安装辅助进程失败：", error);
        return false;
    }
}

function resolveSquirrelUpdateExecutablePath() {
    return path.resolve(path.dirname(process.execPath), "..", "Update.exe");
}

/**
 * Squirrel 安装事件处理。
 * 在 Windows 安装/卸载阶段主进程会被短暂拉起，此时应立即退出。
 */
function handleWindowsSquirrelStartupEvent() {
    if (process.platform !== "win32" || !app.isPackaged) {
        return false;
    }

    const squirrelEvent = process.argv[1];
    if (typeof squirrelEvent !== "string" || !squirrelEvent.startsWith("--squirrel-")) {
        return false;
    }

    const updateExecutablePath = resolveSquirrelUpdateExecutablePath();
    const packagedExecutableName = path.basename(process.execPath);

    if (!fsSync.existsSync(updateExecutablePath)) {
        console.warn(
            `[electron:main] 检测到 ${squirrelEvent}，但未找到 Update.exe：${updateExecutablePath}`,
        );
        app.quit();
        return true;
    }

    switch (squirrelEvent) {
        case "--squirrel-install":
        case "--squirrel-updated":
            runDetachedWindowsProcess(updateExecutablePath, [
                "--createShortcut",
                packagedExecutableName,
            ]);
            app.quit();
            return true;
        case "--squirrel-uninstall":
            runDetachedWindowsProcess(updateExecutablePath, [
                "--removeShortcut",
                packagedExecutableName,
            ]);
            app.quit();
            return true;
        case "--squirrel-obsolete":
            app.quit();
            return true;
        default:
            return false;
    }
}

const isHandlingWindowsSquirrelStartupEvent = handleWindowsSquirrelStartupEvent();

/**
 * 是否开发模式。
 * 有 VITE_DEV_SERVER_URL 时表示走 Vite 开发服务器。
 */
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const desktopUpdateConfig = resolveDesktopUpdateConfig({
    baseDir: appRootPath,
    isDevelopment,
});

if (process.platform === "win32") {
    app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);
}

/**
 * 根据事件来源解析对应窗口实例。
 */
function resolveSenderWindow(event) {
    return BrowserWindow.fromWebContents(event.sender);
}

function resolveLocalRendererFilePath() {
    return path.join(__dirname, "..", "dist", "index.html");
}

function resolveRendererEntry() {
    const devServerURL = process.env.VITE_DEV_SERVER_URL;
    if (devServerURL) {
        return {
            type: "url",
            value: devServerURL,
            source: "development",
        };
    }

    if (desktopUpdateConfig.rendererRemoteURL) {
        return {
            type: "url",
            value: desktopUpdateConfig.rendererRemoteURL,
            source: "remote",
        };
    }

    const localRendererFilePath = resolveLocalRendererFilePath();
    if (fsSync.existsSync(localRendererFilePath)) {
        return {
            type: "file",
            value: localRendererFilePath,
            source: "local-dist",
        };
    }

    return {
        type: "file",
        value: REMOTE_RENDERER_FALLBACK_PAGE_PATH,
        source: "fallback",
    };
}

async function loadRendererEntryIntoWindow(mainWindow, rendererEntry) {
    if (rendererEntry.type === "url") {
        await mainWindow.loadURL(rendererEntry.value);
        return;
    }

    await mainWindow.loadFile(rendererEntry.value);
}

async function loadRemoteRendererFallbackPage(mainWindow, failure = {}) {
    const query = {
        remoteUrl: desktopUpdateConfig.rendererRemoteURL || "",
        failedUrl: failure.validatedURL || "",
        errorCode: String(failure.errorCode ?? ""),
        errorDescription: failure.errorDescription || "",
    };

    await mainWindow.loadFile(REMOTE_RENDERER_FALLBACK_PAGE_PATH, {
        query,
    });
}

function shouldEnableDesktopAutoUpdate() {
    return (
        process.platform === "win32" &&
        app.isPackaged &&
        desktopUpdateConfig.autoUpdateEnabled &&
        Boolean(desktopUpdateConfig.updateBaseURL)
    );
}

function getAutoUpdateDialogWindow() {
    return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
}

async function promptRestartForDownloadedUpdate(releaseName) {
    if (hasDownloadedPendingUpdate) {
        return;
    }

    hasDownloadedPendingUpdate = true;

    const dialogOptions = {
        type: "info",
        buttons: ["立即重启更新", "稍后"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        title: "发现新版本",
        message: "新版本已下载完成。",
        detail: releaseName ?
            `已下载版本：${releaseName}。重启应用后即可完成更新。` : "重启应用后即可完成更新。",
    };

    const dialogWindow = getAutoUpdateDialogWindow();
    const result = dialogWindow ?
        await dialog.showMessageBox(dialogWindow, dialogOptions) :
        await dialog.showMessageBox(dialogOptions);

    if (result.response === 0) {
        autoUpdater.quitAndInstall();
    }
}

function registerAutoUpdaterHandlers() {
    if (hasRegisteredAutoUpdaterHandlers) {
        return;
    }

    hasRegisteredAutoUpdaterHandlers = true;

    autoUpdater.on("checking-for-update", () => {
        console.info("[electron:main] 正在检查桌面更新。");
    });

    autoUpdater.on("update-available", () => {
        console.info("[electron:main] 检测到新版本，开始后台下载。");
    });

    autoUpdater.on("update-not-available", () => {
        isAutoUpdateCheckInFlight = false;
        console.info("[electron:main] 当前已是最新版本。");
    });

    autoUpdater.on("update-downloaded", (_event, _notes, releaseName) => {
        isAutoUpdateCheckInFlight = false;
        console.info(
            `[electron:main] 更新下载完成：${releaseName || "未命名版本"}`,
        );
        void promptRestartForDownloadedUpdate(releaseName);
    });

    autoUpdater.on("before-quit-for-update", () => {
        console.info("[electron:main] 正在退出并安装已下载的更新。");
    });

    autoUpdater.on("error", (error) => {
        isAutoUpdateCheckInFlight = false;
        console.error("[electron:main] 桌面更新失败：", error);
    });
}

function checkForUpdatesSafely() {
    if (!shouldEnableDesktopAutoUpdate()) {
        return;
    }

    if (isAutoUpdateCheckInFlight || hasDownloadedPendingUpdate) {
        return;
    }

    try {
        isAutoUpdateCheckInFlight = true;
        autoUpdater.checkForUpdates();
    } catch (error) {
        isAutoUpdateCheckInFlight = false;
        console.error("[electron:main] 发起桌面更新检查失败：", error);
    }
}

function initializeDesktopAutoUpdate() {
    if (process.platform !== "win32") {
        return;
    }

    if (!app.isPackaged) {
        console.info("[electron:main] 当前为开发模式，跳过桌面自动更新初始化。");
        return;
    }

    if (!desktopUpdateConfig.autoUpdateEnabled) {
        console.info(
            `[electron:main] 未启用桌面自动更新，配置文件：${desktopUpdateConfig.envFilePath}`,
        );
        return;
    }

    if (!desktopUpdateConfig.updateBaseURL) {
        console.warn(
            `[electron:main] 已开启桌面自动更新，但缺少 POPRAKO_DESKTOP_UPDATE_BASE_URL，配置文件：${desktopUpdateConfig.envFilePath}`,
        );
        return;
    }

    registerAutoUpdaterHandlers();

    try {
        autoUpdater.setFeedURL({
            url: desktopUpdateConfig.updateBaseURL,
        });
    } catch (error) {
        console.error("[electron:main] 配置桌面更新源失败：", error);
        return;
    }

    const initialDelay = process.argv.includes("--squirrel-firstrun") ?
        AUTO_UPDATE_FIRST_RUN_DELAY_MS :
        AUTO_UPDATE_DEFAULT_DELAY_MS;
    const updateIntervalMs =
        desktopUpdateConfig.updateIntervalMinutes * 60 * 1000;

    console.info(
        `[electron:main] 已启用桌面自动更新：source=${desktopUpdateConfig.updateBaseURL}, interval=${desktopUpdateConfig.updateIntervalMinutes}m`,
    );

    const initialCheckTimer = setTimeout(() => {
        checkForUpdatesSafely();
    }, initialDelay);
    if (typeof initialCheckTimer.unref === "function") {
        initialCheckTimer.unref();
    }

    autoUpdateCheckIntervalHandle = setInterval(() => {
        checkForUpdatesSafely();
    }, updateIntervalMs);
    if (typeof autoUpdateCheckIntervalHandle.unref === "function") {
        autoUpdateCheckIntervalHandle.unref();
    }
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

    ipcMain.handle("shell:reload-remote-renderer", async (event) => {
        const senderWindow = resolveSenderWindow(event);
        if (!senderWindow || senderWindow.isDestroyed()) {
            return false;
        }

        if (!desktopUpdateConfig.rendererRemoteURL) {
            return false;
        }

        try {
            await loadRendererEntryIntoWindow(senderWindow, {
                type: "url",
                value: desktopUpdateConfig.rendererRemoteURL,
                source: "remote",
            });
            return true;
        } catch (error) {
            console.error("[electron:main] 重新加载远程渲染入口失败：", error);
            await loadRemoteRendererFallbackPage(senderWindow, {
                validatedURL: desktopUpdateConfig.rendererRemoteURL,
                errorCode: "retry-failed",
                errorDescription: error instanceof Error ? error.message : "远程页面仍不可达",
            });
            return false;
        }
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
    let hasLoadedFallbackPage = false;

    const showRendererFallbackPage = async (failure = {}) => {
        if (hasLoadedFallbackPage || mainWindow.isDestroyed()) {
            return;
        }

        hasLoadedFallbackPage = true;
        console.warn(
            `[electron:main] 远程渲染入口不可用，切换到本地回退页：${failure.validatedURL || desktopUpdateConfig.rendererRemoteURL || "未配置"}`,
        );

        try {
            await loadRemoteRendererFallbackPage(mainWindow, failure);
        } catch (fallbackError) {
            console.error("[electron:main] 加载本地回退页失败：", fallbackError);
        }
    };

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
        async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
            console.error(
                `[electron:main] 页面加载失败：code=${errorCode}, message=${errorDescription}, url=${validatedURL}`,
            );

            if (!isMainFrame || errorCode === -3) {
                return;
            }

            const rendererEntry = resolveRendererEntry();
            if (rendererEntry.source === "remote" && !hasLoadedFallbackPage) {
                await showRendererFallbackPage({
                    errorCode,
                    errorDescription,
                    validatedURL,
                });
            }

            revealMainWindow();
        },
    );

    const rendererEntry = resolveRendererEntry();
    console.info(
        `[electron:main] 正在加载渲染入口：${rendererEntry.value} (${rendererEntry.source})`,
    );

    try {
        await loadRendererEntryIntoWindow(mainWindow, rendererEntry);
    } catch (error) {
        console.error("[electron:main] 首次加载渲染入口失败：", error);

        if (rendererEntry.source === "remote") {
            await showRendererFallbackPage({
                validatedURL: rendererEntry.value,
                errorCode: "initial-load-failed",
                errorDescription: error instanceof Error ? error.message : "远程页面不可达",
            });
        } else if (rendererEntry.source === "fallback") {
            throw error;
        }
    }

    if (isDevelopment && process.env.ELECTRON_OPEN_DEVTOOLS === "true") {
        mainWindow.webContents.openDevTools({
            mode: "detach"
        });
    }
}

app.whenReady().then(async () => {
    if (isHandlingWindowsSquirrelStartupEvent) {
        return;
    }

    console.info("[electron:main] 应用已就绪，开始创建主窗口。");
    registerWindowControlHandlers();
    await createMainWindow();
    initializeDesktopAutoUpdate();

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

app.on("before-quit", () => {
    if (autoUpdateCheckIntervalHandle) {
        clearInterval(autoUpdateCheckIntervalHandle);
        autoUpdateCheckIntervalHandle = null;
    }
});