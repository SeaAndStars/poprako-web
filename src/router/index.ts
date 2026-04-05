/**
 * 文件用途：前端路由配置，定义页面入口与登录态守卫逻辑。
 */
import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { useAuthStore } from "../stores/auth";

/**
 * 路由表定义。
 */
const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/workspace",
  },
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
  },
  {
    path: "/register",
    name: "register",
    component: () => import("../views/LoginView.vue"),
  },
  {
    path: "/workspace",
    name: "workspace",
    component: () => import("../views/DashboardView.vue"),
  },
  {
    path: "/translator/:projectId",
    name: "translator",
    component: () => import("../views/TranslatorView.vue"),
  },
  {
    path: "/online-translator/:chapterId",
    name: "online-translator",
    component: () => import("../views/TranslatorView.vue"),
  },
  {
    path: "/worksets",
    name: "workset-list",
    component: () => import("../views/workset-management/WorksetListView.vue"),
  },
  {
    path: "/worksets/:id",
    name: "workset-detail",
    component: () =>
      import("../views/workset-management/WorksetDetailView.vue"),
  },
  {
    path: "/dashboard",
    redirect: "/workspace",
  },
  {
    path: "/comic-playground",
    name: "comic-playground",
    component: () => import("../views/ComicPlaygroundView.vue"),
    meta: {
      requiresSuperAdmin: true,
    },
  },
  {
    path: "/member-list",
    name: "member-list",
    component: () => import("../views/MemberListView.vue"),
  },
  {
    path: "/super-admin",
    name: "super-admin",
    component: () => import("../views/SuperAdminView.vue"),
    meta: {
      requiresSuperAdmin: true,
    },
  },
  {
    path: "/special-symbols",
    name: "special-symbols",
    component: () => import("../views/SpecialSymbolsView.vue"),
  },
];

/**
 * Electron 桌面运行时使用 hash 路由，避免 history 路径触发外部跳转或 file:// 路由解析问题。
 */
const isDesktopRuntime =
  typeof window !== "undefined" &&
  Boolean(window.poprakoDesktop?.windowControls);

/**
 * 创建路由实例。
 */
const router = createRouter({
  history: isDesktopRuntime ? createWebHashHistory() : createWebHistory(),
  routes,
});

/**
 * 开发模式下允许免登录访问，便于页面联调与样式调试。
 */
const isDevelopmentMode = import.meta.env.DEV;
const DEVELOPMENT_PREVIEW_SESSION_KEY = "poprako_dev_preview_mode";

/**
 * 开发模式直达开关，仅在用户主动开启后生效。
 */
function isDevelopmentPreviewModeEnabled(): boolean {
  if (!isDevelopmentMode) {
    return false;
  }

  return window.sessionStorage.getItem(DEVELOPMENT_PREVIEW_SESSION_KEY) === "1";
}

/**
 * 路由前置守卫，用于校验登录态。
 */
router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const developmentPreviewModeEnabled = isDevelopmentPreviewModeEnabled();
  const isAuthRoute = to.path === "/login" || to.path === "/register";

  if (!isAuthRoute && !authStore.isLoggedIn && !developmentPreviewModeEnabled) {
    return "/login";
  }

  if (isAuthRoute && authStore.isLoggedIn) {
    return "/workspace";
  }

  if (to.meta.requiresSuperAdmin) {
    if (!authStore.isLoggedIn || developmentPreviewModeEnabled) {
      return "/workspace";
    }

    try {
      await authStore.ensureCurrentUserProfileLoaded();
    } catch {
      if (!localStorage.getItem("access_token")) {
        authStore.clearAccessToken();
        return "/login";
      }

      return "/workspace";
    }

    if (!authStore.isSuperAdmin) {
      return "/workspace";
    }
  }

  return true;
});

export default router;
