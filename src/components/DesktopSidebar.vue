<template>
  <nav class="desktop-sidebar" aria-label="主导航">
    <div class="desktop-sidebar__main">
      <button
        v-for="sidebarItem in sidebarItems"
        :key="sidebarItem.key"
        type="button"
        class="desktop-sidebar__button"
        :class="{ 'is-active': activeSidebarKey === sidebarItem.key }"
        :title="sidebarItem.label"
        @click="handleSidebarClick(sidebarItem.key)"
      >
        <component :is="sidebarItem.icon" class="desktop-sidebar__icon" />
      </button>
    </div>

    <div class="desktop-sidebar__footer">
      <a-dropdown
        placement="topLeft"
        :trigger="['click']"
        :open="isActionMenuOpen"
        overlay-class-name="sidebar-theme-dropdown"
        @openChange="handleActionMenuOpenChange"
      >
        <button
          type="button"
          class="desktop-sidebar__button desktop-sidebar__button--menu"
          :title="themeButtonTitle"
          aria-label="主题设置"
        >
          <MenuOutlined class="desktop-sidebar__icon" />
        </button>

        <template #overlay>
          <div
            class="sidebar-qq-menu"
            @click.stop
            @mouseenter="handleMenuMouseEnter"
            @mouseleave="handleMenuMouseLeave"
          >
            <div ref="panelRef" class="sidebar-qq-panel">
              <section class="sidebar-qq-panel__list">
                <button
                  type="button"
                  class="sidebar-qq-list-item"
                  @mouseenter="hideSubPanel"
                  @click="handleCheckUpdateClick"
                >
                  <span class="sidebar-qq-list-item__left">
                    <SyncOutlined class="sidebar-qq-list-item__icon" />
                    <span>检查更新</span>
                  </span>
                </button>
                <button
                  ref="helpSubmenuTriggerRef"
                  type="button"
                  class="sidebar-qq-list-item"
                  :class="{
                    'sidebar-qq-list-item--submenu-active':
                      activeSubPanelKey === 'help',
                  }"
                  @mouseenter="openSubPanel('help')"
                  @focus="openSubPanel('help')"
                  @click="handleHelpClick"
                >
                  <span class="sidebar-qq-list-item__left">
                    <QuestionCircleOutlined
                      class="sidebar-qq-list-item__icon"
                    />
                    <span>帮助</span>
                  </span>
                  <RightOutlined class="sidebar-qq-list-item__arrow" />
                </button>
              </section>

              <div class="sidebar-qq-divider" />

              <section class="sidebar-qq-panel__list">
                <button
                  type="button"
                  class="sidebar-qq-list-item"
                  @mouseenter="hideSubPanel"
                  @click="handleLockClick"
                >
                  <span class="sidebar-qq-list-item__left">
                    <LockOutlined class="sidebar-qq-list-item__icon" />
                    <span>锁定</span>
                  </span>
                </button>
                <button
                  ref="themeSubmenuTriggerRef"
                  type="button"
                  class="sidebar-qq-list-item"
                  :class="{
                    'sidebar-qq-list-item--submenu-active':
                      activeSubPanelKey === 'theme',
                  }"
                  @mouseenter="openSubPanel('theme')"
                  @focus="openSubPanel('theme')"
                  @click="handleSettingsClick"
                >
                  <span class="sidebar-qq-list-item__left">
                    <SettingOutlined class="sidebar-qq-list-item__icon" />
                    <span>设置</span>
                  </span>
                  <RightOutlined class="sidebar-qq-list-item__arrow" />
                </button>
                <button
                  type="button"
                  class="sidebar-qq-list-item sidebar-qq-list-item--danger"
                  @mouseenter="hideSubPanel"
                  @click="handleLogoutClick"
                >
                  <span class="sidebar-qq-list-item__left">
                    <PoweroffOutlined class="sidebar-qq-list-item__icon" />
                    <span>退出账号</span>
                  </span>
                </button>
              </section>
            </div>

            <div
              v-if="activeSubPanelKey === 'theme'"
              ref="themeSubPanelRef"
              class="sidebar-qq-subpanel"
              :style="subPanelStyle"
            >
              <div class="sidebar-qq-subpanel__title">主题设置</div>
              <button
                type="button"
                class="sidebar-qq-subpanel__item"
                @click="handleThemeModeSelect('system')"
              >
                <span>跟随系统</span>
                <CheckOutlined
                  v-if="themeMode === 'system'"
                  class="sidebar-qq-subpanel__check"
                />
              </button>
              <button
                type="button"
                class="sidebar-qq-subpanel__item"
                @click="handleThemeModeSelect('light')"
              >
                <span>浅色主题</span>
                <CheckOutlined
                  v-if="themeMode === 'light'"
                  class="sidebar-qq-subpanel__check"
                />
              </button>
              <button
                type="button"
                class="sidebar-qq-subpanel__item"
                @click="handleThemeModeSelect('dark')"
              >
                <span>深色主题</span>
                <CheckOutlined
                  v-if="themeMode === 'dark'"
                  class="sidebar-qq-subpanel__check"
                />
              </button>
            </div>

            <div
              v-if="activeSubPanelKey === 'help'"
              ref="helpSubPanelRef"
              class="sidebar-qq-subpanel"
              :style="subPanelStyle"
            >
              <div class="sidebar-qq-subpanel__title">帮助</div>

              <div class="sidebar-qq-subpanel__meta">
                当前版本 0.1.0-preview
              </div>
            </div>
          </div>
        </template>
      </a-dropdown>
    </div>
  </nav>
