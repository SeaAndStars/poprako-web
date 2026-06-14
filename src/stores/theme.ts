/**
 * 文件用途：全局主题 Pinia Store，统一控制亮色/暗黑模式与 Ant Design Vue 主题配置。
 */
import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { theme as antdTheme, type ConfigProviderProps } from "ant-design-vue";

/** Ant Design Vue 主题配置类型。 */
type AntdThemeConfig = NonNullable<ConfigProviderProps["theme"]>;
type AntdComponentThemeConfig = NonNullable<AntdThemeConfig["components"]>;
type AntdComponentSize = NonNullable<ConfigProviderProps["componentSize"]>;

/** 主题持久化键名。 */
const THEME_STORAGE_KEY = "poprako_theme_mode";
const THEME_DENSITY_STORAGE_KEY = "poprako_theme_density";

/** 主题模式枚举值。 */
export type ThemeMode = "light" | "dark" | "system";
export type ThemeDensity = "comfortable" | "compact";

const THEME_MODE_VALUES: ReadonlyArray<ThemeMode> = ["light", "dark", "system"];
const THEME_DENSITY_VALUES: ReadonlyArray<ThemeDensity> = [
  "comfortable",
  "compact",
];

const APP_FONT_FAMILY =
  '"LXGWWenKaiMono", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

const LIGHT_THEME_TOKEN = {
  colorPrimary: "#8f66f0",
  colorInfo: "#8f66f0",
  colorSuccess: "#27ae60",
  colorWarning: "#f39c12",
  colorError: "#e74c3c",
  borderRadius: 12,
  colorBgBase: "#f7f4ff",
  colorBgContainer: "#ffffff",
  colorBgElevated: "#ffffff",
  colorBorder: "#d5c5f1",
  colorBorderSecondary: "#e2d7f6",
  colorText: "#2f2545",
  colorTextSecondary: "#5d4e7d",
  fontFamily: APP_FONT_FAMILY,
};

const DARK_THEME_TOKEN = {
  colorPrimary: "#9d7cff",
  colorInfo: "#9d7cff",
  colorSuccess: "#3ecf8e",
  colorWarning: "#f4b84a",
  colorError: "#ff7875",
  borderRadius: 12,
  colorBgBase: "#07080c",
  colorBgContainer: "#111319",
  colorBgElevated: "#151924",
  colorBorder: "#2a2f3b",
  colorBorderSecondary: "#353b49",
  colorText: "#edf1f8",
  colorTextSecondary: "#a9b2c2",
  fontFamily: APP_FONT_FAMILY,
};

const COMPACT_THEME_TOKEN = {
  controlHeight: 30,
  controlHeightLG: 36,
  controlHeightSM: 24,
};

const LIGHT_COMPONENT_TOKEN = {
  Button: {
    borderRadius: 10,
    controlHeight: 36,
    defaultBg: "#ffffff",
    defaultBorderColor: "#cdb8f1",
    defaultColor: "#46356d",
    defaultHoverBg: "#ffffff",
    defaultHoverBorderColor: "#ae90e7",
    defaultHoverColor: "#3f2f64",
    primaryShadow: "none",
    defaultShadow: "none",
  },
  Table: {
    borderColor: "#d9cbf4",
    headerBg: "#f2eaff",
    headerColor: "#43355f",
    rowHoverBg: "#ece1ff",
    headerSplitColor: "#d8c8f2",
  },
  Card: {
    borderRadiusLG: 16,
    headerBg: "transparent",
    colorBorderSecondary: "#d8c8f2",
  },
  Dropdown: {
    colorBgElevated: "#ffffff",
  },
  Menu: {
    itemBg: "transparent",
    itemColor: "#453565",
    itemSelectedBg: "#ebe1ff",
    itemSelectedColor: "#2f2248",
  },
};

const DARK_COMPONENT_TOKEN = {
  Button: {
    borderRadius: 10,
    controlHeight: 36,
    defaultBg: "#1a1d27",
    defaultBorderColor: "#394152",
    defaultColor: "#e4eaf6",
    defaultHoverBg: "#202532",
    defaultHoverBorderColor: "#4a556d",
    defaultHoverColor: "#f8fbff",
    primaryShadow: "none",
    defaultShadow: "none",
  },
  Table: {
    borderColor: "#303746",
    headerBg: "#171b25",
    headerColor: "#eef2fa",
    rowHoverBg: "#1e2330",
    headerSplitColor: "#303746",
  },
  Card: {
    borderRadiusLG: 16,
    headerBg: "transparent",
    colorBorderSecondary: "#303746",
  },
  Dropdown: {
    colorBgElevated: "#171b25",
  },
  Menu: {
    itemBg: "transparent",
    itemColor: "#dde4f2",
    itemSelectedBg: "#242b3a",
    itemSelectedColor: "#f4f7ff",
  },
};

/** 系统主题监听是否已注册。 */
let systemThemeListenerRegistered = false;

