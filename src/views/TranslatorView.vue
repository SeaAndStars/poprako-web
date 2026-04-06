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
        <a-tooltip
          v-if="shouldShowCompletePageTranslationButton"
          placement="bottom"
          :title="currentPageTranslationCompletionTooltip"
        >
          <span class="translator-header__complete-trigger-wrap">
            <a-button
              size="small"
              class="translator-header__complete-trigger"
              :class="{
                'is-completed': isCurrentPageTranslationCompleted,
              }"
              :loading="isCompletingCurrentPageTranslation"
              :disabled="!canTogglePageTranslationCompletion"
              :aria-label="currentPageTranslationCompletionAriaLabel"
              @click="handleCompletePageTranslation"
            >
              <template #icon>
                <CheckOutlined />
              </template>
            </a-button>
          </span>
        </a-tooltip>

        <a-dropdown
          placement="bottomLeft"
          :trigger="['click']"
          overlay-class-name="translator-shortcuts-dropdown"
        >
          <a-button
            size="small"
            class="translator-header__shortcut-trigger"
            title="查看快捷键"
            aria-label="查看快捷键"
          >
            <template #icon>
              <QuestionCircleOutlined />
            </template>
          </a-button>

          <template #overlay>
            <div class="translator-shortcuts-card" @click.stop>
              <div class="translator-shortcuts-card__title">快捷键</div>
              <div class="translator-shortcuts-card__subtitle">
                只显示常用操作，其他兼容快捷键仍可使用。
              </div>

              <section
                v-for="section in shortcutHelpSections"
                :key="section.title"
                class="translator-shortcuts-card__section"
              >
                <div class="translator-shortcuts-card__section-title">
                  {{ section.title }}
                </div>
                <div
                  v-for="shortcut in section.items"
                  :key="`${section.title}-${shortcut.keys}`"
                  class="translator-shortcuts-card__item"
                >
                  <div class="translator-shortcuts-card__keys">
                    <template
                      v-for="(token, tokenIndex) in tokenizeShortcutKeys(
                        shortcut.keys,
                      )"
                      :key="`${shortcut.keys}-${token.value}-${tokenIndex}`"
                    >
                      <kbd
                        v-if="token.kind === 'key'"
                        class="translator-shortcuts-card__keycap"
                      >
                        {{ token.value }}
                      </kbd>
                      <span v-else class="translator-shortcuts-card__separator">
                        {{ token.value }}
                      </span>
                    </template>
                  </div>
                  <span class="translator-shortcuts-card__description">
                    {{ shortcut.description }}
                  </span>
                </div>
              </section>
            </div>
          </template>
        </a-dropdown>

        <a-button
          size="small"
          class="translator-header__settings-trigger"
          title="编辑器设置"
          aria-label="编辑器设置"
          @click="isSettingsModalOpen = true"
        >
          <template #icon>
            <SettingOutlined />
          </template>
        </a-button>

        <a-modal
          v-model:open="isSettingsModalOpen"
          title="编辑器设置"
          :footer="null"
          :width="400"
          :destroy-on-close="true"
        >
          <div class="translator-settings-form">
            <div class="translator-settings-form__item">
              <label class="translator-settings-form__label">
                新建标记后行为
              </label>
              <a-radio-group
                v-model:value="markerCreationBehaviorModel"
                size="small"
              >
                <a-radio-button value="select">仅选中</a-radio-button>
                <a-radio-button value="edit"> 选中并编辑 </a-radio-button>
              </a-radio-group>
              <div class="translator-settings-form__hint">
                「仅选中」：创建后高亮标记但不打开文本框，适合先批量标号。
              </div>
            </div>

            <div class="translator-settings-form__item">
              <label class="translator-settings-form__label">
                标记透明度
              </label>
              <a-slider
                v-model:value="markerOpacitySliderDraft"
                :min="30"
                :max="100"
                :step="5"
                :tip-formatter="(val?: number) => `${val ?? 85}%`"
                @afterChange="commitMarkerOpacityDraft"
              />
              <div class="translator-settings-form__value">
                {{ markerOpacitySliderDraft }}%
              </div>
              <div class="translator-settings-form__hint">
                降低透明度可减少标号对文字的遮挡。
              </div>
            </div>

            <div class="translator-settings-form__item">
              <label class="translator-settings-form__label"> 标记大小 </label>
              <a-slider
                v-model:value="markerSizeSliderDraft"
                :min="16"
                :max="44"
                :step="2"
                :tip-formatter="(val?: number) => `${val ?? 28}px`"
                @afterChange="commitMarkerSizeDraft"
              />
              <div class="translator-settings-form__value">
                {{ markerSizeSliderDraft }}px
              </div>
              <div class="translator-settings-form__hint">
                调小标记圆点以减少对画面内容的遮挡。
              </div>
            </div>
          </div>
        </a-modal>

        <a-button
          :disabled="currentPageIndex <= 0"
          size="small"
          @click="moveToPreviousPage"
        >
          &lt;
        </a-button>

        <div class="translator-header__page-picker-group">
          <a-select
            class="translator-header__page-select"
            :style="pageSelectWidthStyle"
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
                  v-if="pageOption.visibleEditors.length > 0"
                  class="translator-header__page-option-avatars"
                >
                  <a-tooltip
                    v-for="pageEditor in pageOption.visibleEditors"
                    :key="resolvePageEditorKey(pageEditor)"
                    :title="resolveCollaboratorTooltip(pageEditor)"
                    placement="left"
                  >
                    <a-avatar
                      :size="18"
                      :src="
                        resolveDisplayAssetUrl(pageEditor.avatar_url) ||
                        undefined
                      "
                      class="translator-header__page-option-avatar"
                    >
                      {{ resolveCollaboratorAvatarInitial(pageEditor) }}
                    </a-avatar>
                  </a-tooltip>
                  <span
                    v-if="pageOption.hiddenEditorCount > 0"
                    class="translator-header__page-option-more"
                  >
                    +{{ pageOption.hiddenEditorCount }}
                  </span>
                </div>
              </div>
            </a-select-option>
          </a-select>
        </div>

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

              <TranslatorMarker
                v-for="projectUnit in currentPageUnits"
                :key="`${projectUnit.id}_${markerSizeSliderDraft}_${markerOpacitySliderDraft}`"
                :index="projectUnit.index"
                :x="projectUnit.x_coord"
                :y="projectUnit.y_coord"
                :size="markerSizeSliderDraft"
                :opacity="markerOpacityValue"
                :active="projectUnit.id === selectedUnitID"
                :editing="projectUnit.id === editingUnitID"
                :outbox="!projectUnit.is_bubble"
                :translated="
                  isUnitTranslated(projectUnit) && !isUnitProofread(projectUnit)
                "
                :proofread="isUnitProofread(projectUnit)"
                :dragging="draggingUnitID === projectUnit.id"
                :dark="isDarkTheme"
                @select="handleSelectUnit(projectUnit.id)"
                @request-remove="requestRemoveUnit(projectUnit.id)"
                @drag-start="handleMarkerDragStart($event, projectUnit.id)"
              />
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
                          :src="
                            resolveUnitOwnerAvatarURL(
                              projectUnit,
                              'translate',
                            ) || undefined
                          "
                        >
                          {{
                            resolveUnitOwnerInitial(projectUnit, "translate")
                          }}
                        </a-avatar>
                        <span class="translator-unit-card__section-label"
                          >翻译</span
                        >
                      </div>
                      <span class="translator-unit-card__section-name">{{
                        resolveUnitOwnerDisplayName(projectUnit, "translate")
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
                          :src="
                            resolveUnitOwnerAvatarURL(
                              projectUnit,
                              'proofread',
                            ) || undefined
                          "
                        >
                          {{
                            resolveUnitOwnerInitial(projectUnit, "proofread")
                          }}
                        </a-avatar>
                        <span class="translator-unit-card__section-label"
                          >校对</span
                        >
                      </div>
                      <span class="translator-unit-card__section-name">{{
                        resolveUnitOwnerDisplayName(projectUnit, "proofread")
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
                        :src="
                          resolveUnitOwnerAvatarURL(projectUnit, 'translate') ||
                          undefined
                        "
                      >
                        {{ resolveUnitOwnerInitial(projectUnit, "translate") }}
                      </a-avatar>
                      <span class="translator-unit-card__section-label"
                        >翻译</span
                      >
                    </div>
                    <span class="translator-unit-card__section-name">{{
                      resolveUnitOwnerDisplayName(projectUnit, "translate")
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
                        :src="
                          resolveUnitOwnerAvatarURL(projectUnit, 'translate') ||
                          undefined
                        "
                      >
                        {{ resolveUnitOwnerInitial(projectUnit, "translate") }}
                      </a-avatar>
                      <span class="translator-unit-card__section-label"
                        >翻译</span
                      >
                    </div>
                    <span class="translator-unit-card__section-name">{{
                      resolveUnitOwnerDisplayName(projectUnit, "translate")
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
                        :src="
                          resolveUnitOwnerAvatarURL(projectUnit, 'proofread') ||
                          undefined
                        "
                      >
                        {{ resolveUnitOwnerInitial(projectUnit, "proofread") }}
                      </a-avatar>
                      <span class="translator-unit-card__section-label"
                        >校对</span
                      >
                    </div>
                    <span class="translator-unit-card__section-name">{{
                      resolveUnitOwnerDisplayName(projectUnit, "proofread")
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
import {
  CheckOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons-vue";
import { computed, ref, watch } from "vue";
import TranslatorMarker from "../components/TranslatorMarker.vue";
import type { MarkerCreationBehavior } from "../stores/translatorSettings";
import { useTranslatorView } from "./useTranslatorView";

type ShortcutKeyToken = {
  kind: "key" | "separator";
  value: string;
};

function tokenizeShortcutKeys(keys: string): ShortcutKeyToken[] {
  return keys
    .split(/(\s+\+\s+|\s+\/\s+)/g)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => ({
      kind: token === "+" || token === "/" ? "separator" : "key",
      value: token,
    }));
}

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
  resolveUnitOwnerAvatarURL,
  resolveUnitOwnerInitial,
  resolveUnitOwnerDisplayName,
  currentPageMeta,
  currentPageIndex,
  moveToPreviousPage,
  handlePageSelectChange,
  pageSelectEntries,
  pageSelectWidthStyle,
  shortcutHelpSections,
  currentPageStatusText,
  isCurrentPageLockedByOther,
  shouldShowCompletePageTranslationButton,
  canTogglePageTranslationCompletion,
  currentPageTranslationCompletionTooltip,
  currentPageTranslationCompletionAriaLabel,
  isCurrentPageTranslationCompleted,
  isCompletingCurrentPageTranslation,
  handleCompletePageTranslation,
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
  translatorSettingsStore,
} = useTranslatorView();

const isSettingsModalOpen = ref(false);

const markerCreationBehaviorModel = computed<MarkerCreationBehavior>({
  get: () => translatorSettingsStore.markerCreationBehavior,
  set: (value) => {
    translatorSettingsStore.setMarkerCreationBehavior(value);
  },
});

const normalizedMarkerOpacity = computed<number>(() => {
  const value = translatorSettingsStore.markerOpacity;
  return typeof value === "number" && isFinite(value) ? value : 0.85;
});

const markerOpacitySliderDraft = ref(
  Math.round(normalizedMarkerOpacity.value * 100),
);

const markerOpacityValue = computed<number>(
  () => markerOpacitySliderDraft.value / 100,
);

const normalizedMarkerSize = computed<number>(() => {
  const value = translatorSettingsStore.markerSize;
  return typeof value === "number" && isFinite(value) ? value : 28;
});

const markerSizeSliderDraft = ref(normalizedMarkerSize.value);

watch(normalizedMarkerOpacity, (value) => {
  const nextPercent = Math.round(value * 100);

  if (markerOpacitySliderDraft.value !== nextPercent) {
    markerOpacitySliderDraft.value = nextPercent;
  }
});

watch(normalizedMarkerSize, (value) => {
  if (markerSizeSliderDraft.value !== value) {
    markerSizeSliderDraft.value = value;
  }
});

function commitMarkerOpacityDraft(value?: number | [number, number]): void {
  const nextValue = Array.isArray(value)
    ? value[0]
    : (value ?? markerOpacitySliderDraft.value);

  if (typeof nextValue !== "number" || !isFinite(nextValue)) {
    return;
  }

  translatorSettingsStore.setMarkerOpacity(nextValue / 100);
}

function commitMarkerSizeDraft(value?: number | [number, number]): void {
  const nextValue = Array.isArray(value)
    ? value[0]
    : (value ?? markerSizeSliderDraft.value);

  if (typeof nextValue !== "number" || !isFinite(nextValue)) {
    return;
  }

  translatorSettingsStore.setMarkerSize(nextValue);
}
</script>

<style scoped src="./translatorView.scss" lang="scss"></style>