</template>

<script setup lang="ts">
/**
 * 文件用途：桌面端全局侧边栏。
 * 该组件负责视图切换与底部 QQ 风格分组菜单。
 */
import { computed, nextTick, ref, type Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  CheckOutlined,
  CloudUploadOutlined,
  LockOutlined,
  MenuOutlined,
  MessageOutlined,
  PoweroffOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  SettingOutlined,
  SyncOutlined,
} from "@ant-design/icons-vue";
import { useAuthStore } from "../stores/auth";
import type { ThemeMode } from "../theme/provider";

type SubPanelKey = "theme" | "help";

interface SidebarItem {
  key: string;
  label: string;
  icon: Component;
  to: string;
}

interface RectAnchor {
  getBoundingClientRect: () => {
    left: number;
    width: number;
    top: number;
    height: number;
  };
}

type SubPanelPlacement = "left" | "right";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const props = defineProps<{
  themeMode: ThemeMode;
}>();
const emit = defineEmits<{
  (event: "theme-mode-change", themeMode: ThemeMode): void;
}>();
const isActionMenuOpen = ref(false);
const activeSubPanelKey = ref<SubPanelKey | null>(null);
const subPanelTop = ref(0);
const subPanelPlacement = ref<SubPanelPlacement>("right");
const subPanelHideTimerID = ref<number | null>(null);
const panelRef = ref<RectAnchor | null>(null);
const helpSubmenuTriggerRef = ref<RectAnchor | null>(null);
const themeSubmenuTriggerRef = ref<RectAnchor | null>(null);
const helpSubPanelRef = ref<RectAnchor | null>(null);
const themeSubPanelRef = ref<RectAnchor | null>(null);

const subPanelStyle = computed(() => {
  if (subPanelPlacement.value === "left") {
    return {
      top: `${subPanelTop.value}px`,
      left: "auto",
      right: "calc(100% + 8px)",
    };
  }

  return {
    top: `${subPanelTop.value}px`,
    left: "calc(100% + 8px)",
    right: "auto",
  };
});

const sidebarItems: ReadonlyArray<SidebarItem> = [
  {
    key: "dashboard",
    label: "仪表盘",
    icon: MessageOutlined,
    to: "/dashboard",
  },
  {
    key: "file-test",
    label: "文件测试",
    icon: CloudUploadOutlined,
    to: "/file-test",
  },
];

/**
 * 根据当前路由返回侧栏选中项。
 */
const activeSidebarKey = computed(() => {
  if (route.path === "/file-test") {
    return "file-test";
  }

  return "dashboard";
});

/**
 * 主题菜单按钮提示文案。
 */
const themeButtonTitle = computed(() => {
  if (props.themeMode === "system") {
    return "主题：跟随系统";
  }

  if (props.themeMode === "dark") {
    return "主题：深色";
  }

  return "主题：浅色";
});

/**
 * 执行侧栏页面切换。
 */
function handleSidebarClick(sidebarKey: string): void {
  const targetItem = sidebarItems.find(
    (sidebarItem) => sidebarItem.key === sidebarKey,
  );
  if (!targetItem) {
    return;
  }

  if (route.path === targetItem.to) {
    return;
  }

  void router.push(targetItem.to);
}

