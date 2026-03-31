<template>
  <div class="special-symbols-layout">
    <header class="special-symbols-header">
      <h1>特殊符号库</h1>
    </header>

    <main class="special-symbols-body">
      <section class="special-symbols-main">
        <h2 class="summary-title">
          <StarOutlined />
          总字符表
        </h2>

        <article
          v-for="symbolSection in symbolSections"
          :key="symbolSection.key"
          class="symbol-section"
        >
          <h3 class="symbol-section__title">
            <span class="symbol-section__dot" />
            {{ symbolSection.title }}
          </h3>

          <div class="symbol-grid">
            <button
              v-for="symbolValue in symbolSection.symbols"
              :key="`${symbolSection.key}-${symbolValue}`"
              type="button"
              class="symbol-item"
              :class="{ 'symbol-item--active': isSymbolInCustom(symbolValue) }"
              @click="handleMainSymbolClick(symbolValue)"
            >
              <span class="symbol-item__glyph">{{ symbolValue }}</span>
            </button>
          </div>
        </article>
      </section>

      <aside class="special-symbols-panel">
        <div class="panel-header">
          <div class="panel-title">
            <AppstoreOutlined />
            <span>自定义表</span>
            <a-tooltip
              title="可以在翻校模式中使用的快捷符号表，如果设置过多可能会影响翻页面编辑区的显示。"
            >
              <QuestionCircleOutlined class="panel-help" />
            </a-tooltip>
          </div>

          <div class="panel-actions">
            <span class="panel-count">{{ customSymbolCountLabel }}</span>
            <a-button size="small" @click="toggleEditMode">
              {{ editMode ? "完成编辑" : "编辑模式" }}
            </a-button>
          </div>
        </div>

        <div class="panel-grid">
          <button
            v-for="symbolValue in customSymbols"
            :key="`custom-${symbolValue}`"
            type="button"
            class="symbol-item symbol-item--custom"
            @click="handleCustomSymbolClick(symbolValue)"
          >
            <span class="symbol-item__glyph">{{ symbolValue }}</span>
          </button>

          <p v-if="customSymbols.length === 0" class="panel-empty">
            暂无自定义符号
          </p>
        </div>

        <p class="panel-hint">
          {{
            editMode
              ? "编辑模式：点击左侧符号可添加/移除，点击右侧符号可快速移除。"
              : "普通模式：点击任意符号复制到剪贴板。"
          }}
        </p>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { message } from "ant-design-vue";
import {
  AppstoreOutlined,
  QuestionCircleOutlined,
  StarOutlined,
} from "@ant-design/icons-vue";

interface SymbolSection {
  key: string;
  title: string;
  symbols: ReadonlyArray<string>;
}

const MAX_CUSTOM_SYMBOL_COUNT = 15;

