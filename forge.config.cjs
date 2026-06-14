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



/**

 * 是否启用 Squirrel delta（会从 remoteReleases 下载历史 nupkg，本地 make 默认关闭）。

 */

const squirrelDeltaEnabled =

    (process.env.POPRAKO_ELECTRON_ENABLE_DELTA || "").trim().toLowerCase() ===

    "true";



const squirrelMakerConfig = {

    name: windowsPackageName,

    setupIcon: windowsIconPath,

    setupExe: `${windowsProductName} Setup.exe`,

    setupMsi: `${windowsProductName} Setup.msi`,

    authors: packageMetadata.author,

    description: packageMetadata.description,

    noDelta: !squirrelDeltaEnabled,

    noMsi: false,

};



if (squirrelDeltaEnabled && desktopUpdateConfig.remoteReleasesURL) {

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



/**

 * 壳层打包允许复制的路径（相对应用根目录，POSIX 风格）。

 */

const shellPackagerAllowedPathPatterns = [

    /^\/package\.json$/u,

    /^\/\.env\.production$/u,

    /^\/electron\/main\.cjs$/u,

    /^\/electron\/preload\.cjs$/u,

    /^\/electron\/remote-renderer-fallback\.html$/u,

    /^\/electron\/runtime-config\.cjs$/u,

];



/**

 * 将 packager 传入的相对路径规范化为以 / 开头。

 */

function normalizePackagerRelativePath(relativePath) {

    const normalizedPath = String(relativePath || "")

        .replace(/\\/g, "/")

        .replace(/\/+/g, "/");



    if (!normalizedPath || normalizedPath === ".") {

        return "/";

    }



    return normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;

}



/**

 * 壳层模式下是否应忽略该路径（true = 不复制）。

 */

function shouldIgnoreShellPackagerPath(relativePath) {

    const normalizedPath = normalizePackagerRelativePath(relativePath);



    if (

        normalizedPath === "/node_modules" ||

        normalizedPath.startsWith("/node_modules/")

    ) {

        return true;

    }



    if (normalizedPath === "/" || normalizedPath === "/electron") {

        return false;

    }



    if (shellPackagerAllowedPathPatterns.some((pattern) =>

            pattern.test(normalizedPath),

        )) {

        return false;

    }



    if (normalizedPath.startsWith("/electron/")) {

        return true;

    }



    return true;

}



/**

 * 解析 packager ignore 规则（壳层用白名单函数，完整包用正则列表）。

 */

function resolvePackagerIgnore() {

    if (shellOnlyPackagingEnabled) {

        return shouldIgnoreShellPackagerPath;

    }



    return packagerIgnorePatterns;

}



async function removePathIfExists(targetPath) {

    await fs.rm(targetPath, {

        recursive: true,

        force: true,

        maxRetries: 3,

        retryDelay: 100,

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



    try {

        await fs.access(electronDirectoryPath);

    } catch {

        return;

    }



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



/**

 * 打包时排除的开发目录/文件（相对应用根目录）。

 */

const packagerIgnorePatterns = [

    /^\/node_modules(\/|$)/u,

    /^\/src(\/|$)/u,

    /^\/scripts(\/|$)/u,

    /^\/\.github(\/|$)/u,

    /^\/out(\/|$)/u,

    /^\/README\.md$/u,

    /^\/eslint\.config\.mjs$/u,

    /^\/tsconfig.*\.json$/u,

    /^\/vite\.config\.ts$/u,

    /^\/pnpm-lock\.yaml$/u,

    /^\/\.env\.(development|test|staging|example)$/u,

    /^\/\.env\.production\.example$/u,

];



/**

 * 本地迭代是否跳过 MSI（仅生成 exe/nupkg，加快 make）。

 */

const skipWindowsMsi =

    (process.env.POPRAKO_ELECTRON_SKIP_MSI || "").trim().toLowerCase() === "true";



if (skipWindowsMsi) {

    squirrelMakerConfig.noMsi = true;

}

/**
 * 解析 Forge 输出目录（支持 POPRAKO_ELECTRON_OUT_DIR 指向每次独立子目录）。
 */
function resolveForgeOutDir() {
    const customOutDir = (process.env.POPRAKO_ELECTRON_OUT_DIR || "").trim();

    if (customOutDir) {
        return path.isAbsolute(customOutDir) ?
            customOutDir :
            path.join(__dirname, customOutDir);
    }

    return path.join(__dirname, shellOnlyPackagingEnabled ? "out-shell" : "out");
}

module.exports = {

    outDir: resolveForgeOutDir(),
    hooks: {

        packageAfterCopy: async (_forgeConfig, buildPath) => {

            if (!shellOnlyPackagingEnabled) {

                return;

            }



            await pruneShellOnlyPackage(buildPath);

        },

    },

    packagerConfig: {

        asar: true,

        prune: !shellOnlyPackagingEnabled,

        electronRebuild: false,

        ignore: resolvePackagerIgnore(),

        executableName: windowsExecutableName,

        extraResource: [windowsIconPath],

        icon: windowsIconPath,

    },

    rebuildConfig: shellOnlyPackagingEnabled ? {

        onlyModules: [],

    } : {},

    makers: [{

            name: "@electron-forge/maker-squirrel",

            platforms: ["win32"],

            config: squirrelMakerConfig,

        },

        {

            name: "@electron-forge/maker-zip",

            platforms: ["darwin"],

        },

        {

            name: "@electron-forge/maker-deb",

            platforms: ["linux"],

            config: {},

        },

        {

            name: "@electron-forge/maker-rpm",

            platforms: ["linux"],

            config: {},

        },

    ],

    publishers,

};


