import { useAssetCacheStore } from "../stores/assetCache";

/** @deprecated 请直接使用 useAssetCacheStore。 */
export function useAvatarDisplayUrl() {
  const assetCacheStore = useAssetCacheStore();

  return {
    resolveAvatarDisplayUrl: assetCacheStore.resolveAvatarDisplayUrl,
    resolveTeamAvatarUrl: assetCacheStore.resolveTeamAvatarUrl,
    resolveUserAvatarUrl: assetCacheStore.resolveUserAvatarUrl,
  };
}
