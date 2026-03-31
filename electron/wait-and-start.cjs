/**
 * 文件用途：Electron 开发模式启动器。
 * 等待 Vite dev server 可用后，再启动 Electron 主进程。
 */
const {
    spawn
} = require("node:child_process");
const electronBinaryPath = require("electron");
const waitOn = require("wait-on");

const host = process.env.FRONTEND_HOST || "127.0.0.1";
const port = process.env.FRONTEND_PORT || "5173";
const devServerURL = process.env.VITE_DEV_SERVER_URL || `http://${host}:${port}`;
const waitResource = `${devServerURL}/`;

/**
 * 构建用于子进程的环境变量。
 * Windows 下若透传包含特殊键（如以 '=' 开头）可能导致 spawn EINVAL。
 */
function buildChildProcessEnvironment() {
    const nextEnvironment = {};

    Object.entries(process.env).forEach(([key, value]) => {
        if (!key || key.startsWith("=")) {
            return;
        }

        if (typeof value !== "string") {
            return;
        }

        nextEnvironment[key] = value;
    });

    nextEnvironment.NODE_ENV = "development";
    nextEnvironment.VITE_DEV_SERVER_URL = devServerURL;

    return nextEnvironment;
}

/**
 * 启动 Electron 并透传标准输入输出。
 */
function launchElectronProcess() {
    console.info(
        `[electron:dev] Vite 服务就绪，准备启动 Electron。URL=${devServerURL}`,
    );

    const childProcess = spawn(electronBinaryPath, ["."], {
        stdio: "inherit",
        env: buildChildProcessEnvironment(),
    });

    childProcess.on("spawn", () => {
        console.info(`[electron:dev] Electron 进程已启动，PID=${childProcess.pid}`);
    });

    childProcess.on("exit", (code) => {
        process.exit(code ?? 0);
    });

    childProcess.on("error", (error) => {
        // 统一输出启动失败信息，方便定位本地环境问题。
        console.error("[electron:dev] 启动 Electron 失败：", error);
        process.exit(1);
    });
}

async function main() {
    try {
        await waitOn({
            resources: [waitResource],
            timeout: 120000,
            validateStatus: (statusCode) => statusCode >= 200 && statusCode < 500,
        });
    } catch (error) {
        console.error(
            `[electron:dev] 等待前端服务失败，请确认 ${waitResource} 可访问。`,
        );
        console.error(error);
        process.exit(1);
        return;
    }

    try {
        launchElectronProcess();
    } catch (error) {
        console.error("[electron:dev] 启动 Electron 进程失败：");
        console.error(error);
        process.exit(1);
    }
}

void main();