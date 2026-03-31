<template>
  <header class="desktop-titlebar">
    <div class="desktop-titlebar__drag-region" @dblclick="handleToggleMaximize">
      <img
        class="desktop-titlebar__logo"
        :src="poprakoLogoURL"
        alt="Poprako Logo"
      />
      <span class="desktop-titlebar__title">Poprako</span>

      <div v-if="showGlobalProfile" class="desktop-titlebar__profile-chip">
        <img
          v-if="titleBarProfile?.avatarUrl"
          class="desktop-titlebar__avatar"
          :src="titleBarProfile.avatarUrl"
          alt="Profile Avatar"
        />
        <span v-else class="desktop-titlebar__avatar-placeholder">
          {{ profileInitial }}
        </span>

        <div class="desktop-titlebar__profile-text">
          <span class="desktop-titlebar__profile-name">{{
            titleBarProfile?.nickname
          }}</span>
          <span class="desktop-titlebar__profile-status">{{
            titleBarProfile?.status
          }}</span>
        </div>
      </div>
    </div>

    <div v-if="isDesktopEnvironment" class="desktop-titlebar__controls">
      <button
        type="button"
        class="desktop-titlebar__control"
        aria-label="Minimize window"
        title="最小化"
        @click="handleMinimize"
      >
        <span class="window-control-icon window-control-icon--minimize" />
      </button>

      <button
        type="button"
        class="desktop-titlebar__control"
        aria-label="Toggle maximize"
        title="最大化 / 恢复"
        @click="handleToggleMaximize"
      >
        <span
          v-if="!isMaximized"
          class="window-control-icon window-control-icon--maximize"
        />
        <span v-else class="window-control-icon window-control-icon--restore" />
      </button>

      <button
        type="button"
        class="desktop-titlebar__control desktop-titlebar__control--close"
        aria-label="Close window"
        title="关闭"
        @click="handleClose"
      >
        <span class="window-control-icon window-control-icon--close" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * 文件用途：渲染 Electron 自定义标题栏。
 * 该组件用于全局标题栏，负责品牌展示与桌面窗口控制。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getCurrentUserProfile } from "../api/modules";
import { useAuthStore } from "../stores/auth";
import poprakoLogoURL from "../assets/poprako-logo.svg";

interface TitleBarProfile {
  nickname: string;
  status: string;
  avatarUrl?: string;
}

const desktopBridge = window.poprakoDesktop;
const windowControls = desktopBridge?.windowControls;
const route = useRoute();
const authStore = useAuthStore();

const isDesktopEnvironment = computed(() => Boolean(windowControls));
const isLoginPage = computed(() => route.path === "/login");
const showGlobalProfile = computed(
  () => !isLoginPage.value && titleBarProfile.value !== null,
);
const isMaximized = ref(false);
const titleBarProfile = ref<TitleBarProfile | null>(null);

const developmentPreviewProfile: Readonly<TitleBarProfile> = Object.freeze({
  nickname: "Developer",
  status: "Preview Mode",
});

const profileInitial = computed(() =>
  (titleBarProfile.value?.nickname?.trim().charAt(0) || "D").toUpperCase(),
);

let cleanupMaximizeListener: (() => void) | undefined;

/**
 * 同步标题栏用户信息。
 * 全局页面优先展示真实用户信息；开发免登录场景使用占位身份。
 */
async function syncTitleBarProfile(): Promise<void> {
  if (isLoginPage.value) {
    titleBarProfile.value = null;
    return;
  }

  if (import.meta.env.DEV && !authStore.isLoggedIn) {
    titleBarProfile.value = {
      ...developmentPreviewProfile,
    };
    return;
  }

  if (!authStore.isLoggedIn) {
    titleBarProfile.value = null;
    return;
  }

  try {
    const currentUserProfile = await getCurrentUserProfile();
    titleBarProfile.value = {
      nickname:
        currentUserProfile.name || currentUserProfile.username || "User",
      status: currentUserProfile.qq ? `QQ ${currentUserProfile.qq}` : "Online",
      avatarUrl: currentUserProfile.avatar_url || currentUserProfile.avatar,
    };
  } catch {
    titleBarProfile.value = import.meta.env.DEV
      ? {
          ...developmentPreviewProfile,
        }
      : null;
  }
}

/**
 * 同步当前窗口最大化状态。
 */
