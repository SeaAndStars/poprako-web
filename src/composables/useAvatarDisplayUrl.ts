import { appendCacheBustQueryToUrl } from "../api/objectStorage";
import type { TeamInfo, UserInfo } from "../types/domain";
import { useBlobAssetUrlCache } from "./useBlobAssetUrlCache";

type AvatarVersion = number | string | undefined;

export function useAvatarDisplayUrl() {
  const { resolveDisplayAssetUrl } = useBlobAssetUrlCache();

  function resolveAvatarDisplayUrl(
    rawUrl: string | undefined,
    version?: AvatarVersion,
  ): string | undefined {
    return resolveDisplayAssetUrl(appendCacheBustQueryToUrl(rawUrl, version), {
      fallbackToRawUrl: true,
    });
  }

  function resolveUserAvatarUrl(user?: UserInfo): string | undefined {
    return resolveAvatarDisplayUrl(
      user?.avatar_url || user?.avatar,
      user?.updated_at,
    );
  }

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
    resolveAvatarDisplayUrl,
    resolveTeamAvatarUrl,
    resolveUserAvatarUrl,
  };
}