/**
 * 控制底部菜单开关，并在关闭时重置二级面板。
 */
function handleActionMenuOpenChange(nextOpen: boolean): void {
  isActionMenuOpen.value = nextOpen;
  if (!nextOpen) {
    clearSubPanelHideTimer();
    activeSubPanelKey.value = null;
  }
}

/**
 * 关闭底部菜单。
 */
function closeActionMenu(): void {
  clearSubPanelHideTimer();
  isActionMenuOpen.value = false;
  activeSubPanelKey.value = null;
}

/**
 * 隐藏二级面板。
 */
function hideSubPanel(): void {
  activeSubPanelKey.value = null;
}

/**
 * 清理二级菜单延时关闭定时器。
 */
function clearSubPanelHideTimer(): void {
  if (subPanelHideTimerID.value === null) {
    return;
  }

  window.clearTimeout(subPanelHideTimerID.value);
  subPanelHideTimerID.value = null;
}

/**
 * 延时隐藏二级面板，给鼠标从主菜单移动到子菜单留出时间。
 */
function scheduleSubPanelHide(): void {
  clearSubPanelHideTimer();
  subPanelHideTimerID.value = window.setTimeout(() => {
    hideSubPanel();
    subPanelHideTimerID.value = null;
  }, 180);
}

/**
 * 更新二级面板在视口中的定位，避免被窗口截断。
 */
function updateSubPanelTop(subPanelKey: SubPanelKey): void {
  const viewportMargin = 8;
  const panelElement = panelRef.value;
  const triggerElement =
    subPanelKey === "help"
      ? helpSubmenuTriggerRef.value
      : themeSubmenuTriggerRef.value;
  const subPanelElement =
    subPanelKey === "help" ? helpSubPanelRef.value : themeSubPanelRef.value;

  if (!panelElement || !triggerElement || !subPanelElement) {
    subPanelTop.value = 8;
    subPanelPlacement.value = "right";
    return;
  }

  const panelRect = panelElement.getBoundingClientRect();
  const triggerRect = triggerElement.getBoundingClientRect();
  const subPanelRect = subPanelElement.getBoundingClientRect();

  let absoluteTop = triggerRect.top - 4;
  const viewportHeight = window.innerHeight;
  if (absoluteTop + subPanelRect.height > viewportHeight - viewportMargin) {
    absoluteTop = viewportHeight - viewportMargin - subPanelRect.height;
  }
  absoluteTop = Math.max(viewportMargin, absoluteTop);
  subPanelTop.value = absoluteTop - panelRect.top;

  const viewportWidth = window.innerWidth;
  const rightCandidateLeft = panelRect.left + panelRect.width + 8;
  const rightOverflow =
    rightCandidateLeft + subPanelRect.width > viewportWidth - viewportMargin;
  const leftCandidateLeft = panelRect.left - subPanelRect.width - 8;

  subPanelPlacement.value =
    rightOverflow && leftCandidateLeft >= viewportMargin ? "left" : "right";
}

/**
 * 打开指定二级面板。
 */
function openSubPanel(subPanelKey: SubPanelKey): void {
  clearSubPanelHideTimer();
  activeSubPanelKey.value = subPanelKey;
  void nextTick(() => {
    updateSubPanelTop(subPanelKey);
  });
}

/**
 * 鼠标重新进入菜单区域时，取消延时关闭。
 */
function handleMenuMouseEnter(): void {
  clearSubPanelHideTimer();
}

/**
 * 鼠标离开整个菜单区域时，关闭二级面板。
 */
function handleMenuMouseLeave(): void {
  scheduleSubPanelHide();
}

function handleCheckUpdateClick(): void {
  hideSubPanel();
}

function handleHelpClick(): void {
  openSubPanel("help");
}

function handleLockClick(): void {
  void router.push("/login");
  closeActionMenu();
}

function handleSettingsClick(): void {
  openSubPanel("theme");
}

function handleLogoutClick(): void {
  authStore.clearAccessToken();
  void router.push("/login");
  closeActionMenu();
}

function handleThemeModeSelect(nextThemeMode: ThemeMode): void {
  emit("theme-mode-change", nextThemeMode);
  closeActionMenu();
}
</script>

<style scoped lang="scss">
.desktop-sidebar {
  height: 100%;
  min-height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 10px 4px 8px;
  background: linear-gradient(
    180deg,
    var(--dashboard-sider-start),
    var(--dashboard-sider-end)
  );
  backdrop-filter: blur(14px) saturate(118%);
  box-shadow: inset 0 0 0 1px var(--dashboard-sider-line);
  border-right: 1px solid var(--dashboard-sider-line);
}

