<template>
  <div
    v-if="projectRecord"
    class="translator-layout"
    :class="{ 'is-global-dragging': isDragging || Boolean(draggingUnitID) }"
  >
    <!-- 顶栏：返回 + 项目名 + 翻页导航 -->
    <header class="translator-header">
      <div class="translator-header__left">
        <a-button
          type="text"
          class="translator-header__back"
          @click="handleReturnToWorkspace"
        >
          ← 返回
        </a-button>
        <span class="translator-header__title">
          [{{ projectRecord.author }}] {{ projectRecord.title }}
        </span>
      </div>

      <div v-if="currentPageMeta" class="translator-header__right">
        <a-button
          :disabled="currentPageIndex <= 0"
          size="small"
          @click="moveToPreviousPage"
        >
          &lt;
        </a-button>

        <a-select
          class="translator-header__page-select"
          :value="currentPageIndex"
          size="small"
          :options="pageSelectOptions"
          @change="handlePageSelectChange"
        />

        <span class="translator-header__page-total">
          共 {{ projectRecord.page_count }} 页
        </span>

        <span
          class="translator-header__page-status"
          :class="{ 'is-readonly': isCurrentPageLockedByOther }"
        >
          {{ currentPageStatusText }}
        </span>

        <a-button
          :disabled="currentPageIndex >= projectRecord.page_count - 1"
          size="small"
          @click="moveToNextPage"
        >
          &gt;
        </a-button>
      </div>
    </header>

    <!-- 主体：图片区（含浮动统计）+ 右侧面板 -->
    <main
      v-if="projectRecord.pages.length > 0 && currentPageMeta"
      class="translator-body"
    >
      <!-- 图片区域 -->
      <section class="translator-stage-area" @click.self="clearSelectedUnit">
        <!-- 浮动统计面板 -->
        <div
          class="translator-stats-overlay"
          :class="{ 'is-pass-through': isDragging || Boolean(draggingUnitID) }"
        >
          <div class="translator-stats-badge stats-badge--pink">
            <span class="translator-stats-text">框内</span>
            <span class="translator-stats-count">{{ pageInboxCount }}</span>
          </div>
          <div class="translator-stats-badge stats-badge--yellow">
            <span class="translator-stats-text">框外</span>
            <span class="translator-stats-count">{{ pageOutboxCount }}</span>
          </div>
          <div class="translator-stats-divider" />
          <div class="translator-stats-badge stats-badge--gray">
            <span class="translator-stats-text">未翻</span>
            <span class="translator-stats-count">{{
              pageUntranslatedCount
            }}</span>
          </div>
          <div class="translator-stats-badge stats-badge--orange">
            <span class="translator-stats-text">已翻</span>
            <span class="translator-stats-count">{{
              currentPageTranslatedCount
            }}</span>
          </div>
          <div class="translator-stats-badge stats-badge--green">
            <span class="translator-stats-text">已校</span>
            <span class="translator-stats-count">{{
              currentPageProofreadCount
            }}</span>
          </div>
        </div>

        <!-- 图片 + 标记画布 -->
        <div
          v-if="currentPageImageURL"
          class="translator-stage"
          :class="{ 'is-panning': isDragging }"
          @wheel="handleStageWheel"
          @mousedown="handleStageDragStart"
        >
          <div class="translator-stage__media" :style="stageTransformStyle">
            <img
              :src="currentPageImageURL"
              :alt="currentPageMeta.name"
              class="translator-stage__image"
              @error="handleImageError"
            />

            <div
              ref="stageOverlayRef"
              class="translator-stage__overlay"
              @click="handleOverlayClick"
              @contextmenu.prevent="handleOverlayContextMenu"
            >
              <div
                v-for="projectUnit in currentPageUnits"
                v-show="
                  editorMode === 'proofread' &&
                  hasTextContent(resolveFinalUnitText(projectUnit))
                "
                :key="`${projectUnit.id}_proofread_bubble`"
                class="translator-proofread-bubble"
                :class="{
                  'is-dark': isDarkTheme,
                  'is-outbox': !projectUnit.is_bubble,
                  'is-active': projectUnit.id === selectedUnitID,
                }"
                :style="resolveProofreadBubbleStyle(projectUnit)"
              >
                {{ resolveFinalUnitText(projectUnit) }}
              </div>

              <button
                v-for="projectUnit in currentPageUnits"
                :key="projectUnit.id"
                type="button"
                class="translator-marker"
                :class="{
                  'is-active': projectUnit.id === selectedUnitID,
                  'is-editing': projectUnit.id === editingUnitID,
                  'is-outbox': !projectUnit.is_bubble,
                  'is-translated':
                    isUnitTranslated(projectUnit) &&
                    !isUnitProofread(projectUnit),
                  'is-proofread': isUnitProofread(projectUnit),
                  'is-dragging': draggingUnitID === projectUnit.id,
                }"
                :style="resolveMarkerStyle(projectUnit)"
                @click.stop="handleSelectUnit(projectUnit.id)"
                @contextmenu.prevent.stop="requestRemoveUnit(projectUnit.id)"
                @mousedown.stop="handleMarkerDragStart($event, projectUnit.id)"
              >
                {{ projectUnit.index }}
              </button>
            </div>
          </div>
        </div>

        <div v-else class="translator-stage__empty">
          <span v-if="imageLoading">图片加载中…</span>
          <span v-else>当前页图片加载失败或不存在。</span>
        </div>
      </section>

      <!-- 右侧面板 — 内联编辑 -->
      <aside class="translator-right-panel" @click.self="clearSelectedUnit">
        <section class="translator-unit-list" @click.self="clearSelectedUnit">
          <div
            v-for="projectUnit in currentPageUnits"
            :key="projectUnit.id"
            class="translator-unit-card"
            :class="{
              'is-active': projectUnit.id === selectedUnitID,
              'is-editing': projectUnit.id === editingUnitID,
              'is-inbox': projectUnit.is_bubble,
              'is-outbox': !projectUnit.is_bubble,
              'is-empty': !isUnitTranslated(projectUnit),
              'is-pending':
                isUnitTranslated(projectUnit) && !isUnitProofread(projectUnit),
              'is-proofread': isUnitProofread(projectUnit),
            }"
            @click="handleSelectUnit(projectUnit.id)"
          >
            <!-- 序号列 -->
            <div class="translator-unit-card__index">
              <span class="translator-unit-card__num">{{
                String(projectUnit.index).padStart(2, "0")
              }}</span>
              <button
                v-if="projectUnit.id === selectedUnitID"
                type="button"
                class="translator-unit-card__type-toggle"
                :class="projectUnit.is_bubble ? 'is-inbox' : 'is-outbox'"
                :disabled="!currentPageCanMutateStructure"
                @click.stop="toggleSelectedUnitBubble"
              >
                {{ projectUnit.is_bubble ? "内" : "外" }}
              </button>
            </div>

            <!-- 内容区 -->
            <div class="translator-unit-card__body">
              <!-- 未选中: 预览 -->
              <template v-if="projectUnit.id !== selectedUnitID">
                <!-- 校对模式下同时显示翻译与校对 -->
                <template
                  v-if="
                    editorMode === 'proofread' &&
                    hasTextContent(projectUnit.proofread_text)
                  "
                >
                  <div
                    v-if="hasTextContent(projectUnit.translated_text)"
                    class="translator-unit-card__preview-block"
                  >
                    <div class="translator-unit-card__section-head">
                      <div class="translator-unit-card__section-identity">
                        <a-avatar
                          :size="18"
                          class="translator-unit-card__section-avatar is-translate"
                          :src="currentUserAvatarURL || undefined"
                        >
                          {{ currentUserInitial }}
                        </a-avatar>
                        <span class="translator-unit-card__section-label"
                          >翻译</span
                        >
                      </div>
                      <span class="translator-unit-card__section-name">{{
                        currentUserDisplayName
                      }}</span>
                    </div>
                    <span
                      class="translator-unit-card__preview is-diff-origin"
                      >{{ projectUnit.translated_text }}</span
                    >
                  </div>
                  <div
                    v-if="hasTextContent(projectUnit.translated_text)"
                    class="translator-unit-card__section-divider"
                  />
                  <div class="translator-unit-card__preview-block">
                    <div class="translator-unit-card__section-head">
                      <div class="translator-unit-card__section-identity">
                        <a-avatar
                          :size="18"
                          class="translator-unit-card__section-avatar is-proofread"
                          :src="currentUserAvatarURL || undefined"
                        >
                          {{ currentUserInitial }}
                        </a-avatar>
                        <span class="translator-unit-card__section-label"
                          >校对</span
                        >
                      </div>
                      <span class="translator-unit-card__section-name">{{
                        currentUserDisplayName
                      }}</span>
                    </div>
                    <span
                      class="translator-unit-card__preview is-diff-result"
                      >{{ projectUnit.proofread_text }}</span
                    >
                  </div>
                </template>
                <div v-else class="translator-unit-card__preview-block">
                  <div class="translator-unit-card__section-head">
                    <div class="translator-unit-card__section-identity">
                      <a-avatar
                        :size="18"
                        class="translator-unit-card__section-avatar is-translate"
                        :src="currentUserAvatarURL || undefined"
                      >
                        {{ currentUserInitial }}
                      </a-avatar>
                      <span class="translator-unit-card__section-label"
                        >翻译</span
                      >
                    </div>
                    <span class="translator-unit-card__section-name">{{
                      currentUserDisplayName
                    }}</span>
                  </div>
                  <span
                    v-if="hasTextContent(projectUnit.translated_text)"
                    class="translator-unit-card__preview"
                    :class="{ 'is-muted': editorMode === 'proofread' }"
                    >{{ projectUnit.translated_text }}</span
                  >
                  <span
                    v-else
                    class="translator-unit-card__preview is-placeholder"
                    >无翻译内容</span
                  >
                </div>
              </template>

              <!-- 选中: 内联编辑 -->
              <template v-else>
                <div class="translator-unit-card__field">
                  <div class="translator-unit-card__section-head">
                    <div class="translator-unit-card__section-identity">
                      <a-avatar
                        :size="18"
                        class="translator-unit-card__section-avatar is-translate"
                        :src="currentUserAvatarURL || undefined"
                      >
                        {{ currentUserInitial }}
                      </a-avatar>
                      <span class="translator-unit-card__section-label"
                        >翻译</span
                      >
                    </div>
                    <span class="translator-unit-card__section-name">{{
                      currentUserDisplayName
                    }}</span>
                  </div>
                  <div class="translator-unit-card__field-content">
                    <textarea
                      data-field="translated_text"
                      class="translator-unit-card__textarea"
                      :class="{ 'is-readonly': !currentPageCanEditTranslate }"
                      :value="projectUnit.translated_text"
                      :readonly="!currentPageCanEditTranslate"
                      :placeholder="
                        editorMode === 'translate'
                          ? '请输入翻译．．．'
                          : '翻译文本'
                      "
                      rows="1"
                      @focus="handleUnitFieldFocus('translated_text', $event)"
                      @blur="handleUnitFieldBlur"
                      @input="handleTextFieldInput('translated_text', $event)"
                      @click.stop
                    />
                    <button
                      type="button"
                      class="translator-unit-card__field-btn"
                      :disabled="!currentPageCanEditTranslate"
                      title="清空翻译"
                      @click.stop="clearFieldValue('translated_text')"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div
                  v-if="editorMode === 'proofread'"
                  class="translator-unit-card__section-divider"
                />

                <div
                  v-if="editorMode === 'proofread'"
                  class="translator-unit-card__field"
                >
                  <div class="translator-unit-card__section-head">
                    <div class="translator-unit-card__section-identity">
                      <a-avatar
                        :size="18"
                        class="translator-unit-card__section-avatar is-proofread"
                        :src="currentUserAvatarURL || undefined"
                      >
                        {{ currentUserInitial }}
                      </a-avatar>
                      <span class="translator-unit-card__section-label"
                        >校对</span
                      >
                    </div>
                    <span class="translator-unit-card__section-name">{{
                      currentUserDisplayName
                    }}</span>
                  </div>
                  <div class="translator-unit-card__field-content">
                    <textarea
                      data-field="proofread_text"
                      class="translator-unit-card__textarea"
                      :class="{ 'is-readonly': !currentPageCanEditProofread }"
                      :value="projectUnit.proofread_text"
                      :readonly="!currentPageCanEditProofread"
                      placeholder="请输入校对．．．"
                      rows="1"
                      @focus="handleUnitFieldFocus('proofread_text', $event)"
                      @blur="handleUnitFieldBlur"
                      @input="handleTextFieldInput('proofread_text', $event)"
                      @click.stop
                    />
                    <button
                      type="button"
                      class="translator-unit-card__field-btn"
                      :disabled="!currentPageCanEditProofread"
                      title="清空校对"
                      @click.stop="clearFieldValue('proofread_text')"
                    >
                      ◇
                    </button>
                  </div>
                </div>

                <!-- 快捷符号 -->
                <div class="translator-unit-card__symbols">
                  <button
                    v-for="symbolValue in customSymbols"
                    :key="symbolValue"
                    type="button"
                    class="translator-unit-card__symbol-btn"
                    :disabled="!isCurrentFieldEditable"
                    @click.stop="insertQuickSymbol(symbolValue)"
                  >
                    {{ symbolValue }}
                  </button>
                </div>
              </template>
            </div>

            <!-- 右侧操作 -->
            <div class="translator-unit-card__side">
              <button
                v-if="
                  projectUnit.id === selectedUnitID &&
                  editorMode === 'proofread' &&
                  !hasTextContent(projectUnit.proofread_text)
                "
                type="button"
                class="translator-unit-card__side-btn"
                :class="{
                  'is-checked': isUnitProofread(projectUnit),
                  'is-direct-pass': canDirectPassProofread(projectUnit),
                }"
                :disabled="!canToggleProofreadAction"
                :title="resolveProofreadActionTitle(projectUnit)"
                @click.stop="toggleSelectedUnitProofread"
              >
                {{ resolveProofreadActionText(projectUnit) }}
              </button>
              <span
                v-else-if="isUnitProofread(projectUnit)"
                class="translator-unit-card__check-badge"
                :title="
                  hasTextContent(projectUnit.proofread_text)
                    ? '已有校对内容'
                    : '已校对'
                "
                >✓</span
              >
            </div>
          </div>

          <div
            v-if="currentPageUnits.length === 0"
            class="translator-unit-list__empty"
          >
            点击图片空白处创建标记
          </div>
        </section>
      </aside>
    </main>

    <!-- 底部状态栏 -->
    <footer v-if="currentPageMeta" class="translator-footer">
      <div class="translator-footer__info-group">
        <span class="translator-footer__info-item">
          {{ currentPageMeta.name }}
        </span>
        <span class="translator-footer__info-item">
          第 {{ currentPageIndex + 1 }} / {{ projectRecord.page_count }} 页
        </span>
        <span class="translator-footer__info-item">
          {{ currentPageUnits.length }} 标记
        </span>
        <span
          class="translator-footer__info-item"
          :class="{ 'is-highlight': isCurrentPageLockedByOther }"
        >
          {{ currentPageStatusText }}
        </span>
      </div>
      <div class="translator-footer__right">
        <span
          class="translator-footer__hint"
          :class="{ 'is-readonly': isCurrentPageLockedByOther }"
        >
          {{ footerHintText }}
        </span>
        <span class="translator-footer__zoom">{{ zoomDisplayText }}</span>
        <button class="translator-footer__mode-btn" @click="toggleEditorMode">
          {{ editorMode === "translate" ? "翻译模式" : "校对模式" }}
        </button>
      </div>
    </footer>

    <div v-else class="translator-empty-state">
      <a-empty description="该项目当前没有可编辑页面">
        <a-button type="primary" @click="handleReturnToWorkspace">
          返回工作区
        </a-button>
      </a-empty>
    </div>
  </div>

  <div v-else class="translator-empty-state">
    <a-empty description="未找到对应项目，可能已被删除或尚未创建。">
      <a-button type="primary" @click="handleReturnToWorkspace">
        返回工作区
      </a-button>
    </a-empty>
  </div>
