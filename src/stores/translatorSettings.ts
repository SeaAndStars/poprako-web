/**
 * 文件用途：维护翻译器编辑器的用户偏好设置。
 * 该 store 负责持久化视觉偏好与快捷键绑定等个性化设置。
 */

import { ref, watch } from "vue";
import { defineStore } from "pinia";

const TRANSLATOR_SETTINGS_STORAGE_KEY = "poprako_translator_settings";
const MARKER_OPACITY_MIN = 0.3;
const MARKER_OPACITY_MAX = 1.0;
const MARKER_SIZE_MIN = 16;
const MARKER_SIZE_MAX = 44;
const SHORTCUT_MODIFIER_ORDER = ["Ctrl", "Shift", "Alt", "Meta"] as const;
const SHORTCUT_DISPLAY_TOKEN_MAP: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
};

export type MarkerCreationBehavior = "select" | "edit";
type ShortcutModifierKey = (typeof SHORTCUT_MODIFIER_ORDER)[number];

export type TranslatorShortcutActionId =
  | "focusSelectedUnit"
  | "commitEditing"
  | "exitEditing"
  | "nextUnit"
  | "previousUnit"
  | "deleteSelectedUnit"
  | "previousPage"
  | "nextPage"
  | "toggleMode"
  | "resetZoom";

export interface TranslatorShortcutActionDefinition {
  id: TranslatorShortcutActionId;
  label: string;
  description: string;
  helpText: string;
  sectionTitle: string;
  defaultBinding: string;
}

export type TranslatorShortcutBindings = Record<
  TranslatorShortcutActionId,
  string
>;

export interface TranslatorSettingsData {
  markerCreationBehavior: MarkerCreationBehavior;
  markerOpacity: number;
  markerSize: number;
  shortcutBindings: TranslatorShortcutBindings;
}

export const TRANSLATOR_SHORTCUT_ACTION_ORDER: TranslatorShortcutActionId[] = [
  "focusSelectedUnit",
  "commitEditing",
  "exitEditing",
  "nextUnit",
  "previousUnit",
  "deleteSelectedUnit",
  "previousPage",
  "nextPage",
  "toggleMode",
  "resetZoom",
];

export const TRANSLATOR_SHORTCUT_ACTION_DEFINITIONS: Record<
  TranslatorShortcutActionId,
  TranslatorShortcutActionDefinition
> = {
  focusSelectedUnit: {
    id: "focusSelectedUnit",
    label: "编辑当前标点",
    description: "聚焦当前选中标点的编辑框。",
    helpText: "编辑当前标点",
    sectionTitle: "标点操作",
    defaultBinding: "Space",
  },
  commitEditing: {
    id: "commitEditing",
    label: "提交当前编辑",
    description: "提交当前文本框内容并退出编辑状态。",
    helpText: "提交当前编辑",
    sectionTitle: "标点操作",
    defaultBinding: "Enter",
  },
  exitEditing: {
    id: "exitEditing",
    label: "退出当前编辑",
    description: "退出当前标点编辑并清空选中状态。",
    helpText: "退出当前编辑",
    sectionTitle: "标点操作",
    defaultBinding: "Escape",
  },
  nextUnit: {
    id: "nextUnit",
    label: "下一个标点",
    description: "切换到下一个标点；在文本框中触发时会先提交编辑。",
    helpText: "下一个标点",
    sectionTitle: "标点操作",
    defaultBinding: "Tab",
  },
  previousUnit: {
    id: "previousUnit",
    label: "上一个标点",
    description: "切换到上一个标点；在文本框中触发时会先提交编辑。",
    helpText: "上一个标点",
    sectionTitle: "标点操作",
    defaultBinding: "Shift+Tab",
  },
  deleteSelectedUnit: {
    id: "deleteSelectedUnit",
    label: "删除当前标点",
    description: "删除当前选中的标点。",
    helpText: "删除当前标点",
    sectionTitle: "标点操作",
    defaultBinding: "Delete",
  },
  previousPage: {
    id: "previousPage",
    label: "上一页",
    description: "跳转到上一页，并在需要时先提交当前编辑。",
    helpText: "上一页",
    sectionTitle: "页面导航",
    defaultBinding: "PageUp",
  },
  nextPage: {
    id: "nextPage",
    label: "下一页",
    description: "跳转到下一页，并在需要时先提交当前编辑。",
    helpText: "下一页",
    sectionTitle: "页面导航",
    defaultBinding: "PageDown",
  },
  toggleMode: {
    id: "toggleMode",
    label: "切换翻译/校对模式",
    description: "在翻译模式与校对模式之间切换。",
    helpText: "切换翻译/校对模式",
    sectionTitle: "视图操作",
    defaultBinding: "Ctrl+M",
  },
  resetZoom: {
    id: "resetZoom",
    label: "重置缩放位置",
    description: "重置图片缩放比例与平移位置。",
    helpText: "重置缩放位置",
    sectionTitle: "视图操作",
    defaultBinding: "Ctrl+0",
  },
};

