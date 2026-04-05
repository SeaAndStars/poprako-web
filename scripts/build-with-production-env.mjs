import path from "node:path";
import process from "node:process";
import {
    spawn
} from "node:child_process";
import {
    fileURLToPath
} from "node:url";
import {
    loadEnv
} from "vite";

const supportedModes = new Set([
    "development",
    "test",
    "staging",
    "production",
]);

const currentFilePath = fileURLToPath(
    import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFilePath), "..");
const requestedMode = (process.argv[2] ?? "production").trim().toLowerCase();

if (!supportedModes.has(requestedMode)) {
    console.error(
        `[build] unsupported mode: ${requestedMode}. Expected one of: ${[...supportedModes].join(", ")}`,
    );
    process.exit(1);
}

const loadedEnv = loadEnv(requestedMode, workspaceRoot, "");
for (const [key, value] of Object.entries(loadedEnv)) {
    if (process.env[key] === undefined) {
        process.env[key] = value;
    }
}

process.env.NODE_ENV = requestedMode === "development" ? "development" : "production";
if (process.env.VITE_API_BASE_URL == null) {
    process.env.VITE_API_BASE_URL = "/api/v1";
}
const rendererTarget = (process.env.POPRAKO_RENDERER_TARGET ?? "web")
    .trim()
    .toLowerCase();

const viteCliPath = path.resolve(
    workspaceRoot,
    "node_modules",
    "vite",
    "bin",
    "vite.js",
);

const effectiveProxyTarget = process.env.VITE_API_PROXY_TARGET?.trim();
console.log(
    `[build] mode=${requestedMode}, target=${rendererTarget}, api base=${process.env.VITE_API_BASE_URL}${
        effectiveProxyTarget ? `, proxy target=${effectiveProxyTarget}` : ""
    }`,
);

const childProcess = spawn(
    process.execPath,
    [viteCliPath, "build", "--mode", requestedMode], {
        cwd: workspaceRoot,
        env: process.env,
        stdio: "inherit",
    },
);

childProcess.on("exit", (exitCode) => {
    process.exit(exitCode ?? 1);
});

childProcess.on("error", (error) => {
    console.error("[build] failed to launch vite build:", error);
    process.exit(1);
});