.desktop-sidebar__main {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.desktop-sidebar__footer {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding-bottom: 2px;
}

.desktop-sidebar__button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  padding: 0;
  display: grid;
  place-items: center;
  position: relative;
  overflow: hidden;
  color: var(--dashboard-sider-icon);
  background: transparent;
  cursor: pointer;
  transition:
    color 0.22s ease,
    background-color 0.22s ease,
    transform 0.18s ease;
}

.desktop-sidebar__button::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    165deg,
    var(--dashboard-sider-fill-start),
    var(--dashboard-sider-fill-end)
  );
  transform: scale(0.3);
  opacity: 0;
  transition:
    transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.24s ease;
}

.desktop-sidebar__button:hover {
  transform: translateY(-0.5px);
  color: var(--dashboard-sider-icon-active);
  background: var(--dashboard-sider-hover-bg);
}

.desktop-sidebar__button.is-active {
  color: var(--dashboard-sider-icon-active);
}

.desktop-sidebar__button.is-active::before {
  opacity: 1;
  transform: scale(1);
  animation: sidebar-fill-in 0.26s ease-out;
}

.desktop-sidebar__icon {
  position: relative;
  z-index: 1;
  font-size: 16px;
}

.desktop-sidebar__button--menu {
  margin: 0 auto;
  border: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.desktop-sidebar__button--menu::before {
  display: none;
}

.desktop-sidebar__button--menu:hover,
.desktop-sidebar__button--menu:focus {
  border: 0;
  color: var(--dashboard-sider-icon-active);
  background: transparent;
  transform: none;
}

:global(.sidebar-theme-dropdown .ant-dropdown-menu) {
  display: none;
}

:global(.sidebar-theme-dropdown .ant-dropdown-arrow) {
  display: none;
}

:global(.sidebar-theme-dropdown) {
  overflow: visible;
}

:global(.sidebar-qq-menu) {
  position: relative;
  width: 226px;
  overflow: visible;
}

:global(.sidebar-qq-panel) {
  width: 226px;
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  background: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: blur(12px);
  padding: 8px 0;
}

:global(.sidebar-qq-divider) {
  height: 1px;
  margin: 2px 10px;
  background: var(--panel-border);
  opacity: 0.65;
}

:global(.sidebar-qq-panel__list) {
  display: flex;
  flex-direction: column;
  padding: 4px 6px;
  gap: 2px;
}

:global(.sidebar-qq-list-item) {
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

:global(.sidebar-qq-list-item:hover) {
  background: var(--dashboard-sider-hover-bg);
}

:global(.sidebar-qq-list-item--submenu-active) {
  background: var(--dashboard-sider-hover-bg);
}

:global(.sidebar-qq-list-item__left) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:global(.sidebar-qq-list-item__icon) {
  font-size: 14px;
}

:global(.sidebar-qq-list-item__arrow) {
  font-size: 12px;
  color: var(--text-muted);
}

:global(.sidebar-qq-list-item--danger) {
  color: #ff7575;
}

:global(.sidebar-qq-subpanel) {
  position: absolute;
  min-width: 150px;
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  background: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: blur(12px);
  padding: 8px;
  z-index: 2;
}

:global(.sidebar-qq-subpanel__title) {
  font-size: 12px;
  color: var(--text-muted);
  padding: 2px 6px 6px;
}

:global(.sidebar-qq-subpanel__item) {
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

:global(.sidebar-qq-subpanel__item:hover) {
  background: var(--dashboard-sider-hover-bg);
}

:global(.sidebar-qq-subpanel__check),
:global(.sidebar-qq-subpanel__arrow) {
  font-size: 12px;
}

:global(.sidebar-qq-subpanel__meta) {
  font-size: 12px;
  color: var(--text-muted);
  padding: 10px 8px 4px;
}

@keyframes sidebar-fill-in {
  from {
    clip-path: inset(45% 0 45% 0 round 10px);
  }

  to {
    clip-path: inset(0 0 0 0 round 10px);
  }
}

@media (max-width: 900px) {
  .desktop-sidebar {
    padding-left: 3px;
    padding-right: 3px;
  }

  .desktop-sidebar__button {
    width: 32px;
    height: 32px;
  }
}
</style>