export interface ShortcutBindingUpdateResult {
  ok: boolean;
  error?: "invalid" | "conflict";
  conflictActionId?: TranslatorShortcutActionId;
  normalizedBinding?: string;
}

const DEFAULT_SHORTCUT_BINDINGS = TRANSLATOR_SHORTCUT_ACTION_ORDER.reduce(
  (bindings, actionId) => {
    bindings[actionId] = TRANSLATOR_SHORTCUT_ACTION_DEFINITIONS[actionId].defaultBinding;
    return bindings;
  },
  {} as TranslatorShortcutBindings,
);

const DEFAULT_SETTINGS: TranslatorSettingsData = {
  markerCreationBehavior: "select",
  markerOpacity: 0.85,
  markerSize: 28,
  shortcutBindings: { ...DEFAULT_SHORTCUT_BINDINGS },
};

function clampOpacity(value: number): number {
  if (!isFinite(value)) {
    return DEFAULT_SETTINGS.markerOpacity;
  }

  return Math.min(MARKER_OPACITY_MAX, Math.max(MARKER_OPACITY_MIN, value));
}

function clampSize(value: number): number {
  if (!isFinite(value)) {
    return DEFAULT_SETTINGS.markerSize;
  }

  return Math.min(
    MARKER_SIZE_MAX,
    Math.max(MARKER_SIZE_MIN, Math.round(value)),
  );
}

function cloneDefaultShortcutBindings(): TranslatorShortcutBindings {
  return { ...DEFAULT_SHORTCUT_BINDINGS };
}

function normalizeShortcutModifierToken(
  rawToken: string,
): ShortcutModifierKey | null {
  const normalizedToken = rawToken.trim().toLowerCase();

  switch (normalizedToken) {
    case "ctrl":
    case "control":
      return "Ctrl";
    case "shift":
      return "Shift";
    case "alt":
    case "option":
      return "Alt";
    case "meta":
    case "cmd":
    case "command":
    case "win":
    case "super":
      return "Meta";
    default:
      return null;
  }
}

function normalizeShortcutPrimaryKey(rawKey: string): string | null {
  if (rawKey === " ") {
    return "Space";
  }

  const trimmedKey = rawKey.trim();
  if (!trimmedKey) {
    return null;
  }

  if (normalizeShortcutModifierToken(trimmedKey)) {
    return null;
  }

  const normalizedKey = trimmedKey.toLowerCase();

  switch (normalizedKey) {
    case " ":
    case "space":
    case "spacebar":
      return "Space";
    case "esc":
    case "escape":
      return "Escape";
    case "enter":
    case "return":
      return "Enter";
    case "tab":
      return "Tab";
    case "delete":
    case "del":
      return "Delete";
    case "backspace":
      return "Backspace";
    case "pageup":
    case "page up":
      return "PageUp";
    case "pagedown":
    case "page down":
      return "PageDown";
    case "home":
      return "Home";
    case "end":
      return "End";
    case "insert":
    case "ins":
      return "Insert";
    case "arrowleft":
    case "left":
      return "ArrowLeft";
    case "arrowright":
    case "right":
      return "ArrowRight";
    case "arrowup":
    case "up":
      return "ArrowUp";
    case "arrowdown":
    case "down":
      return "ArrowDown";
    default:
      break;
  }

  if (/^[a-z]$/i.test(trimmedKey)) {
    return trimmedKey.toUpperCase();
  }

  if (/^[0-9]$/.test(trimmedKey)) {
    return trimmedKey;
  }

  const functionKeyMatch = trimmedKey.match(/^f([1-9]|1[0-2])$/i);
  if (functionKeyMatch) {
    return `F${functionKeyMatch[1]}`;
  }

  return null;
}

function composeShortcutBinding(
  primaryKey: string,
  modifiers: ReadonlySet<ShortcutModifierKey>,
): string {
  return [
    ...SHORTCUT_MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)),
    primaryKey,
  ].join("+");
}

