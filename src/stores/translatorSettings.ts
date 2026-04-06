/**
 * 文件用途：维护翻译器编辑器的用户偏好设置。
 * 该 store 负责持久化标记创建行为、标记透明度等个性化设置。
 */

import { ref, watch } from "vue";
import { defineStore } from "pinia";

const TRANSLATOR_SETTINGS_STORAGE_KEY = "poprako_translator_settings";

export type MarkerCreationBehavior = "select" | "edit";

export interface TranslatorSettingsData {
  markerCreationBehavior: MarkerCreationBehavior;
  markerOpacity: number;
  markerSize: number;
}

const DEFAULT_SETTINGS: TranslatorSettingsData = {
  markerCreationBehavior: "select",
  markerOpacity: 0.85,
  markerSize: 28,
};

const MARKER_OPACITY_MIN = 0.3;
const MARKER_OPACITY_MAX = 1.0;
const MARKER_SIZE_MIN = 16;
const MARKER_SIZE_MAX = 44;

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

function loadPersistedSettings(): TranslatorSettingsData {
  const raw = localStorage.getItem(TRANSLATOR_SETTINGS_STORAGE_KEY);

  if (!raw) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_SETTINGS };
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

    return { markerCreationBehavior, markerOpacity, markerSize };
  } catch {
    return { ...DEFAULT_SETTINGS };
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

    function persistSettings(): void {
      const data: TranslatorSettingsData = {
        markerCreationBehavior: markerCreationBehavior.value,
        markerOpacity: markerOpacity.value,
        markerSize: markerSize.value,
      };
      localStorage.setItem(
        TRANSLATOR_SETTINGS_STORAGE_KEY,
        JSON.stringify(data),
      );
    }

    watch(markerCreationBehavior, persistSettings);
    watch(markerOpacity, persistSettings);
    watch(markerSize, persistSettings);

    function setMarkerCreationBehavior(value: MarkerCreationBehavior): void {
      markerCreationBehavior.value = value;
    }

    function setMarkerOpacity(value: number): void {
      markerOpacity.value = clampOpacity(value);
    }

    function setMarkerSize(value: number): void {
      markerSize.value = clampSize(value);
    }

    return {
      markerCreationBehavior,
      markerOpacity,
      markerSize,
      setMarkerCreationBehavior,
      setMarkerOpacity,
      setMarkerSize,
    };
  },
);