</template>

<script setup lang="ts">
/**
 * 文件用途：本地翻译器页面。
 * 页面负责项目页切换、图片标记、翻译/校对文本编辑以及快捷符号插入。
 */
import {
  buildLocalProjectCollaborationKey,
  buildLocalProjectPageCollaborationKey,
  resolveTranslatorModeLabel,
  type TranslatorMode,
} from "../local-project/collaboration";
import { resolveLocalProjectImageURL } from "../local-project/assets";
import type { LocalProjectUnit } from "../local-project/types";
import { getDefaultLocalProjectUnitBoxSize } from "../local-project/types";
import { useAuthStore } from "../stores/auth";
import { useLocalProjectsStore } from "../stores/localProjects";
import { useSpecialSymbolsStore } from "../stores/specialSymbols";
import {
  useTranslatorCollaborationStore,
  type TranslatorPageSnapshot,
} from "../stores/translatorCollaboration";
import type { UserInfo } from "../types/domain";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { Modal, message } from "ant-design-vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { getCurrentUserProfile } from "../api/modules";
import { resolveAssetUrl } from "../api/objectStorage";
type EditableFieldKey = "translated_text" | "proofread_text";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const localProjectsStore = useLocalProjectsStore();
const specialSymbolsStore = useSpecialSymbolsStore();
const translatorCollaborationStore = useTranslatorCollaborationStore();
const { projects } = storeToRefs(localProjectsStore);
const { customSymbols } = storeToRefs(specialSymbolsStore);
const {
  currentPageEditor,
  hasCurrentPageLock,
  isConnected: isCollaborationConnected,
  isCurrentPageLockedByOther,
  pageEditorsByPageKey,
  pageSnapshots,
} = storeToRefs(translatorCollaborationStore);

const stageOverlayRef = ref<HTMLElement | null>(null);
const isDarkTheme = ref(document.documentElement.dataset.theme === "dark");
const currentUserProfile = ref<UserInfo | null>(null);
let themeObserver: MutationObserver | null = null;

const editorMode = ref<TranslatorMode>("translate");
const activeTextField = ref<EditableFieldKey>("translated_text");
const currentPageIndex = ref(0);
const currentPageImageURL = ref<string | null>(null);
const imageLoading = ref(false);
const currentPageUnits = ref<LocalProjectUnit[]>([]);
const selectedUnitID = ref<string | null>(null);
const editingUnitID = ref<string | null>(null);
const isAcquiringPageLock = ref(false);

/* ── 图片缩放 & 平移状态 ── */
const stageScale = ref(1);
const stagePanX = ref(0);
const stagePanY = ref(0);
const isDragging = ref(false);
let dragLastX = 0;
let dragLastY = 0;
let stageDragMoved = false;

/* ── 标记拖拽状态 ── */
const draggingUnitID = ref<string | null>(null);
let markerDragStartX = 0;
let markerDragStartY = 0;
let markerDragOrigX = 0;
let markerDragOrigY = 0;
let markerDragMoved = false;

const stageTransformStyle = computed(() => ({
  transform: `translate(${stagePanX.value}px, ${stagePanY.value}px) scale(${stageScale.value})`,
  transformOrigin: "center center",
}));

const projectID = computed(() => String(route.params.projectId ?? ""));

const projectRecord = computed(() => {
  return (
    projects.value.find((projectItem) => projectItem.id === projectID.value) ??
    null
  );
});

const currentPageMeta = computed(() => {
  return projectRecord.value?.pages[currentPageIndex.value] ?? null;
});

const currentPageID = computed(() => currentPageMeta.value?.id ?? null);

const projectCollaborationKey = computed(() => {
  if (!projectRecord.value) {
    return "";
  }

  return buildLocalProjectCollaborationKey(projectRecord.value);
});