function createComponentThemeConfig(
  isDarkMode: boolean,
  themeDensity: ThemeDensity,
): AntdComponentThemeConfig {
  const baseComponentToken = isDarkMode
    ? DARK_COMPONENT_TOKEN
    : LIGHT_COMPONENT_TOKEN;
  const isCompactDensity = themeDensity === "compact";

  return {
    ...baseComponentToken,
    Button: {
      ...baseComponentToken.Button,
      controlHeight: isCompactDensity ? 32 : 36,
    },
    Card: {
      ...baseComponentToken.Card,
      borderRadiusLG: isCompactDensity ? 14 : 16,
    },
  } as AntdComponentThemeConfig;
}

function resolveInitialThemeMode(): ThemeMode {
  const cachedThemeMode = localStorage.getItem(THEME_STORAGE_KEY);
  if (
    cachedThemeMode !== null &&
    THEME_MODE_VALUES.includes(cachedThemeMode as ThemeMode)
  ) {
    return cachedThemeMode as ThemeMode;
  }

  return "system";
}

function resolveInitialThemeDensity(): ThemeDensity {
  const cachedThemeDensity = localStorage.getItem(THEME_DENSITY_STORAGE_KEY);

  if (
    cachedThemeDensity !== null &&
    THEME_DENSITY_VALUES.includes(cachedThemeDensity as ThemeDensity)
  ) {
    return cachedThemeDensity as ThemeDensity;
  }

  return "comfortable";
}

/** 全局主题 Store。 */
export const useThemeStore = defineStore("theme", () => {
  /** 用户显式选择的主题模式。 */
  const themeMode = ref<ThemeMode>(resolveInitialThemeMode());
  /** 用户显式选择的界面密度。 */
  const themeDensity = ref<ThemeDensity>(resolveInitialThemeDensity());
  /** 系统是否处于暗黑模式。 */
  const systemDarkMode = ref(
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  if (!systemThemeListenerRegistered) {
    const mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (event: { matches: boolean }): void => {
      systemDarkMode.value = event.matches;
    };

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleSystemThemeChange);
    } else {
      mediaQueryList.addListener(handleSystemThemeChange);
    }

    systemThemeListenerRegistered = true;
  }

  /** 当前是否处于暗黑模式。 */
  const isDarkMode = computed(() => {
    if (themeMode.value === "system") {
      return systemDarkMode.value;
    }

    return themeMode.value === "dark";
  });

  /** 当前是否启用紧凑密度。 */
  const isCompactDensity = computed(() => themeDensity.value === "compact");

  /** Ant Design Vue 的全局组件尺寸。 */
  const antdComponentSize = computed<AntdComponentSize>(() => {
    return isCompactDensity.value ? "small" : "middle";
  });

  /** Ant Design Vue 的主题配置对象。 */
  const antdThemeConfig = computed<AntdThemeConfig>(() => ({
    algorithm: isCompactDensity.value
      ? [
          isDarkMode.value
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
          antdTheme.compactAlgorithm,
        ]
      : isDarkMode.value
        ? antdTheme.darkAlgorithm
        : antdTheme.defaultAlgorithm,
    token: {
      ...(isDarkMode.value ? DARK_THEME_TOKEN : LIGHT_THEME_TOKEN),
      ...(isCompactDensity.value ? COMPACT_THEME_TOKEN : {}),
    },
    components: createComponentThemeConfig(
      isDarkMode.value,
      themeDensity.value,
    ),
  }));

  /** 显式设置主题模式。 */
  function setThemeMode(nextThemeMode: ThemeMode): void {
    if (!THEME_MODE_VALUES.includes(nextThemeMode)) {
      return;
    }

    themeMode.value = nextThemeMode;
  }

  /** 显式设置界面密度。 */
  function setThemeDensity(nextThemeDensity: ThemeDensity): void {
    if (!THEME_DENSITY_VALUES.includes(nextThemeDensity)) {
      return;
    }

    themeDensity.value = nextThemeDensity;
  }

  /** 在亮色与暗黑模式之间切换。 */
  function toggleThemeMode(): void {
    setThemeMode(isDarkMode.value ? "light" : "dark");
  }

  watch(
    themeMode,
    (nextThemeMode) => {
      localStorage.setItem(THEME_STORAGE_KEY, nextThemeMode);
    },
    { immediate: true },
  );

  watch(
    themeDensity,
    (nextThemeDensity) => {
      localStorage.setItem(THEME_DENSITY_STORAGE_KEY, nextThemeDensity);
    },
    { immediate: true },
  );

  watch(
    isDarkMode,
    (nextDarkMode) => {
      document.documentElement.dataset.theme = nextDarkMode ? "dark" : "light";
    },
    { immediate: true },
  );

  watch(
    themeDensity,
    (nextThemeDensity) => {
      document.documentElement.dataset.density = nextThemeDensity;
    },
    { immediate: true },
  );

  return {
    themeMode,
    themeDensity,
    isDarkMode,
    isCompactDensity,
    antdThemeConfig,
    antdComponentSize,
    toggleThemeMode,
    setThemeMode,
    setThemeDensity,
  };
});
