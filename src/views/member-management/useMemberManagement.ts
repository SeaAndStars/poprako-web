/**
 * 文件用途：团队管理逻辑兼容层，已迁移至 useMemberManagementStore。
 * @deprecated 请改用 useMemberManagementStore。
 */

import { storeToRefs } from "pinia";
import { useMemberManagementStore } from "../../stores/memberManagement";

export type {
  InvitationModalMode,
  MemberModalMode,
  RoleConfigItem,
} from "../../stores/memberManagement";

/**
 * @deprecated 请改用 useMemberManagementStore。
 */
export function useMemberManagement() {
  const memberManagementStore = useMemberManagementStore();

  return {
    ...storeToRefs(memberManagementStore),
    formatTimestamp: memberManagementStore.formatTimestamp,
    resolveRoleEntries: memberManagementStore.resolveRoleEntries,
    resolveTeamAvatarUrl: memberManagementStore.resolveTeamAvatarUrl,
    resolveMemberAvatarUrl: memberManagementStore.resolveMemberAvatarUrl,
    ensureCurrentUserLoaded: memberManagementStore.ensureCurrentUserLoaded,
    refreshManagementData: memberManagementStore.refreshManagementData,
    setMemberSearchKeyword: memberManagementStore.setMemberSearchKeyword,
    clearMemberSearchKeyword: memberManagementStore.clearMemberSearchKeyword,
    handleTeamChange: memberManagementStore.handleTeamChange,
    openTeamCreateModal: memberManagementStore.openTeamCreateModal,
    handleTeamCreateModalCancel:
      memberManagementStore.handleTeamCreateModalCancel,
    handleTeamCreateModalSubmit:
      memberManagementStore.handleTeamCreateModalSubmit,
    openJoinTeamModal: memberManagementStore.openJoinTeamModal,
    handleJoinTeamModalCancel: memberManagementStore.handleJoinTeamModalCancel,
    openInvitationCenterModal: memberManagementStore.openInvitationCenterModal,
    handleInvitationCenterModalCancel:
      memberManagementStore.handleInvitationCenterModalCancel,
    openTeamSettingsModal: memberManagementStore.openTeamSettingsModal,
    handleTeamSettingsModalCancel:
      memberManagementStore.handleTeamSettingsModalCancel,
    handleTeamAvatarFileChange: memberManagementStore.handleTeamAvatarFileChange,
    handleTeamAvatarUpload: memberManagementStore.handleTeamAvatarUpload,
    handleRefreshClick: memberManagementStore.handleRefreshClick,
    openInvitationCreateModal: memberManagementStore.openInvitationCreateModal,
    openInvitationEditModal: memberManagementStore.openInvitationEditModal,
    handleInvitationModalCancel:
      memberManagementStore.handleInvitationModalCancel,
    handleInvitationModalSubmit:
      memberManagementStore.handleInvitationModalSubmit,
    handleDeleteInvitation: memberManagementStore.handleDeleteInvitation,
    openMemberCreateModal: memberManagementStore.openMemberCreateModal,
    openMemberEditModal: memberManagementStore.openMemberEditModal,
    handleMemberModalCancel: memberManagementStore.handleMemberModalCancel,
    handleMemberModalSubmit: memberManagementStore.handleMemberModalSubmit,
    handleDeleteMember: memberManagementStore.handleDeleteMember,
    openTeamDeleteModal: memberManagementStore.openTeamDeleteModal,
    handleTeamDeleteModalCancel:
      memberManagementStore.handleTeamDeleteModalCancel,
    handleTeamDeleteModalSubmit:
      memberManagementStore.handleTeamDeleteModalSubmit,
    handleJoinTeamSubmit: memberManagementStore.handleJoinTeamSubmit,
    handleCopyInvitationCode: memberManagementStore.handleCopyInvitationCode,
  };
}
