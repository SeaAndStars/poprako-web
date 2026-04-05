import { onBeforeUnmount, ref } from "vue";

import { resolveAssetUrl, resolveInMemoryAssetUrl } from "../api/objectStorage";

interface ResolveDisplayAssetUrlOptions {
  fallbackToRawUrl?: boolean;
}

export function useBlobAssetUrlCache() {
  const displayAssetUrlCache = ref<Record<string, string>>({});
  const missingDisplayAssetUrlCache = ref<Record<string, boolean>>({});
  const pendingDisplayAssetLoads = new Map<
    string,
    Promise<string | undefined>
  >();

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

  function clearBlobAssetUrlCache(): void {
    displayAssetUrlCache.value = {};
    missingDisplayAssetUrlCache.value = {};
    pendingDisplayAssetLoads.clear();
  }

  onBeforeUnmount(() => {
    clearBlobAssetUrlCache();
  });

  return {
    clearBlobAssetUrlCache,
    resolveDisplayAssetUrl,
  };
}
