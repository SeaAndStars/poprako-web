/**
 * 文件用途：跨页面共享的资源 URL 解析与内存缓存 Store。
 */
import { ref } from "vue";
import { defineStore } from "pinia";
import { appendCacheBustQueryToUrl } from "../api/objectStorage";
import { resolveAssetUrl, resolveInMemoryAssetUrl } from "../api/objectStorage";
import type { TeamInfo, UserInfo } from "../types/domain";

/** 资源 URL 解析选项。 */
interface ResolveDisplayAssetUrlOptions {
  /** 缓存未命中时是否回退到原始 URL。 */
  fallbackToRawUrl?: boolean;
}

type AvatarVersion = number | string | undefined;

/** 资源 URL 缓存 Store。 */
export const useAssetCacheStore = defineStore("asset-cache", () => {
  /** 已解析的可展示资源 URL 缓存。 */
  const displayAssetUrlCache = ref<Record<string, string>>({});
  /** 解析失败资源 URL 缓存。 */
  const missingDisplayAssetUrlCache = ref<Record<string, boolean>>({});
  /** 进行中的资源 URL 解析 Promise。 */
  const pendingDisplayAssetLoads = new Map<
    string,
    Promise<string | undefined>
  >();

  /**
   * 解析可展示资源 URL，优先命中跨页面共享缓存。
   */
  function resolveDisplayAssetUrl(
    rawUrl: string | undefined,
    options: ResolveDisplayAssetUrlOptions = {},
  ): string | undefined {
    const normalizedUrl = resolveAssetUrl(rawUrl);
    const fallbackToRawUrl = options.fallbackToRawUrl ?? true;

    if (!normalizedUrl) {
      return undefined;
    }

    const cachedDisplayUrl = displayAssetUrlCache.value[normalizedUrl];
    if (cachedDisplayUrl) {
      return cachedDisplayUrl;
    }

    if (missingDisplayAssetUrlCache.value[normalizedUrl]) {
      return fallbackToRawUrl ? normalizedUrl : undefined;
    }

    if (!pendingDisplayAssetLoads.has(normalizedUrl)) {
      const nextLoadPromise = resolveInMemoryAssetUrl(normalizedUrl)
        .then((resolvedDisplayUrl) => {
          if (resolvedDisplayUrl) {
            displayAssetUrlCache.value = {
              ...displayAssetUrlCache.value,
              [normalizedUrl]: resolvedDisplayUrl,
            };
            return resolvedDisplayUrl;
          }

          missingDisplayAssetUrlCache.value = {
            ...missingDisplayAssetUrlCache.value,
            [normalizedUrl]: true,
          };
          return undefined;
        })
        .finally(() => {
          pendingDisplayAssetLoads.delete(normalizedUrl);
        });

      pendingDisplayAssetLoads.set(normalizedUrl, nextLoadPromise);
    }

    return fallbackToRawUrl ? normalizedUrl : undefined;
  }

  /** 清空资源 URL 缓存。 */
  function clearBlobAssetUrlCache(): void {
    displayAssetUrlCache.value = {};
    missingDisplayAssetUrlCache.value = {};
    pendingDisplayAssetLoads.clear();
  }

  /** 解析带头像版本号的展示 URL。 */
  function resolveAvatarDisplayUrl(
    rawUrl: string | undefined,
    version?: AvatarVersion,
  ): string | undefined {
    return resolveDisplayAssetUrl(appendCacheBustQueryToUrl(rawUrl, version), {
      fallbackToRawUrl: true,
    });
  }

  /** 解析用户头像展示 URL。 */
  function resolveUserAvatarUrl(user?: UserInfo): string | undefined {
    return resolveAvatarDisplayUrl(
      user?.avatar_url || user?.avatar,
      user?.updated_at,
    );
  }

  /** 解析团队头像展示 URL。 */
  function resolveTeamAvatarUrl(
    team?: TeamInfo,
    version?: AvatarVersion,
  ): string | undefined {
    return resolveAvatarDisplayUrl(
      team?.avatar_url || team?.avatar,
      version ?? team?.updated_at,
    );
  }

  return {
    displayAssetUrlCache,
    clearBlobAssetUrlCache,
    resolveDisplayAssetUrl,
    resolveAvatarDisplayUrl,
    resolveUserAvatarUrl,
    resolveTeamAvatarUrl,
  };
});
