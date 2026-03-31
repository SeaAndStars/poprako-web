<template>
  <a-config-provider :theme="antdThemeConfig">
    <div
      class="application-shell"
      :class="{ 'application-shell--desktop': isDesktopEnvironment }"
    >
      <div v-if="showTitlebar" class="application-shell__titlebar-container">
        <DesktopTitleBar />
      </div>

      <div
        class="application-shell__workspace-container"
        :class="{
          'application-shell__workspace-container--desktop':
            isDesktopEnvironment,
        }"
      >
        <aside v-if="showSidebar" class="application-shell__sidebar-container">
          <DesktopSidebar
            :theme-mode="themeMode"
            @theme-mode-change="setThemeMode"
          />
        </aside>

        <main class="application-shell__content-container">
          <router-view />
        </main>
      </div>
    </div>
  </a-config-provider>
</template>

<script setup lang="ts">
/**
 * 根组件负责挂载全局主题 Provider 与路由承载容器。
 */
import { computed } from "vue";
import { useRoute } from "vue-router";
import { onBeforeUnmount, onMounted } from "vue";
import DesktopSidebar from "./components/DesktopSidebar.vue";
import DesktopTitleBar from "./components/DesktopTitleBar.vue";
import { useThemeProvider } from "./theme/provider";

const { themeMode, antdThemeConfig, setThemeMode } = useThemeProvider();
const route = useRoute();
const isDesktopEnvironment = computed(() =>
  Boolean(window.poprakoDesktop?.windowControls),
);
const showTitlebar = computed(() => true);
const showSidebar = computed(() => route.path !== "/login");
const DESKTOP_SHELL_CLASS_NAME = "desktop-shell";

onMounted(() => {
  if (!isDesktopEnvironment.value) {
    return;
  }

  document.documentElement.classList.add(DESKTOP_SHELL_CLASS_NAME);
  document.body.classList.add(DESKTOP_SHELL_CLASS_NAME);
});

onBeforeUnmount(() => {
  document.documentElement.classList.remove(DESKTOP_SHELL_CLASS_NAME);
  document.body.classList.remove(DESKTOP_SHELL_CLASS_NAME);
});
</script>

<style scoped lang="scss">
.application-shell {
  height: 100vh;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

@supports (height: 100dvh) {
  .application-shell {
    height: 100dvh;
    min-height: 100dvh;
  }
}

.application-shell--desktop {
  /* 桌面环境启用固定高度，标题栏与主工作区按容器拆分。 */
  height: 100vh;
  border-radius: 5px;
  overflow: hidden;
}

.application-shell__titlebar-container {
  flex: 0 0 var(--desktop-titlebar-height, 40px);
  height: var(--desktop-titlebar-height, 40px);
  position: relative;
  z-index: 1200;
}

.application-shell__workspace-container {
  flex: 1;
  min-height: 0;
  display: flex;
}

.application-shell__workspace-container--desktop {
  overflow: hidden;
}

.application-shell__sidebar-container {
  flex: 0 0 var(--desktop-sidebar-width, 56px);
  width: var(--desktop-sidebar-width, 56px);
  min-height: 0;
}

.application-shell__content-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

/*
 * 桌面端显式禁止工作区拖拽。
 * 仅允许标题栏内声明的 drag 区域可拖动，避免登录页/表单误触发窗口拖拽。
 */
:global(.application-shell--desktop) .application-shell__workspace-container,
:global(.application-shell--desktop) .application-shell__content-container,
:global(.application-shell--desktop) .application-shell__content-container * {
  -webkit-app-region: no-drag;
}

/* 标题栏与下方左右容器接缝处增加小圆角过渡。 */
.application-shell__workspace-container--desktop
  .application-shell__sidebar-container {
  border-top-left-radius: 8px;
  overflow: hidden;
}

.application-shell__workspace-container--desktop
  .application-shell__content-container {
  background: var(--workspace-glass-bg);
  backdrop-filter: blur(16px) saturate(120%);
  border-top-right-radius: 8px;
}

/* 全局提示层统一抬高并下移，避免被标题栏遮挡。 */
:global(.ant-message),
:global(.ant-notification) {
  z-index: 1600;
}

:global(.ant-message) {
  top: calc(var(--desktop-titlebar-height, 40px) + 10px);
}

:global(.ant-notification-top),
:global(.ant-notification-topLeft),
:global(.ant-notification-topRight) {
  top: calc(var(--desktop-titlebar-height, 40px) + 10px);
}
</style>
