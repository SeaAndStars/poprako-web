/**
 * 文件用途：Electron Forge 构建与发布配置。
 * 覆盖 Windows/macOS/Linux 三端打包，并支持可选 GitHub Release 发布。
 */

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
    executableName: "poprako-desktop",
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "poprako_desktop",
      },
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
