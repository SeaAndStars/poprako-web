/**
 * 文件用途：DashboardView 逻辑兼容层，已迁移至 useDashboardStore。
 * @deprecated 请改用 useDashboardStore。
 */

import { storeToRefs } from "pinia";
import {
  formatParticipationTimestamp,
  isWorkspaceEnterRole,
  useDashboardStore,
} from "../stores/dashboard";

export type {
  WorkspaceParticipationEntry,
  WorkspaceParticipationMode,
} from "../stores/dashboard";
export { formatParticipationTimestamp, isWorkspaceEnterRole };

/**
 * @deprecated 请改用 useDashboardStore。
 */
export function useDashboardView() {
  const dashboardStore = useDashboardStore();

  return {
    ...storeToRefs(dashboardStore),
    formatParticipationTimestamp,
    isWorkspaceEnterRole,
    handleDeleteProject: dashboardStore.handleDeleteProject,
    handleDownloadChapterManuscript:
      dashboardStore.handleDownloadChapterManuscript,
    handleOpenOnlineChapter: dashboardStore.handleOpenOnlineChapter,
    handleOpenProject: dashboardStore.handleOpenProject,
    handleProjectCreated: dashboardStore.handleProjectCreated,
    loadMyOnlineAssignments: dashboardStore.loadMyOnlineAssignments,
    confirmDownloadModal: dashboardStore.confirmDownloadModal,
    cancelDownloadModal: dashboardStore.cancelDownloadModal,
  };
}
