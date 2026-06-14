/**
 * 文件用途：壳层打包时临时清空根 package.json 的 dependencies，避免复制 node_modules。
 */
const fs = require("node:fs/promises");
const path = require("node:path");

/** 备份的 package.json 原文。 */
let packageJsonBackupText = null;

/**
 * 备份并清空 dependencies / optionalDependencies。
 * @param {string} workspaceRoot web 项目根目录
 */
async function backupAndStripRootPackageJson(workspaceRoot) {
    const packageJsonPath = path.join(workspaceRoot, "package.json");

    if (packageJsonBackupText) {
        return;
    }

    packageJsonBackupText = await fs.readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonBackupText);
    const strippedPackageJson = {
        ...packageJson,
        dependencies: {},
        optionalDependencies: {},
    };

    await fs.writeFile(
        packageJsonPath,
        `${JSON.stringify(strippedPackageJson, null, 2)}\n`,
        "utf8",
    );
}

/**
 * 恢复根 package.json。
 * @param {string} workspaceRoot web 项目根目录
 */
async function restoreRootPackageJson(workspaceRoot) {
    if (!packageJsonBackupText) {
        return;
    }

    const packageJsonPath = path.join(workspaceRoot, "package.json");
    await fs.writeFile(packageJsonPath, packageJsonBackupText, "utf8");
    packageJsonBackupText = null;
}

module.exports = {
    backupAndStripRootPackageJson,
    restoreRootPackageJson,
};
