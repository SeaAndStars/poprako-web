/**
 * 文件用途：统一 Electron Forge make 入口。
 * 按环境自动选择 shell/完整包、是否执行 verify，并转发给 electron-forge。
 */
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const currentFilePath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFilePath), "..");
const requireFromWorkspace = createRequire(path.join(workspaceRoot, "package.json"));
const { resolveDesktopUpdateConfig } = requireFromWorkspace(
    "./electron/runtime-config.cjs",
);
const {
    backupAndStripRootPackageJson,
    restoreRootPackageJson,
} = requireFromWorkspace("./scripts/electron-shell-package-json.cjs");

/**
 * 解析本次 Forge 输出目录（shell 每次使用独立子目录，避免覆盖被锁定的 app.asar）。
 */
function resolveForgeOutputDirectory(shellPackageModeEnabled) {
    if (!shellPackageModeEnabled) {
        return path.join(workspaceRoot, "out");
    }

    return path.join(workspaceRoot, "out-shell", `build-${Date.now()}`);
}

/**
 * 转为相对 web 根目录的路径，供 forge.config 读取。
 */
function toWorkspaceRelativePath(absolutePath) {
    return path.relative(workspaceRoot, absolutePath).split(path.sep).join("/");
}

/**
 * 在工作区执行 pnpm（Windows 经 cmd /c 调用，避免 pnpm.cmd + shell:false 的 EINVAL）。
 */
function spawnPnpmInWorkspace(commandArguments, extraEnvironment = {}) {
    return new Promise((resolve, reject) => {
        const mergedEnvironment = {
            ...process.env,
            ...extraEnvironment,
        };
        const spawnOptions = {
            cwd: workspaceRoot,
            env: mergedEnvironment,
            stdio: "inherit",
        };
        const childProcess =
            process.platform === "win32" ?
                spawn(
                    process.env.ComSpec || "cmd.exe",
                    ["/d", "/s", "/c", "pnpm", ...commandArguments],
                    spawnOptions,
                ) :
                spawn("pnpm", commandArguments, {
                    ...spawnOptions,
                    shell: false,
                });

        childProcess.on("error", reject);
        childProcess.on("exit", (exitCode) => {
            resolve(exitCode ?? 1);
        });
    });
}

/**
 * 解析命令行中的 --platform= 参数。
 */
function readPlatformArgument() {
    const platformArgument = process.argv.find((argument) =>
        argument.startsWith("--platform="),
    );

    if (!platformArgument) {
        return null;
    }

    return platformArgument.slice("--platform=".length).trim() || null;
}

/**
 * 是否显式要求完整内置渲染包（非 shell）。
 */
function isFullPackageModeRequested() {
    const packageMode = (process.env.POPRAKO_ELECTRON_PACKAGE_MODE || "")
        .trim()
        .toLowerCase();

    return packageMode === "full" || packageMode === "embedded";
}

/**
 * 是否应使用远程 Web 壳层打包（跳过 dist 与完整 vite 桌面构建）。
 */
function shouldUseShellPackageMode(desktopRuntimeConfig) {
    if (isFullPackageModeRequested()) {
        return false;
    }

    const packageMode = (process.env.POPRAKO_ELECTRON_PACKAGE_MODE || "")
        .trim()
        .toLowerCase();

    if (packageMode === "shell") {
        return true;
    }

    return Boolean(desktopRuntimeConfig.rendererRemoteURL);
}

/**
 * 执行 make 前的质量门禁。
 */
async function runPreMakeVerify(shellPackageModeEnabled) {
    if (process.env.POPRAKO_SKIP_ELECTRON_VERIFY === "1") {
        console.log("[electron] 已跳过 verify（POPRAKO_SKIP_ELECTRON_VERIFY=1）");
        return 0;
    }

    const verifyScriptName = shellPackageModeEnabled
        ? "electron:verify:shell"
        : "electron:verify";

    return spawnPnpmInWorkspace([verifyScriptName]);
}

async function main() {
    const desktopRuntimeConfig = resolveDesktopUpdateConfig({
        baseDir: workspaceRoot,
        isDevelopment: false,
    });
    const shellPackageModeEnabled = shouldUseShellPackageMode(desktopRuntimeConfig);
    const forgeEnvironment = {};
    let strippedRootPackageJson = false;

    if (shellPackageModeEnabled) {
        forgeEnvironment.POPRAKO_ELECTRON_PACKAGE_MODE = "shell";
        const forgeOutputDirectoryPath = resolveForgeOutputDirectory(true);
        forgeEnvironment.POPRAKO_ELECTRON_OUT_DIR = toWorkspaceRelativePath(
            forgeOutputDirectoryPath,
        );
        console.log("[electron] shell 打包（不复制 node_modules）");
        console.log(`[electron] 输出目录: ${forgeOutputDirectoryPath}`);
    }

    if (process.env.POPRAKO_ELECTRON_ENABLE_DELTA === "true") {
        forgeEnvironment.POPRAKO_ELECTRON_ENABLE_DELTA = "true";
    }

    const verifyExitCode = await runPreMakeVerify(shellPackageModeEnabled);
    if (verifyExitCode !== 0) {
        process.exit(verifyExitCode);
    }

    try {
        if (shellPackageModeEnabled) {
            await backupAndStripRootPackageJson(workspaceRoot);
            strippedRootPackageJson = true;
        }

        const forgeArguments = ["exec", "electron-forge", "make"];
        const platformName = readPlatformArgument();

        if (platformName) {
            forgeArguments.push(`--platform=${platformName}`);
        }

        const forgeExitCode = await spawnPnpmInWorkspace(
            forgeArguments,
            forgeEnvironment,
        );
        process.exit(forgeExitCode);
    } finally {
        if (strippedRootPackageJson) {
            await restoreRootPackageJson(workspaceRoot);
        }
    }
}

main().catch(async (error) => {
    console.error("[electron] make 失败:", error);
    await restoreRootPackageJson(workspaceRoot).catch(() => {});
    process.exit(1);
});
