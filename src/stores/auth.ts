/**
 * 文件用途：定义全局认证状态 Store，统一维护访问令牌与登录态。
 */
import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { getCurrentUserProfile } from "../api/modules";
import type { UserInfo } from "../types/domain";

/**
 * 访问令牌在本地存储中的键名。
 */
const ACCESS_TOKEN_STORAGE_KEY = "access_token";
const CURRENT_TEAM_STORAGE_KEY_PREFIX = "current_team_id:";

/**
 * 认证 Store。
 */
export const useAuthStore = defineStore("auth", () => {
  /**
   * 当前访问令牌。
   */
  const accessToken = ref<string>(
    localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? "",
  );
  const currentTeamId = ref<string>("");
  const currentUserProfile = ref<UserInfo | null>(null);
  const currentUserProfileLoading = ref(false);
  const hasLoadedCurrentUserProfile = ref(false);
  let currentUserProfileRequest: Promise<UserInfo | null> | null = null;

  /**
   * 是否已登录。
   */
  const isLoggedIn = computed<boolean>(() => accessToken.value.length > 0);

  /**
   * 当前登录账号是否为系统超级管理员。
   */
  const isSuperAdmin = computed<boolean>(() => {
    return Boolean(currentUserProfile.value?.is_super_admin);
  });

  function resolveCurrentTeamStorageKey(userId?: string | null): string | null {
    if (!userId) {
      return null;
    }

    return `${CURRENT_TEAM_STORAGE_KEY_PREFIX}${userId}`;
  }

  function loadCurrentTeamId(userId?: string | null): void {
    const storageKey = resolveCurrentTeamStorageKey(userId);
    currentTeamId.value = storageKey
      ? (localStorage.getItem(storageKey) ?? "")
      : "";
  }

  /**
   * 清空当前用户资料缓存。
   */
  function clearCurrentUserProfile(): void {
    currentUserProfile.value = null;
    currentTeamId.value = "";
    currentUserProfileLoading.value = false;
    hasLoadedCurrentUserProfile.value = false;
    currentUserProfileRequest = null;
  }

  /**
   * 手动写入当前用户资料缓存。
   */
  function setCurrentUserProfile(nextCurrentUserProfile: UserInfo): void {
    currentUserProfile.value = nextCurrentUserProfile;
    loadCurrentTeamId(nextCurrentUserProfile.id);
    hasLoadedCurrentUserProfile.value = true;
  }

  function setCurrentTeamId(nextCurrentTeamId: string | undefined): void {
    const normalizedCurrentTeamId = nextCurrentTeamId?.trim() ?? "";
    currentTeamId.value = normalizedCurrentTeamId;

    const storageKey = resolveCurrentTeamStorageKey(
      currentUserProfile.value?.id,
    );
    if (!storageKey) {
      return;
    }

    if (normalizedCurrentTeamId) {
      localStorage.setItem(storageKey, normalizedCurrentTeamId);
      return;
    }

    localStorage.removeItem(storageKey);
  }

  function clearCurrentTeamId(): void {
    setCurrentTeamId(undefined);
  }

  /**
   * 强制刷新当前用户资料。
   */
  async function refreshCurrentUserProfile(): Promise<UserInfo | null> {
    if (!isLoggedIn.value) {
      clearCurrentUserProfile();
      return null;
    }

    if (currentUserProfileRequest) {
      return currentUserProfileRequest;
    }

    currentUserProfileLoading.value = true;
    currentUserProfileRequest = (async () => {
      try {
        const nextCurrentUserProfile = await getCurrentUserProfile();
        setCurrentUserProfile(nextCurrentUserProfile);
        return nextCurrentUserProfile;
      } catch (error) {
        currentUserProfile.value = null;
        currentTeamId.value = "";
        hasLoadedCurrentUserProfile.value = false;
        throw error;
      } finally {
        currentUserProfileLoading.value = false;
        currentUserProfileRequest = null;
      }
    })();

    return currentUserProfileRequest;
  }

  /**
   * 按需加载当前用户资料，避免多个壳层组件重复请求。
   */
  async function ensureCurrentUserProfileLoaded(): Promise<UserInfo | null> {
    if (!isLoggedIn.value) {
      clearCurrentUserProfile();
      return null;
    }

    if (hasLoadedCurrentUserProfile.value && currentUserProfile.value) {
      return currentUserProfile.value;
    }

    return refreshCurrentUserProfile();
  }

  /**
   * 设置访问令牌并同步到本地存储。
   */
  function setAccessToken(nextAccessToken: string | undefined): void {
    const normalizedAccessToken = nextAccessToken ?? "";
    const previousAccessToken = accessToken.value;

    accessToken.value = normalizedAccessToken;

    if (normalizedAccessToken.length > 0) {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, normalizedAccessToken);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }

    if (previousAccessToken !== normalizedAccessToken) {
      clearCurrentUserProfile();
    }
  }

  /**
   * 清空访问令牌并同步到本地存储。
   */
  function clearAccessToken(): void {
    accessToken.value = "";
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    clearCurrentUserProfile();
  }

  return {
    accessToken,
    currentTeamId,
    isLoggedIn,
    currentUserProfile,
    currentUserProfileLoading,
    isSuperAdmin,
    setAccessToken,
    clearAccessToken,
    setCurrentTeamId,
    clearCurrentTeamId,
    clearCurrentUserProfile,
    setCurrentUserProfile,
    refreshCurrentUserProfile,
    ensureCurrentUserProfileLoaded,
  };
});
