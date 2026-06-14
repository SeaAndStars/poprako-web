/**
 * 文件用途：解析 Electron 主进程与打包流程共用的运行时配置。
 * 当前主要服务于 Windows 桌面更新源、远程渲染入口与增量构建配置。
 */
const fs = require("node:fs");
const path = require("node:path");

const DESKTOP_RUNTIME_ENV_KEYS = [
  "POPRAKO_DESKTOP_UPDATE_BASE_URL",
  "POPRAKO_DESKTOP_REMOTE_RELEASES_URL",
  "POPRAKO_DESKTOP_AUTO_UPDATE",
  "POPRAKO_DESKTOP_UPDATE_INTERVAL_MINUTES",
  "POPRAKO_RENDERER_REMOTE_URL",
];

function parseDotEnvText(rawText) {
  const parsed = {};
  const lines = rawText.split(/\r?\n/u);

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = rawLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const rawKey = rawLine.slice(0, separatorIndex).trim();
    if (!rawKey) {
      continue;
    }

    let rawValue = rawLine.slice(separatorIndex + 1).trim();
    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      rawValue = rawValue.slice(1, -1);
    }

    parsed[rawKey] = rawValue;
  }

  return parsed;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    return parseDotEnvText(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function pickRuntimeEnv(source) {
  const picked = {};

  for (const key of DESKTOP_RUNTIME_ENV_KEYS) {
    if (typeof source[key] === "string") {
      picked[key] = source[key];
    }
  }

  return picked;
}

function normalizeUrl(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }

  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.replace(/\/+$/u, "");
}

function parseBoolean(rawValue, fallback = false) {
  if (typeof rawValue !== "string") {
    return fallback;
  }

  switch (rawValue.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return fallback;
  }
}

function parsePositiveInteger(rawValue, fallback) {
  const parsedValue = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function resolveDesktopUpdateConfig(options = {}) {
  const baseDir = options.baseDir ?? process.cwd();
  const isDevelopment = options.isDevelopment === true;
  const envFileName = isDevelopment ? ".env.development" : ".env.production";
  const envFilePath = path.join(baseDir, envFileName);
  const envFromFile = readEnvFile(envFilePath);
  const envFromProcess = pickRuntimeEnv(process.env);
  const mergedEnv = {
    ...envFromFile,
    ...envFromProcess,
  };

  const updateBaseURL = normalizeUrl(mergedEnv.POPRAKO_DESKTOP_UPDATE_BASE_URL);
  const remoteReleasesURL =
    normalizeUrl(mergedEnv.POPRAKO_DESKTOP_REMOTE_RELEASES_URL) ?? updateBaseURL;
  const rendererRemoteURL = normalizeUrl(mergedEnv.POPRAKO_RENDERER_REMOTE_URL);
  const autoUpdateEnabled = parseBoolean(
    mergedEnv.POPRAKO_DESKTOP_AUTO_UPDATE,
    false,
  );
  const updateIntervalMinutes = Math.max(
    5,
    parsePositiveInteger(
      mergedEnv.POPRAKO_DESKTOP_UPDATE_INTERVAL_MINUTES,
      60,
    ),
  );

  return {
    envFilePath,
    updateBaseURL,
    remoteReleasesURL,
    rendererRemoteURL,
    autoUpdateEnabled,
    updateIntervalMinutes,
  };
}

module.exports = {
  resolveDesktopUpdateConfig,
};