export function normalizeShortcutBinding(rawBinding: string): string | null {
  if (typeof rawBinding !== "string") {
    return null;
  }

  const tokens = rawBinding
    .split("+")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return null;
  }

  const modifiers = new Set<ShortcutModifierKey>();
  let primaryKey: string | null = null;

  for (const token of tokens) {
    const modifier = normalizeShortcutModifierToken(token);
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }

    if (primaryKey) {
      return null;
    }

    primaryKey = normalizeShortcutPrimaryKey(token);
    if (!primaryKey) {
      return null;
    }
  }

  if (!primaryKey) {
    return null;
  }

  return composeShortcutBinding(primaryKey, modifiers);
}

export function normalizeKeyboardEventToShortcut(
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey"
  >,
): string | null {
  const primaryKey = normalizeShortcutPrimaryKey(event.key);
  if (!primaryKey) {
    return null;
  }

  const modifiers = new Set<ShortcutModifierKey>();
  if (event.ctrlKey) {
    modifiers.add("Ctrl");
  }
  if (event.shiftKey) {
    modifiers.add("Shift");
  }
  if (event.altKey) {
    modifiers.add("Alt");
  }
  if (event.metaKey) {
    modifiers.add("Meta");
  }

  return composeShortcutBinding(primaryKey, modifiers);
}

export function formatShortcutBindingForDisplay(binding: string): string {
  const normalizedBinding = normalizeShortcutBinding(binding);
  if (!normalizedBinding) {
    return "未设置";
  }

  return normalizedBinding
    .split("+")
    .map((token) => SHORTCUT_DISPLAY_TOKEN_MAP[token] ?? token)
    .join(" + ");
}

function findShortcutBindingConflict(
  bindings: TranslatorShortcutBindings,
  actionId: TranslatorShortcutActionId,
  candidateBinding: string,
): TranslatorShortcutActionId | null {
  for (const currentActionId of TRANSLATOR_SHORTCUT_ACTION_ORDER) {
    if (currentActionId === actionId) {
      continue;
    }

    if (bindings[currentActionId] === candidateBinding) {
      return currentActionId;
    }
  }

  return null;
}

function buildShortcutBindings(
  rawBindings: unknown,
): TranslatorShortcutBindings {
  const proposedBindings = cloneDefaultShortcutBindings();

  if (!rawBindings || typeof rawBindings !== "object") {
    return proposedBindings;
  }

  const rawBindingRecord = rawBindings as Record<string, unknown>;

  for (const actionId of TRANSLATOR_SHORTCUT_ACTION_ORDER) {
    const rawBinding = rawBindingRecord[actionId];
    if (typeof rawBinding !== "string") {
      continue;
    }

    const normalizedBinding = normalizeShortcutBinding(rawBinding);
    if (!normalizedBinding) {
      continue;
    }

    proposedBindings[actionId] = normalizedBinding;
  }

  const resolvedBindings = cloneDefaultShortcutBindings();
  const usedBindings = new Set<string>();

  for (const actionId of TRANSLATOR_SHORTCUT_ACTION_ORDER) {
    const candidateBinding = proposedBindings[actionId];
    if (!usedBindings.has(candidateBinding)) {
      resolvedBindings[actionId] = candidateBinding;
      usedBindings.add(candidateBinding);
      continue;
    }

    const defaultBinding = DEFAULT_SHORTCUT_BINDINGS[actionId];
    if (!usedBindings.has(defaultBinding)) {
      resolvedBindings[actionId] = defaultBinding;
      usedBindings.add(defaultBinding);
      continue;
    }

    for (const fallbackActionId of TRANSLATOR_SHORTCUT_ACTION_ORDER) {
      const fallbackBinding = DEFAULT_SHORTCUT_BINDINGS[fallbackActionId];
      if (!usedBindings.has(fallbackBinding)) {
        resolvedBindings[actionId] = fallbackBinding;
        usedBindings.add(fallbackBinding);
        break;
      }
    }
  }

  return resolvedBindings;
}

