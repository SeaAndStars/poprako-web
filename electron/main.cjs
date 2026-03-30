/**
 * 文件用途：Electron 主进程入口。
 * 负责窗口创建、页面装载与应用生命周期管理。
 */
const path = require("node:path");
const {
    app,
    BrowserWindow,
    shell
} = require("electron");

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
 * 配置窗口导航安全策略。
 * 所有外链统一在系统浏览器打开，避免应用内跳转到未知站点。
 */
function setupNavigationPolicy(mainWindow) {
    mainWindow.webContents.setWindowOpenHandler(({
        url
    }) => {
        void shell.openExternal(url);
        return {
            action: "deny"
        };
    });

    mainWindow.webContents.on("will-navigate", (event, url) => {
        if (url === mainWindow.webContents.getURL()) {
            return;
        }

        event.preventDefault();
        void shell.openExternal(url);
    });
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
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    setupNavigationPolicy(mainWindow);

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