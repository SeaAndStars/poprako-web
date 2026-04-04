/**
 * 文件用途：维护翻译器与特殊符号页共用的快捷符号状态。
 * 该 store 负责持久化自定义符号表，确保 web/client 双端的使用体验一致。
 */

import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";

const SPECIAL_SYMBOL_STORAGE_KEY = "poprako_special_symbols_custom";

export interface SymbolSection {
  key: string;
  title: string;
  symbols: ReadonlyArray<string>;
}

export const MAX_CUSTOM_SYMBOL_COUNT = 15;

export const SYMBOL_SECTIONS: ReadonlyArray<SymbolSection> = [
  {
    key: "star-heart",
    title: "星形与爱心",
    symbols: ["★", "☆", "♥", "♡", "✳", "✿", "❀"],
  },
  {
    key: "state",
    title: "状态与标记",
    symbols: ["✓", "✗", "●", "○", "×"],
  },
  {
    key: "music",
    title: "音乐符号",
    symbols: ["♪", "♬", "♫", "♯", "♭", "♮"],
  },
  {
    key: "quote",
    title: "引号（成对）",
    symbols: ["『』", "「」", "【】", "〈〉"],
  },
  {
    key: "others",
    title: "其他",
    symbols: ["©", "®", "♂", "♀", "♁", "▶", "◀", "§"],
  },
];

const DEFAULT_CUSTOM_SYMBOLS = ["★", "☆", "♥", "♡", "✳", "●", "○", "×"];

export type ToggleSymbolResult = "added" | "removed" | "limit-exceeded";

/**
 * 从 localStorage 恢复自定义符号表。
 */
function loadPersistedSymbols(): string[] {
  const rawSymbols = localStorage.getItem(SPECIAL_SYMBOL_STORAGE_KEY);

  if (!rawSymbols) {
    return [...DEFAULT_CUSTOM_SYMBOLS];
  }

  try {
    const parsedSymbols = JSON.parse(rawSymbols) as unknown;

    if (!Array.isArray(parsedSymbols)) {
      return [...DEFAULT_CUSTOM_SYMBOLS];
    }

    const sanitizedSymbols = parsedSymbols.filter((item): item is string => {
      return typeof item === "string" && item.trim().length > 0;
    });

    return sanitizedSymbols.length > 0
      ? sanitizedSymbols.slice(0, MAX_CUSTOM_SYMBOL_COUNT)
      : [...DEFAULT_CUSTOM_SYMBOLS];
  } catch {
    return [...DEFAULT_CUSTOM_SYMBOLS];
  }
}

export const useSpecialSymbolsStore = defineStore("special-symbols", () => {
  const customSymbols = ref<string[]>(loadPersistedSymbols());

  const customSymbolCountLabel = computed(() => {
    return `${customSymbols.value.length}/${MAX_CUSTOM_SYMBOL_COUNT}`;
  });

  watch(
    customSymbols,
    (nextSymbols) => {
      localStorage.setItem(
        SPECIAL_SYMBOL_STORAGE_KEY,
        JSON.stringify(nextSymbols.slice(0, MAX_CUSTOM_SYMBOL_COUNT)),
      );
    },
    {
      deep: true,
      immediate: true,
    },
  );

  /**
   * 判断某个符号是否已在自定义表中。
   */
  function isSymbolInCustom(symbolValue: string): boolean {
    return customSymbols.value.includes(symbolValue);
  }

  /**
   * 切换符号是否出现在自定义表中。
   */
  function toggleCustomSymbol(symbolValue: string): ToggleSymbolResult {
    const targetIndex = customSymbols.value.indexOf(symbolValue);

    if (targetIndex >= 0) {
      customSymbols.value.splice(targetIndex, 1);
      return "removed";
    }

    if (customSymbols.value.length >= MAX_CUSTOM_SYMBOL_COUNT) {
      return "limit-exceeded";
    }

    customSymbols.value.push(symbolValue);
    return "added";
  }

  /**
   * 从自定义表中移除指定符号。
   */
  function removeCustomSymbol(symbolValue: string): void {
    const targetIndex = customSymbols.value.indexOf(symbolValue);

    if (targetIndex < 0) {
      return;
    }

    customSymbols.value.splice(targetIndex, 1);
  }

  return {
    symbolSections: SYMBOL_SECTIONS,
    customSymbols,
    customSymbolCountLabel,
    isSymbolInCustom,
    toggleCustomSymbol,
    removeCustomSymbol,
  };
});
