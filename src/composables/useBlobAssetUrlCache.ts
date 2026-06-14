import { useAssetCacheStore } from "../stores/assetCache";

interface ResolveDisplayAssetUrlOptions {
  fallbackToRawUrl?: boolean;
}

/** @deprecated 请直接使用 useAssetCacheStore。 */
export function useBlobAssetUrlCache() {
  const assetCacheStore = useAssetCacheStore();

  return {
    clearBlobAssetUrlCache: assetCacheStore.clearBlobAssetUrlCache,
    resolveDisplayAssetUrl: assetCacheStore.resolveDisplayAssetUrl,
  };
}

export type { ResolveDisplayAssetUrlOptions };
