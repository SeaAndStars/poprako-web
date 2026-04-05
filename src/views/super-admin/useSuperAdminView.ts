import { computed, onMounted, reactive, ref } from "vue";
import { message } from "ant-design-vue";
import { storeToRefs } from "pinia";
import {
  createInvitation,
  createTeam,
  deleteUser,
  getInvitationList,
  getMemberList,
  getTeamList,
  getUserList,
  updateUserProfile,
} from "../../api/modules";
import { useAvatarDisplayUrl } from "../../composables/useAvatarDisplayUrl";
import { useAuthStore } from "../../stores/auth";
import type {
  InvitationInfo,
  MemberInfo,
  TeamInfo,
  UserInfo,
} from "../../types/domain";

interface RoleConfigItem {
  mask: number;
  label: string;
  color: string;
}

const ADMIN_ROLE_MASK = 64;
const USER_PROFILE_UPDATED_EVENT = "poprako:user-profile-updated";

const ROLE_CONFIG: readonly RoleConfigItem[] = [
  { mask: 1, label: "图源", color: "magenta" },
  { mask: 2, label: "翻译", color: "blue" },
  { mask: 4, label: "校对", color: "purple" },
  { mask: 8, label: "嵌字", color: "cyan" },
  { mask: 16, label: "监修", color: "orange" },
  { mask: 32, label: "发布", color: "green" },
  { mask: 64, label: "管理", color: "gold" },
] as const;

function hasRole(roleMask: number | undefined, roleFlag: number): boolean {
  if (typeof roleMask !== "number") {
    return false;
  }

  return (roleMask & roleFlag) !== 0;
}

function encodeRoleMask(roleMasks: number[]): number {
  return roleMasks.reduce((combinedMask, currentMask) => {
    return combinedMask | currentMask;
  }, 0);
}

function resolveRoleEntries(roleMask: number | undefined): RoleConfigItem[] {
  return ROLE_CONFIG.filter((roleInfo) => hasRole(roleMask, roleInfo.mask));
}

function formatTimestamp(rawTime: number | undefined): string {
  if (!rawTime) {
    return "-";
  }

  const normalizedTime = rawTime > 1_000_000_000_000 ? rawTime : rawTime * 1000;
  const date = new Date(normalizedTime);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("zh-CN", { hour12: false });
}

function resolveDisplayInitial(rawLabel: string | undefined): string {
  const normalizedLabel = rawLabel?.trim();

  if (!normalizedLabel || normalizedLabel.length === 0) {
    return "?";
  }

  return normalizedLabel.slice(0, 1).toUpperCase();
}

