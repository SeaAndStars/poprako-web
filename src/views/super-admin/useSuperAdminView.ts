import { onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "../../stores/auth";
import { useSuperAdminStore } from "../../stores/superAdmin";

/** @deprecated 请直接使用 useSuperAdminStore。 */
export function useSuperAdminView() {
  const superAdminStore = useSuperAdminStore();
  const authStore = useAuthStore();
  const { currentUserProfile: currentUser, currentUserProfileLoading } =
    storeToRefs(authStore);

  onMounted(() => {
    void superAdminStore.initializeSuperAdminView();
  });

  return {
    ...storeToRefs(superAdminStore),
    currentUser,
    currentUserProfileLoading,
    formatTimestamp: superAdminStore.formatTimestamp,
    resolveDisplayInitial: superAdminStore.resolveDisplayInitial,
    resolveRoleEntries: superAdminStore.resolveRoleEntries,
    resolveTeamAvatarUrl: superAdminStore.resolveTeamAvatarUrl,
    resolveUserAvatarUrl: superAdminStore.resolveUserAvatarUrl,
    resolveMemberAvatarUrl: superAdminStore.resolveMemberAvatarUrl,
    resolveUserDisplayName: superAdminStore.resolveUserDisplayName,
    resolveMemberDisplayName: superAdminStore.resolveMemberDisplayName,
    handleRefreshClick: superAdminStore.handleRefreshClick,
    handleTeamSelect: superAdminStore.handleTeamSelect,
    openTeamCreateModal: superAdminStore.openTeamCreateModal,
    handleTeamCreateModalCancel: superAdminStore.handleTeamCreateModalCancel,
    handleTeamCreateModalSubmit: superAdminStore.handleTeamCreateModalSubmit,
    openInvitationCreateModal: superAdminStore.openInvitationCreateModal,
    handleInvitationModalCancel: superAdminStore.handleInvitationModalCancel,
    handleInvitationModalSubmit: superAdminStore.handleInvitationModalSubmit,
    handleUserSearchKeywordChange: superAdminStore.handleUserSearchKeywordChange,
    handleUserSearch: superAdminStore.handleUserSearch,
    openUserEditModal: superAdminStore.openUserEditModal,
    handleUserEditModalCancel: superAdminStore.handleUserEditModalCancel,
    handleUserEditModalSubmit: superAdminStore.handleUserEditModalSubmit,
    canDeleteUser: superAdminStore.canDeleteUser,
    handleDeleteUser: superAdminStore.handleDeleteUser,
    handleCopyInvitationCode: superAdminStore.handleCopyInvitationCode,
  };
}

/** @deprecated 请直接使用 useSuperAdminStore。 */
export type SuperAdminViewContext = ReturnType<typeof useSuperAdminView>;
