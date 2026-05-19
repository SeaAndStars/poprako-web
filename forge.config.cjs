/**
 * 文件用途：Electron Forge 构建与发布配置。
 * 覆盖 Windows/macOS/Linux 三端打包，并支持可选 GitHub Release 发布。
 */
const path = require("node:path");
const fs = require("node:fs/promises");
const packageMetadata = require("./package.json");
const {
    resolveDesktopUpdateConfig
} = require("./electron/runtime-config.cjs");

const shellOnlyPackagingEnabled =
    (process.env.POPRAKO_ELECTRON_PACKAGE_MODE || "").trim().toLowerCase() ===
    "shell";
const windowsExecutableName = "poprako-desktop";
const windowsPackageName = "poprako_desktop";
const windowsProductName = packageMetadata.productName || "Poprako Desktop";
const desktopUpdateConfig = resolveDesktopUpdateConfig({
    baseDir: __dirname,
    isDevelopment: false,
});

/**
 * Windows 打包图标路径（.ico）。
 */
const windowsIconPath = path.join(
    __dirname,
    "src",
    "assets",
    "poprako-logo.ico",
);

const squirrelMakerConfig = {
    name: windowsPackageName,
    setupIcon: windowsIconPath,
    setupExe: `${windowsProductName} Setup.exe`,
    setupMsi: `${windowsProductName} Setup.msi`,
    authors: packageMetadata.author,
    description: packageMetadata.description,
    noDelta: false,
    noMsi: false,
};

if (desktopUpdateConfig.remoteReleasesURL) {
    squirrelMakerConfig.remoteReleases = desktopUpdateConfig.remoteReleasesURL;
}

const shellPackageRootAllowlist = new Set([
    "electron",
    "package.json",
    ".env.production",
]);
const shellPackageElectronAllowlist = new Set([
    "main.cjs",
    "preload.cjs",
    "remote-renderer-fallback.html",
    "runtime-config.cjs",
]);

async function removePathIfExists(targetPath) {
    await fs.rm(targetPath, {
        recursive: true,
        force: true,
    });
}

async function pruneShellOnlyPackage(buildPath) {
    const rootEntries = await fs.readdir(buildPath, {
        withFileTypes: true,
    });

    await Promise.all(
        rootEntries.map(async (entry) => {
            if (shellPackageRootAllowlist.has(entry.name)) {
                return;
            }

            await removePathIfExists(path.join(buildPath, entry.name));
        }),
    );

    const electronDirectoryPath = path.join(buildPath, "electron");
    const electronEntries = await fs.readdir(electronDirectoryPath, {
        withFileTypes: true,
    });

    await Promise.all(
        electronEntries.map(async (entry) => {
            if (shellPackageElectronAllowlist.has(entry.name)) {
                return;
            }

            await removePathIfExists(path.join(electronDirectoryPath, entry.name));
        }),
    );
}

function shellOnlyAfterCopyHook(buildPath, _electronVersion, _platform, _arch, callback) {
    if (!shellOnlyPackagingEnabled) {
        callback();
        return;
    }

    pruneShellOnlyPackage(buildPath)
        .then(() => {
            callback();
        })
        .catch((error) => {
            callback(error);
        });
}

/**
 * 是否启用 GitHub 发布器。
 * 仅当仓库 owner/name 均提供时才注入发布器，避免本地 make 被无关配置阻塞。
 */
const enableGithubPublisher =
    Boolean(process.env.ELECTRON_GITHUB_OWNER) &&
    Boolean(process.env.ELECTRON_GITHUB_REPO);

/**
 * 发布器集合。
 */
const publishers = [];

if (enableGithubPublisher) {
    publishers.push({
        name: "@electron-forge/publisher-github",
        config: {
            repository: {
                owner: process.env.ELECTRON_GITHUB_OWNER,
                name: process.env.ELECTRON_GITHUB_REPO,
            },
            draft: true,
            prerelease: false,
            authToken: process.env.GITHUB_TOKEN,
        },
    });
}

module.exports = {
    packagerConfig: {
        asar: true,
        afterCopy: [shellOnlyAfterCopyHook],
        executableName: windowsExecutableName,
        extraResource: [windowsIconPath],
        icon: windowsIconPath,
    },
    rebuildConfig: {},
    makers: [{
            name: "@electron-forge/maker-squirrel",
            config: squirrelMakerConfig,
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["darwin"],
        },
        {
            name: "@electron-forge/maker-deb",
            config: {},
        },
        {
            name: "@electron-forge/maker-rpm",
            config: {},
        },
    ],
    publishers,
};