const currentPageCollaborationKey = computed(() => {
  if (!projectRecord.value || !currentPageMeta.value) {
    return "";
  }

  return buildLocalProjectPageCollaborationKey(
    projectRecord.value,
    currentPageMeta.value,
  );
});

const selectedUnit = computed(() => {
  return (
    currentPageUnits.value.find(
      (projectUnit) => projectUnit.id === selectedUnitID.value,
    ) ?? null
  );
});

const currentUserDisplayName = computed(() => {
  return (
    currentUserProfile.value?.name ||
    currentUserProfile.value?.username ||
    "当前成员"
  );
});

const currentUserAvatarURL = computed(() => {
  return resolveAssetUrl(
    currentUserProfile.value?.avatar_url || currentUserProfile.value?.avatar,
  );
});

const currentUserInitial = computed(() => {
  return currentUserDisplayName.value.trim().charAt(0).toUpperCase() || "协";
});

const currentPageSnapshot = computed<TranslatorPageSnapshot | null>(() => {
  if (!currentPageCollaborationKey.value) {
    return null;
  }

  return pageSnapshots.value[currentPageCollaborationKey.value] ?? null;
});

const currentPageStatusText = computed(() => {
  if (!authStore.isLoggedIn || !currentUserProfile.value?.id) {
    return "未登录，仅本地编辑";
  }

  if (!isCollaborationConnected.value) {
    return "协作离线，仅本地编辑";
  }

  if (!currentPageEditor.value) {
    return "当前页空闲";
  }

  const currentEditorName =
    currentPageEditor.value.user_id === currentUserProfile.value.id
      ? "你"
      : currentPageEditor.value.display_name;

  return `${currentEditorName}正在${resolveTranslatorModeLabel(currentPageEditor.value.mode)}`;
});

const currentPageLockHint = computed(() => {
  if (!currentPageEditor.value || !isCurrentPageLockedByOther.value) {
    return currentPageStatusText.value;
  }

  return `${currentPageEditor.value.display_name} 正在${resolveTranslatorModeLabel(currentPageEditor.value.mode)}，当前页面仅可查看`;
});

const currentPageCanEditTranslate = computed(() => {
  return (
    editorMode.value === "translate" &&
    !isCurrentPageLockedByOther.value &&
    !isAcquiringPageLock.value
  );
});

const currentPageCanEditProofread = computed(() => {
  return (
    editorMode.value === "proofread" &&
    !isCurrentPageLockedByOther.value &&
    !isAcquiringPageLock.value
  );
});

const currentPageCanMutateStructure = computed(() => {
  return (
    editorMode.value === "translate" &&
    !isCurrentPageLockedByOther.value &&
    !isAcquiringPageLock.value
  );
});

const canToggleProofreadAction = computed(() => {
  return (
    editorMode.value === "proofread" &&
    !isCurrentPageLockedByOther.value &&
    !isAcquiringPageLock.value
  );
});

const isCurrentFieldEditable = computed(() => {
  return activeTextField.value === "proofread_text"
    ? currentPageCanEditProofread.value
    : currentPageCanEditTranslate.value;
});

const pageSelectOptions = computed(() => {
  if (!projectRecord.value) {
    return [];
  }

  return projectRecord.value.pages.map((projectPage, index) => {
    const pageKey = buildLocalProjectPageCollaborationKey(
      projectRecord.value!,
      projectPage,
    );
    const pageEditor = pageEditorsByPageKey.value[pageKey];
    const pageStatusText = pageEditor
      ? ` · ${pageEditor.display_name}正在${resolveTranslatorModeLabel(pageEditor.mode)}`
      : "";

    return {
      value: index,
      label: `第 ${projectPage.index} 页${pageStatusText}`,
    };
  });
});

const footerHintText = computed(() => {
  if (isCurrentPageLockedByOther.value) {
    return `${currentPageLockHint.value}，请切换到其他页面继续处理。`;
  }

  return "左键：框内 · 右键：框外 · 右键标记：删除 · ↑/↓：切换 · Space：编辑 · Enter：保存 · Shift+Enter：换行 · Esc：退出 · Ctrl+滚轮：缩放";
});

const currentPageTranslatedCount = computed(() => {
  return currentPageUnits.value.filter((projectUnit) => {
    return isUnitTranslated(projectUnit);
  }).length;
});

const currentPageProofreadCount = computed(() => {
  return currentPageUnits.value.filter((projectUnit) => {
    return isUnitProofread(projectUnit);
  }).length;
});

const pageInboxCount = computed(() => {
  return currentPageUnits.value.filter((u) => u.is_bubble).length;
});

const pageOutboxCount = computed(() => {
  return currentPageUnits.value.filter((u) => !u.is_bubble).length;
});

const pageUntranslatedCount = computed(() => {
  return currentPageUnits.value.filter((u) => {
    return !isUnitTranslated(u);
  }).length;
});

let currentImageResolveToken = 0;
let lastCollaborationFallbackAt = 0;

watch(
  projectRecord,
  (nextProjectRecord) => {
    if (!nextProjectRecord) {
      return;
    }

    localProjectsStore.setActiveProject(nextProjectRecord.id);

    const nextPageIndex = Math.max(
      0,
      Math.min(
        nextProjectRecord.last_page_index,
        nextProjectRecord.pages.length - 1,
      ),
    );

    currentPageIndex.value = Number.isFinite(nextPageIndex) ? nextPageIndex : 0;
  },
  { immediate: true },
);

watch(
  currentPageID,
  async () => {
    const nextPage = currentPageMeta.value;

    if (!nextPage) {
      currentPageUnits.value = [];
      selectedUnitID.value = null;
      editingUnitID.value = null;
      currentPageImageURL.value = null;
      await translatorCollaborationStore.disconnectProjectSession();
      return;
    }

    currentPageUnits.value = cloneUnits(
      await localProjectsStore.loadProjectPageUnits(
        projectID.value,
        nextPage.id,
      ),
    );
    selectedUnitID.value = currentPageUnits.value[0]?.id ?? null;
    editingUnitID.value = null;
    resetStageTransform();
    void syncCurrentPageCollaborationSession();

    imageLoading.value = true;
    const resolveToken = ++currentImageResolveToken;

    let resolvedURL: string | null = null;

    try {
      resolvedURL = await resolveLocalProjectImageURL(nextPage.image_source);
    } catch (err) {
      console.error("[translator] 图片解析失败:", nextPage.image_source, err);
    }

    if (resolveToken !== currentImageResolveToken) {
      return;
    }

    currentPageImageURL.value = resolvedURL;
    imageLoading.value = false;
  },
  { immediate: true },
);

watch(editorMode, (nextMode) => {
  activeTextField.value =
    nextMode === "proofread" ? "proofread_text" : "translated_text";

  if (!selectedUnitID.value) {
    void syncCurrentPageLockMode();
    return;
  }

  focusActiveFieldLater(
    Boolean(resolveSelectedTextareaTarget(document.activeElement)),
  );
  void syncCurrentPageLockMode();
});

watch(currentPageSnapshot, (nextSnapshot) => {
  if (!nextSnapshot) {
    return;
  }

  if (
    nextSnapshot.updated_by_user_id === currentUserProfile.value?.id &&
    hasCurrentPageLock.value
  ) {
    return;
  }

  applyIncomingPageSnapshot(nextSnapshot);
});

watch(isCurrentPageLockedByOther, (lockedByOther) => {
  if (!lockedByOther) {
    return;
  }

  resolveActiveFieldElement()?.blur();
  editingUnitID.value = null;
});

/**
 * 复制一份 unit 列表，避免直接修改 store 内部对象引用。
 */
function cloneUnits(units: LocalProjectUnit[]): LocalProjectUnit[] {
  return units.map((projectUnit) => ({
    ...projectUnit,
  }));
}

/**
 * 生成用于本地协作的“最近编辑信息”。
 */
function buildTouchedUnit(
  projectUnit: LocalProjectUnit,
  patch: Partial<LocalProjectUnit>,
): LocalProjectUnit {
  return {
    ...projectUnit,
    ...patch,
    revision: Math.max(projectUnit.revision ?? 1, 1) + 1,
    last_edited_by: currentUserDisplayName.value,
    last_edited_at: Date.now(),
  };
}

/**
 * 统一应用远端页面快照，并同步回本地持久化层。
 */
function applyIncomingPageSnapshot(snapshot: TranslatorPageSnapshot): void {
  if (
    !projectRecord.value ||
    !currentPageMeta.value ||
    snapshot.page_key !== currentPageCollaborationKey.value
  ) {
    return;
  }

  const nextUnits = cloneUnits(snapshot.units);
  currentPageUnits.value = nextUnits;

  localProjectsStore.replacePageUnits(
    projectRecord.value.id,
    currentPageMeta.value.id,
    nextUnits,
  );

  if (
    selectedUnitID.value &&
    !nextUnits.some((projectUnit) => projectUnit.id === selectedUnitID.value)
  ) {
    selectedUnitID.value = nextUnits[0]?.id ?? null;
  }

  if (
    editingUnitID.value &&
    !nextUnits.some((projectUnit) => projectUnit.id === editingUnitID.value)
  ) {
    editingUnitID.value = null;
  }

  focusActiveFieldLater(false);
}

function handlePageSelectChange(nextPageIndex: number): void {
  moveToPage(Number(nextPageIndex));
}

function notifyCollaborationFallback(messageText: string): void {
  const now = Date.now();
  if (now - lastCollaborationFallbackAt < 2500) {
    return;
  }

  lastCollaborationFallbackAt = now;
  message.warning(messageText);
}

