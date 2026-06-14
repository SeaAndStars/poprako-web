/**
 * 文件用途：翻译器页面 UI 会话状态 Store。
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import type { TranslatorMode } from "../local-project/collaboration";
import type { LocalProjectUnit } from "../local-project/types";
import type { UserInfo } from "../types/domain";
import type { TranslatorCollaboratorIdentity } from "./translatorCollaboration";

/** 可编辑文本字段键值。 */
export type EditableFieldKey = "translated_text" | "proofread_text";

/** 翻译器 UI 会话状态 Store。 */
export const useTranslatorUIStore = defineStore("translator-ui", () => {
  /** 当前编辑模式（翻译/校对）。 */
  const editorMode = ref<TranslatorMode>("translate");
  /** 当前激活文本字段。 */
  const activeTextField = ref<EditableFieldKey>("translated_text");
  /** 当前页索引。 */
  const currentPageIndex = ref(0);

  /** 画布缩放比例。 */
  const stageScale = ref(1);
  /** 画布横向平移偏移量。 */
  const stagePanX = ref(0);
  /** 画布纵向平移偏移量。 */
  const stagePanY = ref(0);
  /** 是否处于画布拖拽中。 */
  const isDragging = ref(false);
  /** 画布遮罩层元素引用。 */
  const stageOverlayRef = ref<HTMLElement | null>(null);
  /** 画布拖拽上一帧鼠标 X。 */
  const stageDragLastX = ref(0);
  /** 画布拖拽上一帧鼠标 Y。 */
  const stageDragLastY = ref(0);
  /** 画布是否发生过有效拖拽位移。 */
  const stageDragMoved = ref(false);

  /** 当前页图片是否加载中。 */
  const imageLoading = ref(false);
  /** 当前页图片失败后是否已自动重试。 */
  const imageErrorRetriedPageKey = ref<string | null>(null);
  /** 当前页图片 URL。 */
  const currentPageImageURL = ref<string | null>(null);

  /** 当前页标记列表。 */
  const currentPageUnits = ref<LocalProjectUnit[]>([]);
  /** 当前选中标记 ID。 */
  const selectedUnitID = ref<string | null>(null);
  /** 当前编辑中标记 ID。 */
  const editingUnitID = ref<string | null>(null);

  /** 是否正在获取页面协作锁。 */
  const isAcquiringPageLock = ref(false);
  /** 是否正在切换本页翻译完成状态。 */
  const isCompletingCurrentPageTranslation = ref(false);

  /** 当前拖拽中的标记 ID。 */
  const draggingUnitID = ref<string | null>(null);
  /** 标记拖拽起始鼠标 X。 */
  const markerDragStartX = ref(0);
  /** 标记拖拽起始鼠标 Y。 */
  const markerDragStartY = ref(0);
  /** 标记拖拽起始归一化 X。 */
  const markerDragOrigX = ref(0);
  /** 标记拖拽起始归一化 Y。 */
  const markerDragOrigY = ref(0);
  /** 标记是否发生过有效拖拽位移。 */
  const markerDragMoved = ref(false);

  /** 已加载的关联用户资料缓存。 */
  const relatedUserProfiles = ref<Record<string, UserInfo>>({});
  /** 已记忆的协作者身份缓存。 */
  const relatedCollaboratorIdentities = ref<
    Record<string, TranslatorCollaboratorIdentity>
  >({});

  /** 当前登录用户资料。 */
  const currentUserProfile = ref<UserInfo | null>(null);
  /** 当前用户头像缓存击穿令牌。 */
  const currentUserAvatarCacheBustToken = ref<number>(0);

  /**
   * 重置翻译器 UI 会话状态（用于路由切换等场景）。
   */
  function resetSession(): void {
    editorMode.value = "translate";
    activeTextField.value = "translated_text";
    currentPageIndex.value = 0;
    stageScale.value = 1;
    stagePanX.value = 0;
    stagePanY.value = 0;
    isDragging.value = false;
    stageOverlayRef.value = null;
    stageDragLastX.value = 0;
    stageDragLastY.value = 0;
    stageDragMoved.value = false;
    imageLoading.value = false;
    imageErrorRetriedPageKey.value = null;
    currentPageImageURL.value = null;
    currentPageUnits.value = [];
    selectedUnitID.value = null;
    editingUnitID.value = null;
    isAcquiringPageLock.value = false;
    isCompletingCurrentPageTranslation.value = false;
    draggingUnitID.value = null;
    markerDragStartX.value = 0;
    markerDragStartY.value = 0;
    markerDragOrigX.value = 0;
    markerDragOrigY.value = 0;
    markerDragMoved.value = false;
  }

  return {
    editorMode,
    activeTextField,
    currentPageIndex,
    stageScale,
    stagePanX,
    stagePanY,
    isDragging,
    stageOverlayRef,
    stageDragLastX,
    stageDragLastY,
    stageDragMoved,
    imageLoading,
    imageErrorRetriedPageKey,
    currentPageImageURL,
    currentPageUnits,
    selectedUnitID,
    editingUnitID,
    isAcquiringPageLock,
    isCompletingCurrentPageTranslation,
    draggingUnitID,
    markerDragStartX,
    markerDragStartY,
    markerDragOrigX,
    markerDragOrigY,
    markerDragMoved,
    relatedUserProfiles,
    relatedCollaboratorIdentities,
    currentUserProfile,
    currentUserAvatarCacheBustToken,
    resetSession,
  };
});