function createSuperAdminViewState() {
  const authStore = useAuthStore();
  const { currentUserProfile: currentUser, currentUserProfileLoading } =
    storeToRefs(authStore);

  const teamsLoading = ref(false);
  const usersLoading = ref(false);
  const detailLoading = ref(false);
  const teamCreateSubmitting = ref(false);
  const invitationSubmitting = ref(false);
  const userEditSubmitting = ref(false);
  const deletingUserID = ref<string | undefined>(undefined);

  const teams = ref<TeamInfo[]>([]);
  const users = ref<UserInfo[]>([]);
  const members = ref<MemberInfo[]>([]);
  const invitations = ref<InvitationInfo[]>([]);

  const selectedTeamID = ref<string | undefined>(undefined);
  const userSearchKeyword = ref("");

  const isTeamCreateModalOpen = ref(false);
  const isInvitationModalOpen = ref(false);
  const isUserEditModalOpen = ref(false);
  const editingUser = ref<UserInfo | null>(null);

  const teamCreateForm = reactive({
    name: "",
    description: "",
  });

  const userEditForm = reactive({
    name: "",
  });

  const invitationForm = reactive({
    inviteeQq: "",
    roleMasks: [] as number[],
  });

  const selectedTeamInfo = computed(() => {
    return (
      teams.value.find((teamInfo) => teamInfo.id === selectedTeamID.value) ||
      null
    );
  });

  const hasSelectedTeam = computed(() => Boolean(selectedTeamInfo.value));
  const teamCount = computed(() => teams.value.length);
  const userCount = computed(() => users.value.length);
  const selectedTeamMemberCount = computed(() => members.value.length);
  const selectedTeamInvitationCount = computed(() => invitations.value.length);
  const selectedTeamPendingInvitationCount = computed(() => {
    return invitations.value.filter((invitationInfo) => invitationInfo.pending)
      .length;
  });
  const selectedTeamAdminCount = computed(() => {
    return members.value.filter((memberInfo) => {
      return hasRole(memberInfo.roles, ADMIN_ROLE_MASK);
    }).length;
  });
  const pageLoading = computed(() => {
    return (
      currentUserProfileLoading.value ||
      teamsLoading.value ||
      usersLoading.value ||
      detailLoading.value
    );
  });
  const roleCheckboxOptions = computed(() => {
    return ROLE_CONFIG.map((roleInfo) => ({
      label: roleInfo.label,
      value: roleInfo.mask,
    }));
  });
  const { resolveTeamAvatarUrl, resolveUserAvatarUrl } = useAvatarDisplayUrl();

  async function ensureSuperAdminLoaded(): Promise<void> {
    await authStore.ensureCurrentUserProfileLoaded();

    if (!authStore.isSuperAdmin) {
      throw new Error("只有超级管理员可以访问该页面");
    }
  }

  function resolvePreferredTeamID(
    nextTeams: TeamInfo[],
    preferredTeamID?: string,
  ): string | undefined {
    if (
      preferredTeamID &&
      nextTeams.some((teamInfo) => teamInfo.id === preferredTeamID)
    ) {
      return preferredTeamID;
    }

    if (
      authStore.currentTeamId &&
      nextTeams.some((teamInfo) => teamInfo.id === authStore.currentTeamId)
    ) {
      return authStore.currentTeamId;
    }

    if (
      selectedTeamID.value &&
      nextTeams.some((teamInfo) => teamInfo.id === selectedTeamID.value)
    ) {
      return selectedTeamID.value;
    }

    return nextTeams[0]?.id;
  }

  function resetTeamCreateForm(): void {
    teamCreateForm.name = "";
    teamCreateForm.description = "";
  }

  function resetInvitationForm(): void {
    invitationForm.inviteeQq = "";
    invitationForm.roleMasks = [];
  }

  function resetUserEditForm(): void {
    editingUser.value = null;
    userEditForm.name = "";
  }

  function resolveMemberAvatarUrl(memberInfo: MemberInfo): string | undefined {
    return resolveUserAvatarUrl(memberInfo.user);
  }

  function resolveUserDisplayName(userInfo: UserInfo | undefined): string {
    const normalizedName = userInfo?.name?.trim();

    return normalizedName && normalizedName.length > 0
      ? normalizedName
      : "未命名用户";
  }

  function resolveMemberDisplayName(memberInfo: MemberInfo): string {
    return resolveUserDisplayName(memberInfo.user);
  }

  async function refreshUserRelatedData(): Promise<void> {
    const tasks: Array<Promise<unknown>> = [loadUsers({ ensureAccess: false })];

    if (selectedTeamID.value) {
      tasks.push(loadSelectedTeamDetails(selectedTeamID.value));
    }

    await Promise.allSettled(tasks);
  }

  async function loadSelectedTeamDetails(teamID: string): Promise<void> {
    detailLoading.value = true;

    try {
      const [nextMembers, nextInvitations] = await Promise.all([
        getMemberList({
          team_id: teamID,
          offset: 0,
          limit: 200,
          includes: ["user"],
        }),
        getInvitationList({
          team_id: teamID,
          offset: 0,
          limit: 200,
          includes: ["invitor"],
        }),
      ]);

      members.value = nextMembers.map((memberInfo) => ({
        ...memberInfo,
        team: memberInfo.team ?? selectedTeamInfo.value ?? undefined,
      }));
      invitations.value = nextInvitations;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "团队明细加载失败";
      message.error(errorMessage);
      throw error;
    } finally {
      detailLoading.value = false;
    }
  }

  async function loadTeams(options?: {
    preferredTeamID?: string;
    ensureAccess?: boolean;
  }): Promise<void> {
    teamsLoading.value = true;

    try {
      if (options?.ensureAccess ?? true) {
        await ensureSuperAdminLoaded();
      }

      const nextTeams = await getTeamList({
        offset: 0,
        limit: 200,
      });

      teams.value = nextTeams;
      selectedTeamID.value = resolvePreferredTeamID(
        nextTeams,
        options?.preferredTeamID,
      );
      if (selectedTeamID.value) {
        authStore.setCurrentTeamId(selectedTeamID.value);
      } else {
        authStore.clearCurrentTeamId();
      }

      if (selectedTeamID.value) {
        await loadSelectedTeamDetails(selectedTeamID.value);
      } else {
        members.value = [];
        invitations.value = [];
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "团队列表加载失败";
      message.error(errorMessage);
      throw error;
    } finally {
      teamsLoading.value = false;
    }
  }

  async function loadUsers(options?: {
    ensureAccess?: boolean;
  }): Promise<void> {
    usersLoading.value = true;

    try {
      if (options?.ensureAccess ?? true) {
        await ensureSuperAdminLoaded();
      }

      users.value = await getUserList({
        offset: 0,
        limit: 200,
        search: userSearchKeyword.value.trim() || undefined,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "用户列表加载失败";
      message.error(errorMessage);
      throw error;
    } finally {
      usersLoading.value = false;
    }
  }

  async function initializeSuperAdminView(): Promise<void> {
    try {
      await ensureSuperAdminLoaded();
      await Promise.allSettled([
        loadTeams({ ensureAccess: false }),
        loadUsers({ ensureAccess: false }),
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "超级管理员页面初始化失败";
      message.error(errorMessage);
    }
  }

  async function refreshAllData(showSuccessMessage = true): Promise<void> {
    try {
      await ensureSuperAdminLoaded();
      const results = await Promise.allSettled([
        loadTeams({
          preferredTeamID: selectedTeamID.value,
          ensureAccess: false,
        }),
        loadUsers({ ensureAccess: false }),
      ]);

      if (
        showSuccessMessage &&
        results.every((result) => result.status === "fulfilled")
      ) {
        message.success("超级管理员数据已刷新");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "超级管理员数据刷新失败";
      message.error(errorMessage);
    }
  }

  function handleRefreshClick(): void {
    void refreshAllData();
  }

  function handleTeamSelect(teamID: string): void {
    if (teamID === selectedTeamID.value) {
      return;
    }

    selectedTeamID.value = teamID;
    authStore.setCurrentTeamId(teamID);
    void loadSelectedTeamDetails(teamID);
  }

  function openTeamCreateModal(): void {
    resetTeamCreateForm();
    isTeamCreateModalOpen.value = true;
  }

  function handleTeamCreateModalCancel(): void {
    isTeamCreateModalOpen.value = false;
    resetTeamCreateForm();
  }

  async function handleTeamCreateModalSubmit(): Promise<void> {
    const normalizedTeamName = teamCreateForm.name.trim();
    const normalizedDescription = teamCreateForm.description.trim();

    if (normalizedTeamName.length === 0) {
      message.warning("请输入团队名称");
      return;
    }

    teamCreateSubmitting.value = true;

    try {
      const createTeamResult = await createTeam({
        name: normalizedTeamName,
        description: normalizedDescription || undefined,
      });

      isTeamCreateModalOpen.value = false;
      resetTeamCreateForm();
      await loadTeams({ preferredTeamID: createTeamResult.id });
      message.success("团队已创建");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "团队创建失败";
      message.error(errorMessage);
    } finally {
      teamCreateSubmitting.value = false;
    }
  }

  function openInvitationCreateModal(): void {
    if (!selectedTeamID.value) {
      message.warning("请先选择要操作的团队");
      return;
    }

    resetInvitationForm();
    isInvitationModalOpen.value = true;
  }

  function handleInvitationModalCancel(): void {
    isInvitationModalOpen.value = false;
    resetInvitationForm();
  }

  async function handleInvitationModalSubmit(): Promise<void> {
    if (!selectedTeamID.value) {
      message.warning("请先选择团队");
      return;
    }

    const normalizedInviteeQq = invitationForm.inviteeQq.trim();
    const encodedRoles = encodeRoleMask(invitationForm.roleMasks);

    if (normalizedInviteeQq.length === 0) {
      message.warning("请输入被邀请人的 QQ 号");
      return;
    }

    if (encodedRoles === 0) {
      message.warning("请至少选择一个团队内角色");
      return;
    }

    invitationSubmitting.value = true;

    try {
      await createInvitation({
        team_id: selectedTeamID.value,
        invitee_qq: normalizedInviteeQq,
        roles: encodedRoles,
      });

      isInvitationModalOpen.value = false;
      resetInvitationForm();
      await loadSelectedTeamDetails(selectedTeamID.value);
      message.success("邀请码已创建");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "邀请码创建失败";
      message.error(errorMessage);
    } finally {
      invitationSubmitting.value = false;
    }
  }

  function handleUserSearchKeywordChange(nextKeyword: string): void {
    userSearchKeyword.value = nextKeyword;

    if (nextKeyword.trim().length === 0) {
      void loadUsers();
    }
  }

  function handleUserSearch(): void {
    void loadUsers();
  }

  function openUserEditModal(userInfo: UserInfo): void {
    editingUser.value = userInfo;
    userEditForm.name = resolveUserDisplayName(userInfo);
    isUserEditModalOpen.value = true;
  }

  function handleUserEditModalCancel(): void {
    isUserEditModalOpen.value = false;
    resetUserEditForm();
  }

  async function handleUserEditModalSubmit(): Promise<void> {
    if (!editingUser.value) {
      message.warning("请选择要编辑的用户");
      return;
    }

    const normalizedName = userEditForm.name.trim();
    const targetUser = editingUser.value;
    const currentDisplayName = resolveUserDisplayName(targetUser);

    if (normalizedName.length < 2 || normalizedName.length > 20) {
      message.warning("昵称长度需要在 2 到 20 个字符之间");
      return;
    }

    if (normalizedName === currentDisplayName) {
      message.info("当前没有需要保存的昵称变更");
      return;
    }

    userEditSubmitting.value = true;

    try {
      await updateUserProfile(targetUser.id, {
        name: normalizedName,
      });

      if (currentUser.value?.id === targetUser.id) {
        await authStore.refreshCurrentUserProfile();
        window.dispatchEvent(new CustomEvent(USER_PROFILE_UPDATED_EVENT));
      }

      await refreshUserRelatedData();
      isUserEditModalOpen.value = false;
      resetUserEditForm();
      message.success("用户昵称已更新");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "用户昵称更新失败";
      message.error(errorMessage);
    } finally {
      userEditSubmitting.value = false;
    }
  }

  function canDeleteUser(userInfo: UserInfo): boolean {
    return userInfo.id !== currentUser.value?.id;
  }

  async function handleDeleteUser(userInfo: UserInfo): Promise<void> {
    if (!canDeleteUser(userInfo)) {
      message.warning("不能删除当前登录账号");
      return;
    }

    deletingUserID.value = userInfo.id;

    try {
      await deleteUser(userInfo.id);

      if (editingUser.value?.id === userInfo.id) {
        isUserEditModalOpen.value = false;
        resetUserEditForm();
      }

      await refreshUserRelatedData();
      message.success("用户已删除");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "用户删除失败";
      message.error(errorMessage);
    } finally {
      if (deletingUserID.value === userInfo.id) {
        deletingUserID.value = undefined;
      }
    }
  }

  async function handleCopyInvitationCode(
    invitationCode: string,
  ): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invitationCode);
      } else {
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = invitationCode;
        tempTextArea.style.position = "fixed";
        tempTextArea.style.opacity = "0";
        document.body.appendChild(tempTextArea);
        tempTextArea.focus();
        tempTextArea.select();
        document.execCommand("copy");
        document.body.removeChild(tempTextArea);
      }

      message.success("邀请码已复制到剪贴板");
    } catch {
      message.error("复制邀请码失败，请手动复制");
    }
  }

  onMounted(() => {
    void initializeSuperAdminView();
  });

  return {
    ROLE_CONFIG,
    ADMIN_ROLE_MASK,
    currentUser,
    currentUserProfileLoading,
    teamsLoading,
    usersLoading,
    detailLoading,
    teamCreateSubmitting,
    invitationSubmitting,
    userEditSubmitting,
    deletingUserID,
    teams,
    users,
    members,
    invitations,
    selectedTeamID,
    userSearchKeyword,
    isTeamCreateModalOpen,
    isInvitationModalOpen,
    isUserEditModalOpen,
    editingUser,
    teamCreateForm,
    invitationForm,
    userEditForm,
    selectedTeamInfo,
    hasSelectedTeam,
    teamCount,
    userCount,
    selectedTeamMemberCount,
    selectedTeamInvitationCount,
    selectedTeamPendingInvitationCount,
    selectedTeamAdminCount,
    pageLoading,
    roleCheckboxOptions,
    formatTimestamp,
    resolveDisplayInitial,
    resolveRoleEntries,
    resolveTeamAvatarUrl,
    resolveUserAvatarUrl,
    resolveMemberAvatarUrl,
    resolveUserDisplayName,
    resolveMemberDisplayName,
    refreshAllData,
    handleRefreshClick,
    handleTeamSelect,
    openTeamCreateModal,
    handleTeamCreateModalCancel,
    handleTeamCreateModalSubmit,
    openInvitationCreateModal,
    handleInvitationModalCancel,
    handleInvitationModalSubmit,
    handleUserSearchKeywordChange,
    handleUserSearch,
    openUserEditModal,
    handleUserEditModalCancel,
    handleUserEditModalSubmit,
    canDeleteUser,
    handleDeleteUser,
    handleCopyInvitationCode,
  };
}

export type SuperAdminViewContext = ReturnType<
  typeof createSuperAdminViewState
>;

export function useSuperAdminView(): SuperAdminViewContext {
  return createSuperAdminViewState();
}