async function syncCurrentPageCollaborationSession(): Promise<void> {
  if (!projectRecord.value || !currentPageMeta.value) {
    await translatorCollaborationStore.disconnectProjectSession();
    return;
  }

  if (!authStore.isLoggedIn || !currentUserProfile.value?.id) {
    await translatorCollaborationStore.disconnectProjectSession();
    return;
  }

  try {
    await translatorCollaborationStore.connectProjectSession({
      project_key: projectCollaborationKey.value,
      user_id: currentUserProfile.value.id,
      display_name: currentUserDisplayName.value,
      avatar_url: currentUserAvatarURL.value || undefined,
    });

    const remoteSnapshot = await translatorCollaborationStore.openPage({
      project_key: projectCollaborationKey.value,
      page_key: currentPageCollaborationKey.value,
      page_index: currentPageMeta.value.index,
      page_name: currentPageMeta.value.name,
      units: currentPageUnits.value,
    });

    if (remoteSnapshot) {
      applyIncomingPageSnapshot(remoteSnapshot);
    }
  } catch (error) {
    console.error("[translator] 实时协作连接失败:", error);
    notifyCollaborationFallback("实时协作连接失败，当前继续使用本地编辑");
  }
}

async function syncCurrentPageLockMode(): Promise<void> {
  try {
    await translatorCollaborationStore.updateActiveMode(editorMode.value);
  } catch (error) {
    console.error("[translator] 页面锁模式同步失败:", error);
  }
}

async function ensureCurrentPageEditLock(
  mode: TranslatorMode,
): Promise<boolean> {
  if (!authStore.isLoggedIn || !currentUserProfile.value?.id) {
    return true;
  }

  if (isCurrentPageLockedByOther.value) {
    message.warning(currentPageLockHint.value);
    return false;
  }

  if (hasCurrentPageLock.value) {
    if (currentPageEditor.value?.mode !== mode) {
      await syncCurrentPageLockMode();
    }

    return true;
  }

  try {
    if (!isCollaborationConnected.value) {
      await syncCurrentPageCollaborationSession();
    }

    isAcquiringPageLock.value = true;
    const acquired =
      await translatorCollaborationStore.tryAcquirePageLock(mode);

    if (!acquired) {
      message.warning(currentPageLockHint.value);
    }

    return acquired;
  } catch (error) {
    console.error("[translator] 获取页面锁失败:", error);
    notifyCollaborationFallback("协作服务暂不可用，当前退回本地编辑");
    return true;
  } finally {
    isAcquiringPageLock.value = false;
  }
}

/**
 * 生成本地 unit ID。
 */