function loadPersistedSettings(): TranslatorSettingsData {
  const raw = localStorage.getItem(TRANSLATOR_SETTINGS_STORAGE_KEY);

  if (!raw) {
    return {
      ...DEFAULT_SETTINGS,
      shortcutBindings: cloneDefaultShortcutBindings(),
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return {
        ...DEFAULT_SETTINGS,
        shortcutBindings: cloneDefaultShortcutBindings(),
      };
    }

    const data = parsed as Record<string, unknown>;

    const markerCreationBehavior =
      data.markerCreationBehavior === "select" ||
      data.markerCreationBehavior === "edit"
        ? data.markerCreationBehavior
        : DEFAULT_SETTINGS.markerCreationBehavior;

    const markerOpacity =
      typeof data.markerOpacity === "number" && isFinite(data.markerOpacity)
        ? clampOpacity(data.markerOpacity)
        : DEFAULT_SETTINGS.markerOpacity;

    const markerSize =
      typeof data.markerSize === "number" && isFinite(data.markerSize)
        ? clampSize(data.markerSize)
        : DEFAULT_SETTINGS.markerSize;

    const shortcutBindings = buildShortcutBindings(data.shortcutBindings);

    return {
      markerCreationBehavior,
      markerOpacity,
      markerSize,
      shortcutBindings,
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      shortcutBindings: cloneDefaultShortcutBindings(),
    };
  }
}

export const useTranslatorSettingsStore = defineStore(
  "translator-settings",
  () => {
    const persisted = loadPersistedSettings();

    const markerCreationBehavior = ref<MarkerCreationBehavior>(
      persisted.markerCreationBehavior,
    );
    const markerOpacity = ref(persisted.markerOpacity);
    const markerSize = ref(persisted.markerSize);
    const shortcutBindings = ref<TranslatorShortcutBindings>(
      persisted.shortcutBindings,
    );

    function persistSettings(): void {
      const data: TranslatorSettingsData = {
        markerCreationBehavior: markerCreationBehavior.value,
        markerOpacity: markerOpacity.value,
        markerSize: markerSize.value,
        shortcutBindings: shortcutBindings.value,
      };
      localStorage.setItem(
        TRANSLATOR_SETTINGS_STORAGE_KEY,
        JSON.stringify(data),
      );
    }

    watch(markerCreationBehavior, persistSettings);
    watch(markerOpacity, persistSettings);
    watch(markerSize, persistSettings);
    watch(shortcutBindings, persistSettings, { deep: true });

    function setMarkerCreationBehavior(value: MarkerCreationBehavior): void {
      markerCreationBehavior.value = value;
    }

    function setMarkerOpacity(value: number): void {
      markerOpacity.value = clampOpacity(value);
    }

    function setMarkerSize(value: number): void {
      markerSize.value = clampSize(value);
    }

    function getShortcutBinding(actionId: TranslatorShortcutActionId): string {
      return shortcutBindings.value[actionId];
    }

    function isShortcutBindingDefault(
      actionId: TranslatorShortcutActionId,
    ): boolean {
      return shortcutBindings.value[actionId] === DEFAULT_SHORTCUT_BINDINGS[actionId];
    }

    function matchesShortcutBinding(
      actionId: TranslatorShortcutActionId,
      event: Pick<
        KeyboardEvent,
        "key" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey"
      >,
    ): boolean {
      const normalizedBinding = normalizeKeyboardEventToShortcut(event);
      return normalizedBinding === shortcutBindings.value[actionId];
    }

    function setShortcutBindingForAction(
      actionId: TranslatorShortcutActionId,
      nextBinding: string,
    ): ShortcutBindingUpdateResult {
      const normalizedBinding = normalizeShortcutBinding(nextBinding);
      if (!normalizedBinding) {
        return {
          ok: false,
          error: "invalid",
        };
      }

      const conflictActionId = findShortcutBindingConflict(
        shortcutBindings.value,
        actionId,
        normalizedBinding,
      );
      if (conflictActionId) {
        return {
          ok: false,
          error: "conflict",
          conflictActionId,
        };
      }

      shortcutBindings.value = {
        ...shortcutBindings.value,
        [actionId]: normalizedBinding,
      };

      return {
        ok: true,
        normalizedBinding,
      };
    }

    function resetShortcutBindingForAction(
      actionId: TranslatorShortcutActionId,
    ): void {
      shortcutBindings.value = {
        ...shortcutBindings.value,
        [actionId]: DEFAULT_SHORTCUT_BINDINGS[actionId],
      };
    }

    function resetAllShortcutBindings(): void {
      shortcutBindings.value = cloneDefaultShortcutBindings();
    }

    return {
      markerCreationBehavior,
      markerOpacity,
      markerSize,
      shortcutBindings,
      setMarkerCreationBehavior,
      setMarkerOpacity,
      setMarkerSize,
      getShortcutBinding,
      isShortcutBindingDefault,
      matchesShortcutBinding,
      setShortcutBindingForAction,
      resetShortcutBindingForAction,
      resetAllShortcutBindings,
    };
  },
);