async function syncMaximizeState(): Promise<void> {
  if (!windowControls) {
    return;
  }

  try {
    isMaximized.value = await windowControls.getMaximized();
  } catch {
    // 忽略状态读取错误，避免影响主页面渲染。
  }
}

/**
 * 处理窗口最小化。
 */
function handleMinimize(): void {
  windowControls?.minimize();
}

/**
 * 处理窗口最大化/还原。
 */
function handleToggleMaximize(): void {
  windowControls?.toggleMaximize();
}

/**
 * 处理窗口关闭。
 */
function handleClose(): void {
  windowControls?.close();
}

onMounted(async () => {
  if (!windowControls) {
    await syncTitleBarProfile();
    return;
  }

  await syncMaximizeState();
  await syncTitleBarProfile();
  cleanupMaximizeListener = windowControls.onMaximizeChanged(
    (nextMaximized) => {
      isMaximized.value = nextMaximized;
    },
  );
});

watch(
  () => [route.fullPath, authStore.isLoggedIn],
  () => {
    void syncTitleBarProfile();
  },
);

onBeforeUnmount(() => {
  cleanupMaximizeListener?.();
});
</script>

<style scoped lang="scss">
/* 标题栏由上层容器承载，避免 fixed 覆盖全局提示层。 */
.desktop-titlebar {
  position: relative;
  width: 100%;
  height: var(--desktop-titlebar-height, 40px);
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  background: var(--titlebar-bg);
  border-bottom: 0;
  backdrop-filter: blur(12px);
  /*
   * 标题栏整体可拖拽，确保登录页也能通过顶栏拖动窗口。
   * 可点击区域（窗口控制按钮）通过 no-drag 单独排除。
   */
  -webkit-app-region: drag;
  user-select: none;
  -webkit-user-select: none;
}

.desktop-titlebar__drag-region {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  overflow: hidden;
}

:global(.application-shell--desktop) .desktop-titlebar__drag-region {
  /* 该区域保持为标题栏主可拖拽区。 */
  -webkit-app-region: inherit;
}

.desktop-titlebar__logo {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.desktop-titlebar__title {
  color: var(--titlebar-title);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desktop-titlebar__profile-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 300px;
  margin-left: 8px;
  padding: 2px 8px 2px 4px;
  border-radius: 999px;
}

.desktop-titlebar__avatar,
.desktop-titlebar__avatar-placeholder {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  flex-shrink: 0;
}

.desktop-titlebar__avatar {
  object-fit: cover;
}

.desktop-titlebar__avatar-placeholder {
  display: grid;
  place-items: center;
  background: var(--titlebar-profile-placeholder-bg);
  color: var(--titlebar-profile-placeholder-text);
  font-size: 11px;
  font-weight: 700;
}

.desktop-titlebar__profile-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  gap: 2px;
}

.desktop-titlebar__profile-name {
  color: var(--titlebar-profile-name);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desktop-titlebar__profile-status {
  color: var(--titlebar-profile-status);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desktop-titlebar__controls {
  display: flex;
  align-items: stretch;
  -webkit-app-region: no-drag;
}

.desktop-titlebar__control {
  width: 42px;
  border: 0;
  margin: 0;
  padding: 0;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--titlebar-control);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.desktop-titlebar__control:hover {
  background: var(--titlebar-control-hover);
}

.desktop-titlebar__control--close:hover {
  background: var(--titlebar-close-hover);
  color: #ffffff;
}

.window-control-icon {
  display: inline-block;
  position: relative;
  color: currentColor;
}

.window-control-icon--minimize {
  width: 12px;
  border-top: 1.8px solid currentColor;
}

.window-control-icon--maximize {
  width: 10px;
  height: 10px;
  border: 1.6px solid currentColor;
}

.window-control-icon--restore {
  width: 9px;
  height: 7px;
  border: 1.6px solid currentColor;
}

.window-control-icon--restore::before {
  content: "";
  position: absolute;
  left: -4px;
  top: 3px;
  width: 9px;
  height: 7px;
  border: 1.6px solid currentColor;
  background: transparent;
}

.window-control-icon--close {
  width: 12px;
  height: 12px;
}

.window-control-icon--close::before,
.window-control-icon--close::after {
  content: "";
  position: absolute;
  left: 5px;
  top: 0;
  width: 1.8px;
  height: 12px;
  background: currentColor;
}

.window-control-icon--close::before {
  transform: rotate(45deg);
}

.window-control-icon--close::after {
  transform: rotate(-45deg);
}
</style>