function createUnitID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `unit_${crypto.randomUUID()}`;
  }

  return `unit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 判断文本是否有内容。
 */
function hasTextContent(rawText: string | undefined): boolean {
  return typeof rawText === "string" && rawText.trim().length > 0;
}

function isUnitTranslated(projectUnit: LocalProjectUnit): boolean {
  return (
    hasTextContent(projectUnit.translated_text) ||
    hasTextContent(projectUnit.proofread_text)
  );
}

function isUnitProofread(projectUnit: LocalProjectUnit): boolean {
  return projectUnit.is_proofread || hasTextContent(projectUnit.proofread_text);
}

/**
 * 将当前页草稿同步回 store，并更新项目统计。
 */
function persistCurrentPageUnits(nextUnits: LocalProjectUnit[]): void {
  if (!projectRecord.value || !currentPageMeta.value) {
    return;
  }

  currentPageUnits.value = nextUnits.map((projectUnit, index) => ({
    ...projectUnit,
    index: index + 1,
  }));

  localProjectsStore.replacePageUnits(
    projectRecord.value.id,
    currentPageMeta.value.id,
    currentPageUnits.value,
  );

  translatorCollaborationStore.schedulePageSnapshotSync(currentPageUnits.value);
}

/**
 * 图片加载失败回调。
 */
function handleImageError(): void {
  imageLoading.value = false;
  currentPageImageURL.value = null;
}

/**
 * 切换翻译/校对模式。
 */
function toggleEditorMode(): void {
  editorMode.value =
    editorMode.value === "translate" ? "proofread" : "translate";
  message.success(
    editorMode.value === "translate" ? "已切换到翻译模式" : "已切换到校对模式",
  );
}

/**
 * 返回指定页。
 */
function handleReturnToWorkspace(): void {
  if (projectRecord.value) {
    localProjectsStore.updateLastPageIndex(
      projectRecord.value.id,
      currentPageIndex.value,
    );
  }

  void translatorCollaborationStore.disconnectProjectSession();

  void router.push("/workspace");
}

/**
 * 切换到指定页。
 */
function moveToPage(nextPageIndex: number): void {
  if (!projectRecord.value) {
    return;
  }

  const clampedIndex = Math.max(
    0,
    Math.min(nextPageIndex, projectRecord.value.pages.length - 1),
  );

  currentPageIndex.value = clampedIndex;
  localProjectsStore.updateLastPageIndex(projectRecord.value.id, clampedIndex);
}

function moveToPreviousPage(): void {
  moveToPage(currentPageIndex.value - 1);
}

function moveToNextPage(): void {
  moveToPage(currentPageIndex.value + 1);
}

/**
 * 根据点击位置在画布上创建新标记。
 */
async function createUnitAtPointer(
  event: MouseEvent,
  isBubble: boolean,
): Promise<void> {
  if (!currentPageCanMutateStructure.value) {
    message.warning(currentPageLockHint.value);
    return;
  }

  if (!(await ensureCurrentPageEditLock("translate"))) {
    return;
  }

  const overlayElement = stageOverlayRef.value;

  if (!overlayElement) {
    return;
  }

  const overlayRect = overlayElement.getBoundingClientRect();
  const normalizedX = (event.clientX - overlayRect.left) / overlayRect.width;
  const normalizedY = (event.clientY - overlayRect.top) / overlayRect.height;

  const newUnit: LocalProjectUnit = {
    id: createUnitID(),
    index: currentPageUnits.value.length + 1,
    x_coord: Math.max(0, Math.min(1, normalizedX)),
    y_coord: Math.max(0, Math.min(1, normalizedY)),
    ...getDefaultLocalProjectUnitBoxSize(isBubble),
    is_bubble: isBubble,
    is_proofread: false,
    translated_text: "",
    proofread_text: "",
    translator_comment: "",
    proofreader_comment: "",
    revision: 1,
    last_edited_by: currentUserDisplayName.value,
    last_edited_at: Date.now(),
  };

  persistCurrentPageUnits([...currentPageUnits.value, newUnit]);
  selectedUnitID.value = newUnit.id;
  focusActiveFieldLater();
}

function clearSelectedUnit(): void {
  editingUnitID.value = null;
  selectedUnitID.value = null;
}

function resolveFinalUnitText(projectUnit: LocalProjectUnit): string {
  if (hasTextContent(projectUnit.proofread_text)) {
    return projectUnit.proofread_text.trim();
  }

  if (hasTextContent(projectUnit.translated_text)) {
    return projectUnit.translated_text.trim();
  }

  return "";
}

function resolveProofreadBubbleStyle(
  projectUnit: LocalProjectUnit,
): Record<string, string> {
  return {
    left: `${projectUnit.x_coord * 100}%`,
    top: `${projectUnit.y_coord * 100}%`,
    transform: "translate(-50%, calc(-100% - 20px))",
  };
}

function handleOverlayClick(event: MouseEvent): void {
  if (stageDragMoved || markerDragMoved) return;

  if (selectedUnitID.value) {
    clearSelectedUnit();
    return;
  }

  void createUnitAtPointer(event, true);
}

function handleOverlayContextMenu(event: MouseEvent): void {
  if (stageDragMoved || markerDragMoved) return;

  if (selectedUnitID.value) {
    clearSelectedUnit();
    return;
  }

  void createUnitAtPointer(event, false);
}

/**
 * 选中指定标记。
 */
function handleSelectUnit(unitID: string, shouldFocus = true): void {
  selectedUnitID.value = unitID;
  editingUnitID.value = null;
  focusActiveFieldLater(shouldFocus);
}

/**
 * 更新选中标记的任意字段。
 */
function updateSelectedUnitField(
  field: EditableFieldKey,
  nextValue: string,
): void {
  if (!selectedUnit.value) {
    return;
  }

  const nextUnits = currentPageUnits.value.map((projectUnit) => {
    if (projectUnit.id !== selectedUnit.value?.id) {
      return projectUnit;
    }

    return buildTouchedUnit(projectUnit, {
      [field]: nextValue,
    } as Partial<LocalProjectUnit>);
  });

  persistCurrentPageUnits(nextUnits);
}

/**
 * 处理编辑器输入。
 */
function handleTextFieldInput(field: EditableFieldKey, event: Event): void {
  const target = event.target as HTMLTextAreaElement;
  updateSelectedUnitField(field, target.value);
  target.style.height = "auto";
  target.style.height = `${target.scrollHeight}px`;
}

/**
 * 清空选中标记的指定字段。
 */
async function clearFieldValue(field: EditableFieldKey): Promise<void> {
  const requiredMode = field === "proofread_text" ? "proofread" : "translate";
  if (!(await ensureCurrentPageEditLock(requiredMode))) {
    return;
  }

  updateSelectedUnitField(field, "");
  focusActiveFieldLater();
}

async function handleUnitFieldFocus(
  field: EditableFieldKey,
  event: FocusEvent,
): Promise<void> {
  activeTextField.value = field;

  const requiredMode = field === "proofread_text" ? "proofread" : "translate";
  if (editorMode.value !== requiredMode) {
    return;
  }

  if (!(await ensureCurrentPageEditLock(requiredMode))) {
    (event.target as HTMLTextAreaElement | null)?.blur();
    return;
  }

  editingUnitID.value = selectedUnitID.value;
}

function handleUnitFieldBlur(): void {
  window.requestAnimationFrame(() => {
    editingUnitID.value = resolveSelectedTextareaTarget(document.activeElement)
      ? selectedUnitID.value
      : null;
  });
}

function canDirectPassProofread(projectUnit: LocalProjectUnit): boolean {
  return (
    editorMode.value === "proofread" &&
    hasTextContent(projectUnit.translated_text) &&
    !isUnitProofread(projectUnit)
  );
}

function resolveProofreadActionText(projectUnit: LocalProjectUnit): string {
  if (canDirectPassProofread(projectUnit)) {
    return "过";
  }

  return "✓";
}

function resolveProofreadActionTitle(projectUnit: LocalProjectUnit): string {
  if (projectUnit.is_proofread) {
    return "取消校对";
  }

  if (hasTextContent(projectUnit.proofread_text)) {
    return "已有校对内容";
  }

  if (canDirectPassProofread(projectUnit)) {
    return "直接通过校对";
  }

  return "标记已校对";
}

/**
 * 切换框内/框外。
 */
async function toggleSelectedUnitBubble(): Promise<void> {
  if (!selectedUnit.value) {
    return;
  }

  if (!currentPageCanMutateStructure.value) {
    message.warning(currentPageLockHint.value);
    return;
  }

  if (!(await ensureCurrentPageEditLock("translate"))) {
    return;
  }

  const nextUnits = currentPageUnits.value.map((projectUnit) => {
    if (projectUnit.id !== selectedUnit.value?.id) {
      return projectUnit;
    }

    return buildTouchedUnit(projectUnit, {
      is_bubble: !projectUnit.is_bubble,
    });
  });

  persistCurrentPageUnits(nextUnits);
}

/**
 * 切换校对状态。
 */
async function toggleSelectedUnitProofread(): Promise<void> {
  if (!selectedUnit.value) {
    return;
  }

  if (!canToggleProofreadAction.value) {
    message.warning(currentPageLockHint.value);
    return;
  }

  if (!(await ensureCurrentPageEditLock("proofread"))) {
    return;
  }

  const nextUnits = currentPageUnits.value.map((projectUnit) => {
    if (projectUnit.id !== selectedUnit.value?.id) {
      return projectUnit;
    }

    return buildTouchedUnit(projectUnit, {
      is_proofread: !projectUnit.is_proofread,
    });
  });

  persistCurrentPageUnits(nextUnits);
}

/**
 * 删除指定标记。
 */
async function requestRemoveUnit(unitID: string): Promise<void> {
  if (!currentPageCanMutateStructure.value) {
    message.warning(currentPageLockHint.value);
    return;
  }

  if (!(await ensureCurrentPageEditLock("translate"))) {
    return;
  }

  const targetUnit = currentPageUnits.value.find(
    (projectUnit) => projectUnit.id === unitID,
  );

  if (!targetUnit) {
    return;
  }

  const performRemove = (): void => {
    const nextUnits = currentPageUnits.value.filter(
      (projectUnit) => projectUnit.id !== unitID,
    );
    persistCurrentPageUnits(nextUnits);

    if (selectedUnitID.value === unitID) {
      selectedUnitID.value = nextUnits[0]?.id ?? null;
    }

    message.success("标记已删除");
  };

  if (
    hasTextContent(targetUnit.translated_text) ||
    hasTextContent(targetUnit.proofread_text) ||
    hasTextContent(targetUnit.translator_comment) ||
    hasTextContent(targetUnit.proofreader_comment)
  ) {
    Modal.confirm({
      title: "删除标记",
      content: "该标记已经填写过内容，确认删除吗？",
      okText: "确认删除",
      cancelText: "取消",
      onOk() {
        performRemove();
      },
    });
    return;
  }

  performRemove();
}

/**
 * 计算标记按钮位置。
 */
function resolveMarkerStyle(
  projectUnit: LocalProjectUnit,
): Record<string, string> {
  return {
    left: `${projectUnit.x_coord * 100}%`,
    top: `${projectUnit.y_coord * 100}%`,
  };
}

/**
 * 返回当前激活字段对应的文本框元素。
 */
function resolveActiveFieldElement(): HTMLTextAreaElement | null {
  return document.querySelector(
    `.translator-unit-card.is-active textarea[data-field="${activeTextField.value}"]`,
  ) as HTMLTextAreaElement | null;
}

function resolveSelectedUnitCardElement(): HTMLElement | null {
  return document.querySelector(
    ".translator-unit-card.is-active",
  ) as HTMLElement | null;
}

function resolveSelectedTextareaTarget(
  target: EventTarget | null,
): HTMLTextAreaElement | null {
  const element = target as HTMLElement | null;

  if (!(element instanceof HTMLTextAreaElement)) {
    return null;
  }

  return element.closest(".translator-unit-card.is-active") ? element : null;
}

function isEditableFieldKey(
  field: string | undefined,
): field is EditableFieldKey {
  return field === "translated_text" || field === "proofread_text";
}

function isShortcutBlockedTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;

  if (!element) {
    return false;
  }

  if (isTypingTarget(target)) {
    return true;
  }

  return Boolean(element.closest("button, a, [role='button'], .ant-btn"));
}

function syncTextareaDraft(textareaElement: HTMLTextAreaElement | null): void {
  if (!textareaElement || !selectedUnit.value) {
    return;
  }

  const field = textareaElement.dataset.field;

  if (!isEditableFieldKey(field)) {
    return;
  }

  const nextValue = textareaElement.value;

  if (nextValue === selectedUnit.value[field]) {
    return;
  }

  updateSelectedUnitField(field, nextValue);
}

function commitSelectedUnitEditing(
  eventTarget?: EventTarget | null,
  shouldClearSelection = false,
): void {
  if (!selectedUnitID.value) {
    return;
  }

  const activeCard = resolveSelectedUnitCardElement();

  activeCard
    ?.querySelectorAll<HTMLTextAreaElement>("textarea[data-field]")
    .forEach((textareaElement) => {
      syncTextareaDraft(textareaElement);
    });

  const targetElement = eventTarget as HTMLElement | null;

  if (targetElement && activeCard?.contains(targetElement)) {
    targetElement.blur();
  } else {
    resolveActiveFieldElement()?.blur();
  }

  editingUnitID.value = null;

  if (shouldClearSelection) {
    clearSelectedUnit();
  }
}

function exitSelectedUnitEditing(eventTarget?: EventTarget | null): void {
  commitSelectedUnitEditing(eventTarget, true);
}

/**
 * 切换选中标记后，让当前模式对应的文本框自动聚焦。
 */
function focusActiveFieldLater(shouldFocus = true): void {
  void nextTick(() => {
    window.requestAnimationFrame(() => {
      const activeCard = resolveSelectedUnitCardElement();

      activeCard
        ?.querySelectorAll<HTMLTextAreaElement>("textarea")
        .forEach((textareaElement) => {
          textareaElement.style.height = "auto";
          textareaElement.style.height = `${textareaElement.scrollHeight}px`;
        });

      if (shouldFocus && isCurrentFieldEditable.value) {
        resolveActiveFieldElement()?.focus();
      }

      activeCard?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  });
}

/**
 * 向当前激活文本框插入快捷符号。
 */
async function insertQuickSymbol(symbolValue: string): Promise<void> {
  if (!selectedUnit.value) {
    return;
  }

  const requiredMode =
    activeTextField.value === "proofread_text" ? "proofread" : "translate";
  if (!(await ensureCurrentPageEditLock(requiredMode))) {
    return;
  }

  const targetElement = resolveActiveFieldElement();
  const currentValue = selectedUnit.value[activeTextField.value];

  if (!targetElement) {
    updateSelectedUnitField(
      activeTextField.value,
      `${currentValue}${symbolValue}`,
    );
    return;
  }

  const selectionStart = targetElement.selectionStart ?? currentValue.length;
  const selectionEnd = targetElement.selectionEnd ?? currentValue.length;
  const nextValue = `${currentValue.slice(0, selectionStart)}${symbolValue}${currentValue.slice(selectionEnd)}`;

  updateSelectedUnitField(activeTextField.value, nextValue);

  window.requestAnimationFrame(() => {
    targetElement.focus();
    const nextCaretPosition = selectionStart + symbolValue.length;
    targetElement.setSelectionRange(nextCaretPosition, nextCaretPosition);
  });
}

/**
 * 循环切换标记。
 */
function moveSelectedUnit(direction: 1 | -1): void {
  if (currentPageUnits.value.length === 0) {
    return;
  }

  const currentIndex = currentPageUnits.value.findIndex((projectUnit) => {
    return projectUnit.id === selectedUnitID.value;
  });

  if (currentIndex < 0) {
    const fallbackIndex =
      direction === -1 ? currentPageUnits.value.length - 1 : 0;

    selectedUnitID.value = currentPageUnits.value[fallbackIndex].id;
    editingUnitID.value = null;
    focusActiveFieldLater(false);
    return;
  }

  const nextIndex =
    (currentIndex + direction + currentPageUnits.value.length) %
    currentPageUnits.value.length;

  selectedUnitID.value = currentPageUnits.value[nextIndex].id;
  editingUnitID.value = null;
  focusActiveFieldLater(false);
}

/* ── 图片缩放 & 平移 ── */
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 5;

const zoomDisplayText = computed(() => {
  return Math.round(stageScale.value * 100) + "%";
});

function handleStageWheel(event: WheelEvent): void {
  if (!event.ctrlKey) return;
  event.preventDefault();

  const stageEl = (event.currentTarget as HTMLElement) ?? null;
  if (!stageEl) return;

  const rect = stageEl.getBoundingClientRect();
  const cursorX = event.clientX - rect.left - rect.width / 2;
  const cursorY = event.clientY - rect.top - rect.height / 2;

  const prevScale = stageScale.value;
  const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
  const nextScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prevScale * factor));
  const ratio = 1 - nextScale / prevScale;

  stagePanX.value += (cursorX - stagePanX.value) * ratio;
  stagePanY.value += (cursorY - stagePanY.value) * ratio;
  stageScale.value = nextScale;
}

function handleStageDragStart(event: MouseEvent): void {
  if (event.button !== 0) return;
  event.preventDefault();
  isDragging.value = true;
  stageDragMoved = false;
  dragLastX = event.clientX;
  dragLastY = event.clientY;
}

function handleStageDragMove(event: MouseEvent): void {
  if (draggingUnitID.value) {
    handleMarkerDragMove(event);
    return;
  }
  if (!isDragging.value) return;
  const dx = event.clientX - dragLastX;
  const dy = event.clientY - dragLastY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    stageDragMoved = true;
  }
  stagePanX.value += dx;
  stagePanY.value += dy;
  dragLastX = event.clientX;
  dragLastY = event.clientY;
}

function handleStageDragEnd(event?: MouseEvent): void {
  if (draggingUnitID.value) {
    handleMarkerDragEnd(event);
    return;
  }
  isDragging.value = false;
}

function handleGlobalMouseMove(event: MouseEvent): void {
  if (draggingUnitID.value) {
    event.preventDefault();
    handleMarkerDragMove(event);
    return;
  }

  if (!isDragging.value) {
    return;
  }

  event.preventDefault();
  handleStageDragMove(event);
}

function handleGlobalMouseUp(event: MouseEvent): void {
  if (draggingUnitID.value) {
    handleMarkerDragEnd(event);
  }

  if (isDragging.value) {
    handleStageDragEnd(event);
  }
}

/* ── 标记拖拽 ── */
function handleMarkerDragStart(event: MouseEvent, unitID: string): void {
  if (!currentPageCanMutateStructure.value) {
    message.warning(currentPageLockHint.value);
    return;
  }

  const unit = currentPageUnits.value.find((u) => u.id === unitID);
  if (!unit) return;

  void (async () => {
    if (!(await ensureCurrentPageEditLock("translate"))) {
      return;
    }

    draggingUnitID.value = unitID;
    markerDragStartX = event.clientX;
    markerDragStartY = event.clientY;
    markerDragOrigX = unit.x_coord;
    markerDragOrigY = unit.y_coord;
    markerDragMoved = false;
    event.preventDefault();
  })();
}

function handleMarkerDragMove(event: MouseEvent): void {
  if (!draggingUnitID.value) return;
  const overlayEl = stageOverlayRef.value;
  if (!overlayEl) return;

  const dx = event.clientX - markerDragStartX;
  const dy = event.clientY - markerDragStartY;
  if (!markerDragMoved && Math.abs(dx) + Math.abs(dy) < 4) return;
  markerDragMoved = true;

  const overlayRect = overlayEl.getBoundingClientRect();
  const nextX = markerDragOrigX + dx / overlayRect.width;
  const nextY = markerDragOrigY + dy / overlayRect.height;

  const nextUnits = currentPageUnits.value.map((u) => {
    if (u.id !== draggingUnitID.value) return u;
    return buildTouchedUnit(u, {
      x_coord: Math.max(0, Math.min(1, nextX)),
      y_coord: Math.max(0, Math.min(1, nextY)),
    });
  });
  persistCurrentPageUnits(nextUnits);
}

function handleMarkerDragEnd(event?: MouseEvent): void {
  if (!draggingUnitID.value) return;
  const unitID = draggingUnitID.value;
  const didMove = markerDragMoved;
  draggingUnitID.value = null;
  if (!didMove && event) {
    handleSelectUnit(unitID);
  }
}

function resetStageTransform(): void {
  stageScale.value = 1;
  stagePanX.value = 0;
  stagePanY.value = 0;
}

function handleGlobalKeyup(): void {
  // 保留事件监听接口以备后续扩展
}

function syncDarkThemeState(): void {
  isDarkTheme.value = document.documentElement.dataset.theme === "dark";
}

async function syncCurrentUserProfile(): Promise<void> {
  if (!authStore.isLoggedIn) {
    currentUserProfile.value = null;
    await translatorCollaborationStore.disconnectProjectSession();
    return;
  }

  try {
    currentUserProfile.value = await getCurrentUserProfile();
  } catch {
    currentUserProfile.value = null;
  }

  await syncCurrentPageCollaborationSession();
}

/**
 * 判断当前按键是否发生在输入控件中。
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;

  if (!element) {
    return false;
  }

  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable
  );
}

/**
 * 全局快捷键处理。
 */
function handleGlobalKeydown(event: KeyboardEvent): void {
  if (!projectRecord.value) {
    return;
  }

  if (event.isComposing) {
    return;
  }

  const selectedTextareaTarget = resolveSelectedTextareaTarget(event.target);
  const isShortcutBlocked = isShortcutBlockedTarget(event.target);

  if (event.key === "Escape" && selectedUnitID.value) {
    if (document.querySelector(".ant-modal-root .ant-modal-wrap")) {
      return;
    }

    event.preventDefault();
    exitSelectedUnitEditing(event.target);
    return;
  }

  if (event.key === "Enter" && selectedTextareaTarget && !event.shiftKey) {
    event.preventDefault();
    commitSelectedUnitEditing(event.target);
    return;
  }

  if (event.key === "F1" || event.key === "PageUp") {
    event.preventDefault();
    moveToPreviousPage();
    return;
  }

  if (event.key === "F2" || event.key === "PageDown") {
    event.preventDefault();
    moveToNextPage();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "m") {
    event.preventDefault();
    editorMode.value =
      editorMode.value === "translate" ? "proofread" : "translate";
    message.success(
      editorMode.value === "translate"
        ? "已切换到翻译模式"
        : "已切换到校对模式",
    );
    return;
  }

  if (
    (event.key === "ArrowUp" || event.key === "ArrowDown") &&
    !isShortcutBlocked
  ) {
    event.preventDefault();
    moveSelectedUnit(event.key === "ArrowUp" ? -1 : 1);
    return;
  }

  if (
    (event.key === " " || event.code === "Space") &&
    selectedUnitID.value &&
    !isShortcutBlocked
  ) {
    event.preventDefault();
    focusActiveFieldLater();
    return;
  }

  if (event.key === "Tab" && !isShortcutBlocked) {
    event.preventDefault();
    moveSelectedUnit(event.shiftKey ? -1 : 1);
    return;
  }

  if (event.key === "Delete" && !isShortcutBlocked && selectedUnitID.value) {
    event.preventDefault();
    void requestRemoveUnit(selectedUnitID.value);
    return;
  }

  if (event.ctrlKey && event.key === "0") {
    event.preventDefault();
    resetStageTransform();
  }
}

onMounted(() => {
  syncDarkThemeState();
  void syncCurrentUserProfile();

  window.addEventListener("keydown", handleGlobalKeydown);
  window.addEventListener("keyup", handleGlobalKeyup);
  window.addEventListener("mousemove", handleGlobalMouseMove);
  window.addEventListener("mouseup", handleGlobalMouseUp);

  themeObserver = new MutationObserver(() => {
    syncDarkThemeState();
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
});

watch(
  () => authStore.isLoggedIn,
  () => {
    void syncCurrentUserProfile();
  },
  { immediate: false },
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  window.removeEventListener("keyup", handleGlobalKeyup);
  window.removeEventListener("mousemove", handleGlobalMouseMove);
  window.removeEventListener("mouseup", handleGlobalMouseUp);

  themeObserver?.disconnect();
  themeObserver = null;
  void translatorCollaborationStore.disconnectProjectSession();
});
</script>

<style scoped lang="scss">
.translator-layout {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface, #f6f8fa);
  overflow: hidden;
}

.translator-layout.is-global-dragging,
.translator-layout.is-global-dragging * {
  user-select: none;
}

/* ── 顶栏 ── */
.translator-header {
  height: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--panel-border, #e5e7eb);
  background: color-mix(
    in srgb,
    var(--dashboard-header-bg, #fff) 92%,
    transparent
  );
  backdrop-filter: blur(14px);
}

.translator-header__left,
.translator-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.translator-header__back {
  color: var(--text-primary, #374151);
  font-size: 13px;
}

.translator-header__title {
  color: var(--text-primary, #374151);
  font-size: 16px;
  font-weight: 600;
}

.translator-header__page-select {
  min-width: 220px;
}

:deep(.translator-header__page-select .ant-select-selector) {
  height: 28px !important;
  border-radius: 8px !important;
  border-color: var(--panel-border, #e5e7eb) !important;
  background: color-mix(
    in srgb,
    var(--surface, #fff) 74%,
    transparent
  ) !important;
  box-shadow: none !important;
}

:deep(.translator-header__page-select .ant-select-selection-item),
:deep(.translator-header__page-select .ant-select-selection-placeholder) {
  line-height: 26px !important;
  font-size: 13px;
}

.translator-header__page-total {
  color: var(--text-muted, #6b7280);
  font-size: 13px;
  font-weight: 500;
}

.translator-header__page-status {
  max-width: 240px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.12);
  color: #166534;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.translator-header__page-status.is-readonly {
  background: rgba(251, 146, 60, 0.14);
  color: #c2410c;
}

/* ── 主体 ── */
.translator-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 0;
  overflow: hidden;
}

/* ── 图片区域（含浮动统计） ── */
.translator-stage-area {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: color-mix(
    in srgb,
    var(--workspace-glass-bg, #e5e7eb) 78%,
    transparent
  );
}

/* 浮动统计面板 — 匹配参考 UnitStatsBar */
.translator-stats-overlay {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 120;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-bg, #fff) 72%, transparent);
  backdrop-filter: blur(12px);
  border: 1px solid
    color-mix(in srgb, var(--panel-border, #94a3b8) 18%, transparent);
  box-shadow: 0 6px 12px rgba(15, 23, 42, 0.1);
  pointer-events: auto;
  user-select: none;
}

.translator-stats-overlay.is-pass-through {
  pointer-events: none;
}

.translator-stats-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  gap: 12px;
}

.translator-stats-text {
  font-weight: 600;
  white-space: nowrap;
}

.translator-stats-count {
  font-weight: 700;
  min-width: 20px;
  text-align: right;
  font-size: 0.78rem;
}

.translator-stats-divider {
  width: 100%;
  height: 2px;
  background: color-mix(in srgb, var(--panel-border, #091b35) 16%, transparent);
  margin: 2px 0;
  border-radius: 1px;
}

.stats-badge--pink {
  background: rgba(255, 241, 242, 0.7);
  color: #9f1239;
}

.stats-badge--yellow {
  background: rgba(255, 251, 235, 0.7);
  color: #92400e;
}

.stats-badge--gray {
  background: color-mix(in srgb, var(--surface, #f4f4f5) 60%, transparent);
  color: var(--text-primary, #374151);
}

.stats-badge--orange {
  background: rgba(255, 247, 237, 0.7);
  color: #b45309;
}

.stats-badge--green {
  background: rgba(240, 253, 244, 0.7);
  color: #166534;
}

/* ── 图片 + 标记 ── */
.translator-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 16px;
  position: relative;
}

.translator-stage.is-panning {
  cursor: grabbing;
}

.translator-stage__media {
  position: relative;
  display: inline-block;
  max-width: 100%;
  will-change: transform;
  transition: transform 0.05s linear;
}

.translator-stage__image {
  display: block;
  max-width: min(100%, 1200px);
  max-height: calc(100vh - 140px);
  border-radius: 4px;
  box-shadow: 0 8px 24px rgba(13, 22, 40, 0.12);
  user-select: none;
  -webkit-user-drag: none;
}

.translator-stage__overlay {
  position: absolute;
  inset: 0;
  cursor: default;
}

.translator-stage__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #9ca3af);
  font-size: 14px;
}

.translator-proofread-bubble {
  position: absolute;
  min-width: 24px;
  max-width: min(150px, 17vw);
  padding: 4px 6px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.92);
  background: rgba(255, 255, 255, 0.96);
  color: #111827;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow:
    0 6px 14px rgba(15, 23, 42, 0.12),
    0 1px 4px rgba(15, 23, 42, 0.08);
  pointer-events: none;
  z-index: 32;
}

.translator-proofread-bubble::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -5px;
  width: 8px;
  height: 8px;
  border-right: 1px solid rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid rgba(255, 255, 255, 0.92);
  background: inherit;
  transform: translateX(-50%) rotate(45deg);
}

.translator-proofread-bubble.is-outbox {
  border-radius: 8px;
  background: rgba(255, 251, 235, 0.96);
  color: #7c2d12;
}

.translator-proofread-bubble.is-dark {
  border-color: rgba(75, 85, 99, 0.92);
  background: rgba(31, 41, 55, 0.96);
  color: #f9fafb;
}

.translator-proofread-bubble.is-dark::after {
  border-right-color: rgba(75, 85, 99, 0.92);
  border-bottom-color: rgba(75, 85, 99, 0.92);
}

.translator-proofread-bubble.is-dark.is-outbox {
  background: rgba(55, 65, 81, 0.96);
  color: #f9fafb;
}

.translator-proofread-bubble.is-active {
  box-shadow:
    0 8px 18px rgba(59, 130, 246, 0.15),
    0 0 0 2px rgba(59, 130, 246, 0.16);
}

/* ── 标记圆点 — 匹配参考 Marker 样式 ── */
.translator-marker {
  position: absolute;
  left: 0;
  top: 0;
  width: 28px;
  height: 28px;
  margin-left: -14px;
  margin-top: -14px;
  border: 2.5px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  background: linear-gradient(135deg, #f9a8d4, #f472b6);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  z-index: 10;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  user-select: none;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

.translator-marker.is-outbox {
  background: linear-gradient(135deg, #fde047, #facc15);
}

/* 状态描边：已翻译 → 橙色 */
.translator-marker.is-translated {
  border-color: #fb923c;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.25),
    0 0 0 2px rgba(251, 146, 60, 0.3);
}

/* 状态描边：已校对 → 绿色 */
.translator-marker.is-proofread {
  border-color: #4ade80;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.25),
    0 0 0 2px rgba(74, 222, 128, 0.3);
}

.translator-marker:hover {
  transform: scale(1.18);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.4),
    0 0 0 3px rgba(255, 255, 255, 0.3);
  z-index: 20;
}

.translator-marker.is-active {
  border-color: var(--control-btn-primary-border, #9b73f2);
  transform: scale(1.08);
  box-shadow:
    0 4px 12px
      color-mix(
        in srgb,
        var(--control-btn-primary-border, #9b73f2) 45%,
        transparent
      ),
    0 0 0 2px
      color-mix(
        in srgb,
        var(--control-btn-primary-border, #9b73f2) 24%,
        transparent
      );
  z-index: 30;
}

.translator-marker.is-editing {
  border-color: #22c55e;
  transform: scale(1.08);
  box-shadow:
    0 4px 12px rgba(34, 197, 94, 0.32),
    0 0 0 2px rgba(34, 197, 94, 0.18);
  z-index: 31;
}

.translator-marker.is-dragging {
  opacity: 0.8;
  z-index: 40;
  cursor: grabbing;
  transition: none;
}

/* ── 右侧面板 ── */
.translator-right-panel {
  width: 440px;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--panel-border, #e5e7eb);
  background: color-mix(in srgb, var(--panel-bg, #fff) 92%, transparent);
  backdrop-filter: blur(16px);
  overflow: hidden;
}

/* ── 卡片列表 ── */
.translator-unit-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 12px;
  gap: 4px;
}

.translator-unit-list::-webkit-scrollbar {
  width: 6px;
}

.translator-unit-list::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--panel-border, #e5e7eb) 80%, transparent);
  border-radius: 10px;
}

.translator-unit-list__empty {
  padding: 32px 20px;
  text-align: center;
  color: var(--text-muted, #9ca3af);
  font-size: 13px;
}

/* ── 单元卡片 ── */
.translator-unit-card {
  display: flex;
  align-items: stretch;
  position: relative;
  border: 1px solid var(--panel-border, #e5e7eb);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  background: color-mix(in srgb, var(--surface, #fff) 96%, transparent);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  flex-shrink: 0;
}

.translator-unit-card:hover {
  border-color: var(--control-btn-primary-border-hover, #8960ea);
  box-shadow: 0 0 0 1px
    color-mix(
      in srgb,
      var(--control-btn-primary-border-hover, #8960ea) 22%,
      transparent
    );
}

.translator-unit-card.is-active {
  border-color: var(--control-btn-primary-border, #9b73f2);
  box-shadow: 0 0 0 1px
    color-mix(
      in srgb,
      var(--control-btn-primary-border, #9b73f2) 28%,
      transparent
    );
}

.translator-unit-card.is-editing {
  border-color: #22c55e;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.24);
}

/* 序号列 */
.translator-unit-card__index {
  width: 42px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 6px 0;
  background: color-mix(in srgb, var(--surface, #fff) 100%, transparent);
  border-right: 1px solid rgba(0, 0, 0, 0.04);
}

.translator-unit-card__num {
  font-weight: 700;
  font-size: 0.8rem;
  color: var(--text-muted, #6b7280);
  line-height: 1;
}

.translator-unit-card__type-toggle {
  border: none;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  cursor: pointer;
  user-select: none;
  line-height: 1.3;
}

.translator-unit-card__type-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.translator-unit-card__type-toggle.is-inbox {
  background: #fee2e2;
  color: #991b1b;
}

.translator-unit-card__type-toggle.is-outbox {
  background: #fef3c7;
  color: #92400e;
}

/* 左侧彩色条 */
.translator-unit-card.is-inbox .translator-unit-card__index {
  box-shadow: inset 4px 0 0 0 #f9a8d4;
}

.translator-unit-card.is-outbox .translator-unit-card__index {
  box-shadow: inset 4px 0 0 0 #fde047;
}

/* 内容区 */
.translator-unit-card__body {
  flex: 1;
  min-width: 0;
  padding: 8px 42px 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.translator-unit-card__preview-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.translator-unit-card__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  flex-shrink: 0;
}

.translator-unit-card__section-identity {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.translator-unit-card__section-avatar {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.translator-unit-card__section-avatar {
  object-fit: cover;
  background: rgba(148, 163, 184, 0.16);
}

.translator-unit-card__section-avatar.is-translate {
  background: rgba(251, 146, 60, 0.14);
  color: #c2410c;
}

.translator-unit-card__section-avatar.is-proofread {
  background: rgba(34, 197, 94, 0.14);
  color: #15803d;
}

.translator-unit-card__section-label {
  color: var(--text-muted, #6b7280);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}

.translator-unit-card__section-name {
  min-width: 0;
  flex-shrink: 1;
  color: var(--text-primary, #374151);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.translator-unit-card__section-divider {
  width: 100%;
  height: 1px;
  margin: 2px 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-border, #e5e7eb) 80%, transparent);
}

/* 预览文本 */
.translator-unit-card__preview {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-primary, #374151);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.translator-unit-card__preview.is-muted {
  color: var(--text-muted, #9ca3af);
  font-style: italic;
}

.translator-unit-card__preview.is-placeholder {
  color: var(--text-muted, #9ca3af);
  font-weight: 400;
}

/* 差异对比：原译文 */
.translator-unit-card__preview.is-diff-origin {
  color: var(--text-muted, #9ca3af);
  font-weight: 400;
  font-size: 0.8rem;
  text-decoration: line-through;
  text-decoration-color: color-mix(
    in srgb,
    var(--text-muted, #9ca3af) 50%,
    transparent
  );
  opacity: 0.7;
}

/* 差异对比：校对文本 */
.translator-unit-card__preview.is-diff-result {
  color: #16a34a;
  font-weight: 600;
}

/* 内联编辑字段 */
.translator-unit-card__field {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}

.translator-unit-card__field-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.translator-unit-card__textarea {
  flex: 1;
  min-width: 0;
  resize: none;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--text-primary, #374151);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.6;
  padding: 2px 0;
  outline: none;
  overflow: hidden;
}

.translator-unit-card__textarea.is-readonly {
  color: var(--text-muted, #6b7280);
  cursor: not-allowed;
}

.translator-unit-card__textarea::placeholder {
  color: var(--text-muted, #9ca3af);
  font-weight: 400;
}

.translator-unit-card__field-btn {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  margin-top: 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted, #9ca3af);
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.translator-unit-card__field-btn:hover {
  background: color-mix(in srgb, var(--panel-border, #e5e7eb) 60%, transparent);
  color: var(--text-primary, #374151);
}

.translator-unit-card__field-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

/* 快捷符号 */
.translator-unit-card__symbols {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding-top: 4px;
  border-top: 1px dashed
    color-mix(in srgb, var(--panel-border, #e5e7eb) 60%, transparent);
}

.translator-unit-card__symbol-btn {
  min-width: 28px;
  height: 26px;
  border: 1px solid var(--panel-border, #e5e7eb);
  border-radius: 4px;
  background: var(--surface, #f3f4f6);
  color: var(--text-primary, #374151);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  padding: 2px 6px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition:
    background 0.1s,
    border 0.1s;
}

.translator-unit-card__symbol-btn:hover {
  background: color-mix(in srgb, var(--panel-border, #e5e7eb) 60%, transparent);
  border-color: color-mix(
    in srgb,
    var(--panel-border, #d1d5db) 80%,
    transparent
  );
}

.translator-unit-card__symbol-btn:active {
  background: var(--text-muted, #6b7280);
  color: #fff;
}

.translator-unit-card__symbol-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

/* 右侧操作列 */
.translator-unit-card__side {
  position: absolute;
  top: 8px;
  right: 8px;
  width: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 0;
  flex-shrink: 0;
  z-index: 2;
}

.translator-unit-card__side-btn {
  width: 22px;
  height: 22px;
  border: 1px solid
    color-mix(in srgb, var(--panel-border, #e5e7eb) 80%, transparent);
  border-radius: 0 6px 0 8px;
  background: color-mix(in srgb, var(--surface, #fff) 92%, transparent);
  color: var(--text-muted, #9ca3af);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease;
}

.translator-unit-card__side-btn:hover {
  background: #dcfce7;
  border-color: #86efac;
  color: #166534;
}

.translator-unit-card__side-btn.is-direct-pass {
  background: rgba(220, 252, 231, 0.72);
  border-color: rgba(34, 197, 94, 0.28);
  color: #166534;
}

.translator-unit-card__side-btn.is-checked {
  color: #f0fdf4;
  border-color: #22c55e;
  background: #22c55e;
}

.translator-unit-card__side-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.translator-unit-card__check-badge {
  width: 22px;
  height: 22px;
  border-radius: 0 6px 0 8px;
  background: #22c55e;
  color: #f0fdf4;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* ── 底部栏 ── */
.translator-footer {
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-top: 1px solid var(--panel-border, #e5e7eb);
  background: color-mix(
    in srgb,
    var(--dashboard-header-bg, #fff) 92%,
    transparent
  );
  font-size: 13px;
}

.translator-footer__info-group {
  display: flex;
  align-items: center;
  gap: 0;
}

.translator-footer__info-item {
  padding: 0 12px;
  color: var(--text-muted, #6b7280);
  border-right: 1px solid var(--panel-border, #e5e7eb);
}

.translator-footer__info-item.is-highlight {
  color: #c2410c;
  font-weight: 600;
}

.translator-footer__info-item:first-child {
  border-left: 1px solid var(--panel-border, #e5e7eb);
}

.translator-footer__info-item:last-child {
  border-right: none;
}

.translator-footer__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.translator-footer__hint {
  color: var(--text-muted, #6b7280);
  font-size: 12px;
}

.translator-footer__hint.is-readonly {
  color: #c2410c;
}

.translator-footer__zoom {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 1px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--panel-border, #e5e7eb) 50%, transparent);
  color: var(--text-muted, #6b7280);
}

.translator-footer__mode-btn {
  padding: 2px 10px;
  border-radius: 6px;
  border: 1px solid var(--panel-border, #e5e7eb);
  background: color-mix(in srgb, var(--surface, #f3f4f6) 80%, transparent);
  color: var(--text-primary, #374151);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.translator-footer__mode-btn:hover {
  background: color-mix(in srgb, var(--panel-border, #e5e7eb) 40%, transparent);
}

/* ── 空状态 ── */
.translator-empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── 暗色主题覆盖 ── */
:global(html[data-theme="dark"]) {
  /* 统计徽章 */
  .stats-badge--pink {
    background: rgba(159, 18, 57, 0.35);
    color: #fda4af;
  }

  .stats-badge--yellow {
    background: rgba(146, 64, 14, 0.35);
    color: #fde68a;
  }

  .stats-badge--gray {
    background: rgba(100, 116, 139, 0.2);
    color: var(--text-muted, #9da8bb);
  }

  .stats-badge--orange {
    background: rgba(180, 83, 9, 0.35);
    color: #fdba74;
  }

  .stats-badge--green {
    background: rgba(22, 101, 52, 0.35);
    color: #86efac;
  }

  .translator-stats-overlay {
    background: color-mix(in srgb, var(--panel-bg, #131821) 65%, transparent);
  }

  /* 符号按钮 */
  .translator-unit-card__symbol-btn {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .translator-unit-card__symbol-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .translator-unit-card__symbol-btn:active {
    background: rgba(255, 255, 255, 0.2);
  }

  /* 类型切换 */
  .translator-unit-card__type-toggle.is-inbox {
    background: rgba(159, 18, 57, 0.3);
    color: #fda4af;
  }

  .translator-unit-card__type-toggle.is-outbox {
    background: rgba(146, 64, 14, 0.3);
    color: #fde68a;
  }

  .translator-unit-card__section-avatar.is-translate {
    background: rgba(180, 83, 9, 0.24);
    color: #fdba74;
  }

  .translator-unit-card__section-avatar.is-proofread {
    background: rgba(22, 101, 52, 0.24);
    color: #86efac;
  }

  .translator-unit-card__section-label {
    color: var(--text-muted, #9da8bb);
  }

  .translator-unit-card__section-name {
    color: var(--text-muted, #cbd5e1);
  }

  .translator-unit-card__section-divider {
    background: rgba(100, 116, 139, 0.22);
  }

  .translator-header__page-status {
    background: rgba(22, 101, 52, 0.22);
    color: #86efac;
  }

  .translator-header__page-status.is-readonly,
  .translator-footer__info-item.is-highlight,
  .translator-footer__hint.is-readonly {
    background: rgba(180, 83, 9, 0.24);
    color: #fdba74;
  }

  /* 侧栏按钮 */
  .translator-unit-card__side-btn:hover,
  .translator-unit-card__side-btn.is-checked {
    background: rgba(22, 101, 52, 0.2);
    color: #86efac;
  }

  .translator-unit-card__side-btn {
    border-color: rgba(100, 116, 139, 0.26);
    background: rgba(15, 23, 42, 0.82);
    color: var(--text-muted, #9da8bb);
  }

  .translator-unit-card__side-btn.is-direct-pass {
    background: rgba(22, 101, 52, 0.22);
    border-color: rgba(74, 222, 128, 0.3);
    color: #86efac;
  }

  .translator-unit-card__side-btn.is-checked,
  .translator-unit-card__check-badge {
    background: #16a34a;
    border-color: #16a34a;
    color: #ecfdf5;
  }

  /* 活跃卡片 */
  .translator-unit-card.is-active {
    border-color: var(--control-btn-primary-border, #6079e7);
    box-shadow: 0 0 0 1px
      color-mix(
        in srgb,
        var(--control-btn-primary-border, #6079e7) 22%,
        transparent
      );
  }

  .translator-unit-card.is-editing {
    border-color: #22c55e;
    box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.18);
  }

  /* 彩色条 (暗色下降低亮度) */
  .translator-unit-card.is-inbox .translator-unit-card__index {
    box-shadow: inset 4px 0 0 0 rgba(249, 168, 212, 0.5);
  }

  .translator-unit-card.is-outbox .translator-unit-card__index {
    box-shadow: inset 4px 0 0 0 rgba(253, 224, 71, 0.4);
  }

  /* 标记圆点 */
  .translator-marker {
    background: linear-gradient(135deg, #c084fc, #a855f7);
  }

  .translator-marker.is-outbox {
    background: linear-gradient(135deg, #fbbf24, #d97706);
  }

  .translator-marker.is-proofread {
    background: linear-gradient(135deg, #34d399, #059669);
  }

  .translator-proofread-bubble {
    border-color: rgba(75, 85, 99, 0.92);
    background: rgba(31, 41, 55, 0.96);
    color: #f9fafb;
  }

  .translator-proofread-bubble::after {
    border-right-color: rgba(75, 85, 99, 0.92);
    border-bottom-color: rgba(75, 85, 99, 0.92);
  }

  .translator-proofread-bubble.is-outbox {
    background: rgba(55, 65, 81, 0.96);
    color: #f9fafb;
  }

  .translator-unit-card__preview.is-diff-result {
    color: #4ade80;
  }

  /* 底部栏模式按钮 */
  .translator-footer__mode-btn:hover {
    background: rgba(100, 116, 139, 0.2);
  }
}

:global(html[data-theme="dark"]) .translator-proofread-bubble {
  border-color: rgba(75, 85, 99, 0.92);
  background: rgba(31, 41, 55, 0.96);
  color: #f9fafb;
}

:global(html[data-theme="dark"]) .translator-proofread-bubble::after {
  border-right-color: rgba(75, 85, 99, 0.92);
  border-bottom-color: rgba(75, 85, 99, 0.92);
}

:global(html[data-theme="dark"]) .translator-proofread-bubble.is-outbox {
  background: rgba(55, 65, 81, 0.96);
  color: #f9fafb;
}

/* ── 响应式 ── */
@media (max-width: 1100px) {
  .translator-body {
    flex-direction: column;
  }

  .translator-right-panel {
    width: 100%;
    border-left: 0;
    border-top: 1px solid var(--panel-border, #e5e7eb);
    max-height: 50vh;
  }

  .translator-stage__image {
    max-height: 50vh;
  }

  .translator-stats-overlay {
    top: 8px;
    left: 8px;
  }
}

@media (max-width: 820px) {
  .translator-header {
    flex-direction: column;
    align-items: stretch;
    height: auto;
    padding: 8px 12px;
  }

  .translator-header__left,
  .translator-header__right {
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .translator-header__page-select {
    flex: 1;
    min-width: 0;
  }

  .translator-header__page-status {
    max-width: 100%;
  }
}
</style>
