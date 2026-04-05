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
        <div class="translator-header__title-group">
          <span class="translator-header__title">
            {{ workspaceHeaderTitle }}
          </span>
          <div
            v-if="activeProjectEditors.length > 0"
            class="translator-header__presence"
          >
            <a-tooltip
              v-for="pageEditor in activeProjectEditors"
              :key="resolvePageEditorKey(pageEditor)"
              :title="resolveCollaboratorTooltip(pageEditor)"
              placement="bottom"
            >
              <a-avatar
                :size="24"
                :src="
                  resolveDisplayAssetUrl(pageEditor.avatar_url) || undefined
                "
                class="translator-header__presence-avatar"
              >
                {{ resolveCollaboratorAvatarInitial(pageEditor) }}
              </a-avatar>
            </a-tooltip>
          </div>
        </div>
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
          @change="handlePageSelectChange"
        >
          <a-select-option
            v-for="pageOption in pageSelectEntries"
            :key="pageOption.value"
            :value="pageOption.value"
          >
            <div class="translator-header__page-option">
              <span class="translator-header__page-option-label">
                {{ pageOption.label }}
              </span>
              <div
                v-if="pageOption.editors.length > 0"
                class="translator-header__page-option-avatars"
              >
                <a-tooltip
                  v-for="pageEditor in pageOption.editors"
                  :key="resolvePageEditorKey(pageEditor)"
                  :title="resolveCollaboratorTooltip(pageEditor)"
                  placement="left"
                >
                  <a-avatar
                    :size="18"
                    :src="
                      resolveDisplayAssetUrl(pageEditor.avatar_url) || undefined
                    "
                    class="translator-header__page-option-avatar"
                  >
                    {{ resolveCollaboratorAvatarInitial(pageEditor) }}
                  </a-avatar>
                </a-tooltip>
              </div>
            </div>
          </a-select-option>
        </a-select>

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

  <div v-else-if="isWorkspaceLoading" class="translator-empty-state">
    <a-spin size="large" :tip="workspaceLoadingTip" />
  </div>

  <div v-else class="translator-empty-state">
    <a-empty :description="workspaceEmptyDescription">
      <a-button type="primary" @click="handleReturnToWorkspace">
        返回工作区
      </a-button>
    </a-empty>
  </div>
</template>


<script setup lang="ts">
import { useTranslatorView } from "./useTranslatorView";

const {
  projectRecord,
  isDragging,
  draggingUnitID,
  handleReturnToWorkspace,
  workspaceHeaderTitle,
  activeProjectEditors,
  resolvePageEditorKey,
  resolveCollaboratorTooltip,
  resolveDisplayAssetUrl,
  resolveCollaboratorAvatarInitial,
  currentPageMeta,
  currentPageIndex,
  moveToPreviousPage,
  handlePageSelectChange,
  pageSelectEntries,
  currentPageStatusText,
  isCurrentPageLockedByOther,
  moveToNextPage,
  currentPageImageURL,
  clearSelectedUnit,
  pageInboxCount,
  pageOutboxCount,
  pageUntranslatedCount,
  currentPageTranslatedCount,
  currentPageProofreadCount,
  stageOverlayRef,
  stageTransformStyle,
  handleStageWheel,
  handleStageDragStart,
  handleImageError,
  imageLoading,
  currentPageUnits,
  editorMode,
  hasTextContent,
  resolveFinalUnitText,
  isDarkTheme,
  selectedUnitID,
  resolveProofreadBubbleStyle,
  resolveMarkerStyle,
  handleOverlayClick,
  handleOverlayContextMenu,
  handleSelectUnit,
  requestRemoveUnit,
  handleMarkerDragStart,
  editingUnitID,
  isUnitTranslated,
  isUnitProofread,
  currentPageCanMutateStructure,
  toggleSelectedUnitBubble,
  currentUserAvatarURL,
  currentUserInitial,
  currentUserDisplayName,
  currentPageCanEditTranslate,
  handleUnitFieldFocus,
  handleUnitFieldBlur,
  handleTextFieldInput,
  clearFieldValue,
  currentPageCanEditProofread,
  customSymbols,
  isCurrentFieldEditable,
  insertQuickSymbol,
  canToggleProofreadAction,
  canDirectPassProofread,
  resolveProofreadActionTitle,
  toggleSelectedUnitProofread,
  resolveProofreadActionText,
  footerHintText,
  zoomDisplayText,
  toggleEditorMode,
  isWorkspaceLoading,
  workspaceLoadingTip,
  workspaceEmptyDescription,

} = useTranslatorView();
</script>

<style scoped src="./translatorView.scss" lang="scss"></style>
