/**
 * @deprecated 请改用 `useWorksetDetailStore` 与 `storeToRefs`，本文件仅作兼容导出。
 */

import { storeToRefs } from "pinia";

import {
  ROLE_PROOFREADER,
  ROLE_REVIEWER,
  ROLE_TRANSLATOR,
  ROLE_TYPESETTER,
  displaySequence,
  formatTimestamp,
  resolveRoleLabel,
  resolveUserDisplayName,
  resolveWorkflowStageLabel,
  resolveWorkflowTagColor,
  useWorksetDetailStore,
  type RoleReviewPayload,
  type RoleWorkspaceMode,
} from "../../stores/worksetDetail";

export {
  ROLE_PROOFREADER,
  ROLE_REVIEWER,
  ROLE_TRANSLATOR,
  ROLE_TYPESETTER,
  WORKFLOW_STAGE_COLORS,
  WORKFLOW_STAGE_LABELS,
  displaySequence,
  formatTimestamp,
  resolveRoleLabel,
  resolveUserDisplayName,
  resolveWorkflowStageLabel,
  resolveWorkflowTagColor,
  type RoleReviewPayload,
  type RoleWorkspaceMode,
};

/**
 * @deprecated 请改用 `useWorksetDetailStore`；视图层需在 mount / 路由变化时调用 `initializeFromRoute`。
 */
export function useWorksetDetailView() {
  const store = useWorksetDetailStore();
  const refs = storeToRefs(store);

  return {
    ...refs,
    displaySequence,
    formatTimestamp,
    resolveRoleLabel,
    resolveUserDisplayName,
    resolveWorkflowStageLabel,
    resolveWorkflowTagColor,
    ROLE_PROOFREADER,
    ROLE_REVIEWER,
    ROLE_TRANSLATOR,
    ROLE_TYPESETTER,
    canBatchApplyRoles: store.canBatchApplyRoles,
    clearManagedRoleSelection: store.clearManagedRoleSelection,
    closeChapterEditor: store.closeChapterEditor,
    closeRoleManager: store.closeRoleManager,
    handleBack: store.handleBack,
    handleBatchApplyRoles: store.handleBatchApplyRoles,
    handleChapterCreated: store.handleChapterCreated,
    handleComicChange: store.handleComicChange,
    handleDeleteChapter: store.handleDeleteChapter,
    handleRoleWorkspace: store.handleRoleWorkspace,
    handleReviewDrawerClose: store.handleReviewDrawerClose,
    handleWorksetUpdated: store.handleWorksetUpdated,
    handleRoleChanged: store.handleRoleChanged,
    handleRoleRequestReview: store.handleRoleRequestReview,
    handleRoleReview: store.handleRoleReview,
    openChapterEditor: store.openChapterEditor,
    openManagedRoleReview: store.openManagedRoleReview,
    openRoleManager: store.openRoleManager,
    refreshBoard: store.refreshBoard,
    removeManagedTranslator: store.removeManagedTranslator,
    resolveBatchApplyLabel: store.resolveBatchApplyLabel,
    resolveUserAvatarUrl: store.resolveUserAvatarUrl,
    submitChapterUpdate: store.submitChapterUpdate,
    submitRoleManagement: store.submitRoleManagement,
  };
}