const symbolSections: ReadonlyArray<SymbolSection> = [
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

const customSymbols = ref<Array<string>>([
  "★",
  "☆",
  "♥",
  "♡",
  "✳",
  "●",
  "○",
  "×",
]);
const editMode = ref(false);

const customSymbolCountLabel = computed(
  () => `${customSymbols.value.length}/${MAX_CUSTOM_SYMBOL_COUNT}`,
);

function isSymbolInCustom(symbolValue: string): boolean {
  return customSymbols.value.includes(symbolValue);
}

function toggleEditMode(): void {
  editMode.value = !editMode.value;
}

function toggleSymbolInCustom(symbolValue: string): void {
  const symbolIndex = customSymbols.value.indexOf(symbolValue);

  if (symbolIndex >= 0) {
    customSymbols.value.splice(symbolIndex, 1);
    return;
  }

  if (customSymbols.value.length >= MAX_CUSTOM_SYMBOL_COUNT) {
    message.warning(`自定义表最多支持 ${MAX_CUSTOM_SYMBOL_COUNT} 个符号`);
    return;
  }

  customSymbols.value.push(symbolValue);
}

async function copySymbol(symbolValue: string): Promise<void> {
  try {
    if (window.navigator.clipboard && window.isSecureContext) {
      await window.navigator.clipboard.writeText(symbolValue);
      message.success(`已复制 ${symbolValue}`);
      return;
    }

    const temporaryTextarea = document.createElement("textarea");
    temporaryTextarea.value = symbolValue;
    temporaryTextarea.setAttribute("readonly", "true");
    temporaryTextarea.style.position = "fixed";
    temporaryTextarea.style.left = "-9999px";
    document.body.appendChild(temporaryTextarea);
    temporaryTextarea.select();
    document.execCommand("copy");
    document.body.removeChild(temporaryTextarea);
    message.success(`已复制 ${symbolValue}`);
  } catch {
    message.error("复制失败，请手动复制");
  }
}

function handleMainSymbolClick(symbolValue: string): void {
  if (editMode.value) {
    toggleSymbolInCustom(symbolValue);
    return;
  }

  void copySymbol(symbolValue);
}

function handleCustomSymbolClick(symbolValue: string): void {
  if (editMode.value) {
    const symbolIndex = customSymbols.value.indexOf(symbolValue);
    if (symbolIndex >= 0) {
      customSymbols.value.splice(symbolIndex, 1);
    }
    return;
  }

  void copySymbol(symbolValue);
}
</script>

<style scoped lang="scss">
.special-symbols-layout {
  --symbol-item-border: transparent;
  --symbol-item-border-hover: var(--control-btn-primary-border-hover);
  --symbol-item-text: var(--text-primary);

  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.special-symbols-header {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--dashboard-header-border);
  background: var(--dashboard-header-bg);
}

.special-symbols-header h1 {
  margin: 0;
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.special-symbols-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 260px;
}

.special-symbols-main {
  padding: 28px 36px;
  overflow: auto;
}

.summary-title {
  margin: 0 0 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 30px;
}

.symbol-section {
  margin-bottom: 26px;
}

.symbol-section__title {
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 24px;
}

.symbol-section__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #70ba84;
  box-shadow: 0 0 0 2px rgba(112, 186, 132, 0.18);
}

.symbol-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.symbol-item {
  width: 40px;
  height: 40px;
  border: 1px solid var(--symbol-item-border);
  border-radius: 10px;
  background: transparent;
  color: var(--symbol-item-text);
  appearance: none;
  -webkit-appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.symbol-item__glyph {
  display: inline-flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  line-height: 1;
  text-align: center;
  color: inherit;
  -webkit-text-fill-color: currentColor;
}

.symbol-item:hover {
  border-color: var(--symbol-item-border-hover);
  background: transparent;
  color: var(--symbol-item-text);
  transform: translateY(-1px);
}

.symbol-item:focus-visible {
  border-color: var(--symbol-item-border-hover);
  background: transparent;
  color: var(--symbol-item-text);
  outline: none;
  transform: translateY(-1px);
}

.symbol-item--active {
  border-color: var(--symbol-item-border);
  background: transparent;
  color: var(--symbol-item-text);
}

.special-symbols-panel {
  border-left: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  backdrop-filter: blur(10px) saturate(115%);
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 24px;
  font-weight: 600;
}

.panel-help {
  font-size: 18px;
  color: var(--text-muted);
}

.panel-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.panel-count {
  padding: 4px 10px;
  border-radius: 10px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--table-head-bg) 70%, transparent);
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  align-content: start;
}

.symbol-item--custom {
  width: 100%;
  height: 36px;
}

.symbol-item--custom .symbol-item__glyph {
  font-size: 22px;
}

.panel-empty {
  margin: 12px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  grid-column: 1 / -1;
}

.panel-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-muted);
}

:global(html[data-theme="dark"]) .special-symbols-layout {
  --symbol-item-border-hover: var(--control-btn-primary-border-hover);
}

@media (max-width: 1280px) {
  .special-symbols-header h1 {
    font-size: 30px;
  }

  .summary-title {
    font-size: 24px;
  }

  .symbol-section__title {
    font-size: 20px;
  }
}

@media (max-width: 960px) {
  .special-symbols-body {
    grid-template-columns: 1fr;
  }

  .special-symbols-panel {
    border-left: 0;
    border-top: 1px solid var(--panel-border);
  }
}
</style>
