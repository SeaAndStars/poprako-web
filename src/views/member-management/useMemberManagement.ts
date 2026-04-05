import {
  computed,
  inject,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
  type InjectionKey,
} from "vue";
import { Modal, message } from "ant-design-vue";
import { storeToRefs } from "pinia";
import {
  confirmTeamAvatarUploaded,
  createInvitation,
  createMember,
  createTeam,
  deleteTeam,
  deleteInvitation,
  deleteMember,
  getInvitationList,
  getMemberList,
  getMyTeams,
  joinTeam,
  reserveTeamAvatar,
  updateInvitation,
  updateMemberRole,
} from "../../api/modules";
import {
  resolveImageFileExtension,
  uploadFileToPresignedPutUrl,
} from "../../api/objectStorage";
import { useAvatarDisplayUrl } from "../../composables/useAvatarDisplayUrl";
import { useAuthStore } from "../../stores/auth";
import type { InvitationInfo, MemberInfo, TeamInfo } from "../../types/domain";

export type InvitationModalMode = "create" | "edit";
export type MemberModalMode = "create" | "edit";

export interface RoleConfigItem {
  mask: number;
  label: string;
  color: string;
}

const ADMIN_ROLE_MASK = 64;

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

function decodeRoleMask(roleMask: number | undefined): number[] {
  return ROLE_CONFIG.filter((roleInfo) => hasRole(roleMask, roleInfo.mask)).map(
    (roleInfo) => roleInfo.mask,
  );
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

function createMemberManagementState() {
  const authStore = useAuthStore();
  const {
    currentUserProfile: currentUser,
    currentUserProfileLoading: currentUserLoading,
  } = storeToRefs(authStore);
  const teamsLoading = ref(false);
  const detailLoading = ref(false);
  const teamCreateSubmitting = ref(false);
  const invitationSubmitting = ref(false);
  const memberSubmitting = ref(false);
  const joinSubmitting = ref(false);
  const teamDeleteSubmitting = ref(false);
  const teamAvatarSubmitting = ref(false);

  const teams = ref<TeamInfo[]>([]);
  const invitations = ref<InvitationInfo[]>([]);
  const members = ref<MemberInfo[]>([]);

  const selectedTeamID = ref<string | undefined>(undefined);
  const memberSearchKeyword = ref("");
  const selectedTeamAvatarFile = ref<File | null>(null);
  const teamAvatarResetToken = ref(0);

  const isTeamCreateModalOpen = ref(false);
  const isJoinTeamModalOpen = ref(false);
  const isInvitationCenterModalOpen = ref(false);
  const isTeamSettingsModalOpen = ref(false);
  const isInvitationModalOpen = ref(false);
  const isMemberModalOpen = ref(false);
  const isTeamDeleteModalOpen = ref(false);
  const invitationModalMode = ref<InvitationModalMode>("create");
  const memberModalMode = ref<MemberModalMode>("create");

  const editingInvitationRecord = ref<InvitationInfo | null>(null);
  const editingMemberRecord = ref<MemberInfo | null>(null);

  const teamAvatarCacheBustTokens = reactive<Record<string, number>>({});

  const teamCreateForm = reactive({
    name: "",
    description: "",
  });

  const invitationForm = reactive({
    inviteeQq: "",
    roleMasks: [] as number[],
  });

  const memberForm = reactive({
    userID: "",
    roleMasks: [] as number[],
  });

  const joinTeamForm = reactive({
    invitationCode: "",
  });

  const teamDeleteForm = reactive({
    confirmationText: "",
  });
  const {
    resolveTeamAvatarUrl: resolveDisplayTeamAvatarUrl,
    resolveUserAvatarUrl,
  } = useAvatarDisplayUrl();

  const pageLoading = computed(() => {
    return (
      currentUserLoading.value || teamsLoading.value || detailLoading.value
    );
  });

  const hasSelectedTeam = computed(() => Boolean(selectedTeamID.value));

  const selectedTeamInfo = computed(() => {
    return (
      teams.value.find((teamInfo) => teamInfo.id === selectedTeamID.value) ||
      null
    );
  });

  const teamSelectOptions = computed(() => {
    return teams.value.map((teamInfo) => ({
      label: teamInfo.name,
      value: teamInfo.id,
    }));
  });

  const roleCheckboxOptions = computed(() => {
    return ROLE_CONFIG.map((roleInfo) => ({
      label: roleInfo.label,
      value: roleInfo.mask,
    }));
  });

  const selectedTeamMember = computed(() => {
    if (!currentUser.value) {
      return null;
    }

    return (
      members.value.find(
        (memberInfo) => memberInfo.user_id === currentUser.value?.id,
      ) || null
    );
  });

  const isSelectedTeamAdmin = computed(() => {
    if (!hasSelectedTeam.value) {
      return false;
    }

    if (currentUser.value?.is_super_admin) {
      return true;
    }

    return hasRole(selectedTeamMember.value?.roles, ADMIN_ROLE_MASK);
  });

  const canAccessAdminArea = computed(() => {
    return hasSelectedTeam.value && isSelectedTeamAdmin.value;
  });

  const pendingInvitationCount = computed(() => {
    return invitations.value.filter((invitationInfo) => invitationInfo.pending)
      .length;
  });

  const adminMemberCount = computed(() => {
    return members.value.filter((memberInfo) => {
      return hasRole(memberInfo.roles, ADMIN_ROLE_MASK);
    }).length;
  });

  const hasActiveMemberSearch = computed(() => {
    return memberSearchKeyword.value.trim().length > 0;
  });

  const filteredMembers = computed(() => {
    const normalizedKeyword = memberSearchKeyword.value.trim().toLowerCase();

    if (normalizedKeyword.length === 0) {
      return members.value;
    }

    return members.value.filter((memberInfo) => {
      const displayName = memberInfo.user?.name?.trim().toLowerCase() || "";
      const qq = memberInfo.user?.qq?.trim().toLowerCase() || "";

      return (
        displayName.includes(normalizedKeyword) ||
        qq.includes(normalizedKeyword)
      );
    });
  });

  const memberSearchResultCount = computed(() => filteredMembers.value.length);

  function resolveTeamAvatarUrl(teamInfo: TeamInfo): string | undefined {
    return resolveDisplayTeamAvatarUrl(
      teamInfo,
      teamAvatarCacheBustTokens[teamInfo.id] || teamInfo.updated_at,
    );
  }

  function resolveMemberAvatarUrl(memberInfo: MemberInfo): string | undefined {
    return resolveUserAvatarUrl(memberInfo.user);
  }

  function resetTeamAvatarSelection(): void {
    selectedTeamAvatarFile.value = null;
    teamAvatarResetToken.value += 1;
  }

  function resetTeamCreateForm(): void {
    teamCreateForm.name = "";
    teamCreateForm.description = "";
  }

  function handleTeamAvatarFileChange(nextAvatarFile: File | null): void {
    selectedTeamAvatarFile.value = nextAvatarFile;
  }

  function clearCurrentTeamDetails(): void {
    invitations.value = [];
    members.value = [];
    memberSearchKeyword.value = "";
    resetTeamAvatarSelection();
  }

  function setMemberSearchKeyword(nextKeyword: string): void {
    memberSearchKeyword.value = nextKeyword;
  }

  function clearMemberSearchKeyword(): void {
    memberSearchKeyword.value = "";
  }

  function resetInvitationForm(): void {
    invitationForm.inviteeQq = "";
    invitationForm.roleMasks = [];
    editingInvitationRecord.value = null;
  }

  function resetMemberForm(): void {
    memberForm.userID = "";
    memberForm.roleMasks = [];
    editingMemberRecord.value = null;
  }

  function resetJoinTeamForm(): void {
    joinTeamForm.invitationCode = "";
  }

  function resetTeamDeleteForm(): void {
    teamDeleteForm.confirmationText = "";
  }

  async function ensureCurrentUserLoaded(): Promise<void> {
    if (currentUser.value) {
      return;
    }

    await authStore.ensureCurrentUserProfileLoaded();
  }

  function requireSelectedTeam(): boolean {
    if (!selectedTeamID.value) {
      message.warning("请先选择要管理的团队");
      return false;
    }

    return true;
  }

  function requireAdminAccess(): boolean {
    if (!requireSelectedTeam()) {
      return false;
    }

    if (!canAccessAdminArea.value) {
      message.warning("只有当前团队管理员可以执行该操作");
      return false;
    }

    return true;
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

  async function loadSelectedTeamDetails(
    teamID: string,
    showSuccessMessage = false,
  ): Promise<void> {
    detailLoading.value = true;

    try {
      await ensureCurrentUserLoaded();

      const nextMembers = await getMemberList({
        team_id: teamID,
        offset: 0,
        limit: 200,
        includes: ["user"],
      });

      let nextInvitations: InvitationInfo[] = [];

      const currentMember = nextMembers.find(
        (m) => m.user_id === currentUser.value?.id,
      );
      const isSuperAdmin = currentUser.value?.is_super_admin ?? false;
      const isAdminForTeam =
        isSuperAdmin || hasRole(currentMember?.roles, ADMIN_ROLE_MASK);

      if (isAdminForTeam) {
        try {
          nextInvitations = await getInvitationList({
            team_id: teamID,
            offset: 0,
            limit: 200,
            includes: ["invitor"],
          });
        } catch (invitationError) {
          console.warn("未能获取邀请码列表", invitationError);
        }
      }

      invitations.value = nextInvitations;
      members.value = nextMembers.map((memberInfo) => ({
        ...memberInfo,
        team: memberInfo.team ?? selectedTeamInfo.value ?? undefined,
      }));

      if (showSuccessMessage) {
        message.success("当前团队管理数据已刷新");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "团队管理数据加载失败";
      message.error(errorMessage);
    } finally {
      detailLoading.value = false;
    }
  }

  async function refreshManagementData(
    showSuccessMessage = true,
    preferredTeamID?: string,
  ): Promise<void> {
    teamsLoading.value = true;

    try {
      const previousSelectedTeamID = selectedTeamID.value;
      const nextTeams = await getMyTeams({
        offset: 0,
        limit: 100,
      });

      teams.value = nextTeams;

      const nextSelectedTeamID = resolvePreferredTeamID(
        nextTeams,
        preferredTeamID,
      );

      if (previousSelectedTeamID !== nextSelectedTeamID) {
        memberSearchKeyword.value = "";
      }

      selectedTeamID.value = nextSelectedTeamID;
      if (nextSelectedTeamID) {
        authStore.setCurrentTeamId(nextSelectedTeamID);
      } else {
        authStore.clearCurrentTeamId();
      }

      if (nextSelectedTeamID) {
        await loadSelectedTeamDetails(nextSelectedTeamID, false);

        if (showSuccessMessage) {
          message.success("团队管理数据已刷新");
        }
      } else {
        clearCurrentTeamDetails();

        if (showSuccessMessage) {
          message.info("当前账号还没有可管理的团队");
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "团队列表加载失败";
      message.error(errorMessage);
    } finally {
      teamsLoading.value = false;
    }
  }

  function handleTeamChange(nextTeamID: string): void {
    resetTeamAvatarSelection();
    resetTeamDeleteForm();
    clearMemberSearchKeyword();
    selectedTeamID.value = nextTeamID;
    authStore.setCurrentTeamId(nextTeamID);
    void loadSelectedTeamDetails(nextTeamID);
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
      await refreshManagementData(false, createTeamResult.id);
      message.success("团队已创建");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "团队创建失败";
      message.error(errorMessage);
    } finally {
      teamCreateSubmitting.value = false;
    }
  }

  function openJoinTeamModal(): void {
    resetJoinTeamForm();
    isJoinTeamModalOpen.value = true;
  }

  function handleJoinTeamModalCancel(): void {
    isJoinTeamModalOpen.value = false;
    resetJoinTeamForm();
  }

  function openInvitationCenterModal(): void {
    if (!requireAdminAccess()) {
      return;
    }

    isInvitationCenterModalOpen.value = true;
  }

  function handleInvitationCenterModalCancel(): void {
    isInvitationCenterModalOpen.value = false;
  }

  function openTeamSettingsModal(): void {
    if (!requireAdminAccess()) {
      return;
    }

    isTeamSettingsModalOpen.value = true;
  }

  function handleTeamSettingsModalCancel(): void {
    isTeamSettingsModalOpen.value = false;
  }

  function openTeamDeleteModal(): void {
    if (!requireAdminAccess()) {
      return;
    }

    resetTeamDeleteForm();
    isTeamDeleteModalOpen.value = true;
  }

  function handleTeamDeleteModalCancel(): void {
    isTeamDeleteModalOpen.value = false;
    resetTeamDeleteForm();
  }

  async function handleTeamDeleteModalSubmit(): Promise<void> {
    if (!requireAdminAccess() || !selectedTeamInfo.value) {
      return;
    }

    const normalizedConfirmationText = teamDeleteForm.confirmationText.trim();

    if (normalizedConfirmationText !== selectedTeamInfo.value.name) {
      message.warning(`请输入团队名“${selectedTeamInfo.value.name}”以确认删除`);
      return;
    }

    teamDeleteSubmitting.value = true;

    try {
      const deletingTeamID = selectedTeamInfo.value.id;
      const fallbackTeamID = teams.value.find(
        (teamInfo) => teamInfo.id !== deletingTeamID,
      )?.id;

      await deleteTeam(deletingTeamID);

      isTeamSettingsModalOpen.value = false;
      isInvitationCenterModalOpen.value = false;
      isTeamDeleteModalOpen.value = false;
      resetTeamDeleteForm();
      await refreshManagementData(false, fallbackTeamID);
      message.success("团队已删除");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "团队删除失败";
      message.error(errorMessage);
    } finally {
      teamDeleteSubmitting.value = false;
    }
  }

  async function handleTeamAvatarUpload(): Promise<void> {
    if (
      !requireAdminAccess() ||
      !selectedTeamInfo.value ||
      !selectedTeamID.value
    ) {
      return;
    }

    if (!selectedTeamAvatarFile.value) {
      message.warning("请先选择并裁切团队头像");
      return;
    }

    teamAvatarSubmitting.value = true;

    try {
      const avatarContentType =
        selectedTeamAvatarFile.value.type || "application/octet-stream";
      const avatarExtension = resolveImageFileExtension(
        selectedTeamAvatarFile.value,
      );
      const reserveTeamAvatarResult = await reserveTeamAvatar(
        selectedTeamID.value,
        {
          extension: avatarExtension,
          content_type: avatarContentType,
        },
      );

      await uploadFileToPresignedPutUrl(
        reserveTeamAvatarResult.put_url,
        selectedTeamAvatarFile.value,
        avatarContentType,
      );
      await confirmTeamAvatarUploaded(selectedTeamID.value);

      teamAvatarCacheBustTokens[selectedTeamID.value] = Date.now();
      resetTeamAvatarSelection();
      await refreshManagementData(false, selectedTeamID.value);
      message.success("团队头像已更新");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "团队头像上传失败";
      message.error(errorMessage);
    } finally {
      teamAvatarSubmitting.value = false;
    }
  }

  function handleRefreshClick(): void {
    void refreshManagementData();
  }

  function openInvitationCreateModal(): void {
    if (!requireAdminAccess()) {
      return;
    }

    invitationModalMode.value = "create";
    resetInvitationForm();
    isInvitationModalOpen.value = true;
  }

  function openInvitationEditModal(invitationInfo: InvitationInfo): void {
    if (!requireAdminAccess()) {
      return;
    }

    invitationModalMode.value = "edit";
    editingInvitationRecord.value = invitationInfo;
    invitationForm.inviteeQq = invitationInfo.invitee_qq;
    invitationForm.roleMasks = decodeRoleMask(invitationInfo.roles);
    isInvitationModalOpen.value = true;
  }

  function handleInvitationModalCancel(): void {
    isInvitationModalOpen.value = false;
    resetInvitationForm();
  }

  async function handleInvitationModalSubmit(): Promise<void> {
    if (!requireAdminAccess() || !selectedTeamID.value) {
      return;
    }

    const normalizedInviteeQq = invitationForm.inviteeQq.trim();
    const encodedRoles = encodeRoleMask(invitationForm.roleMasks);

    if (
      invitationModalMode.value === "create" &&
      normalizedInviteeQq.length === 0
    ) {
      message.warning("请输入被邀请人的 QQ 号");
      return;
    }

    if (encodedRoles === 0) {
      message.warning("请至少选择一个角色");
      return;
    }

    invitationSubmitting.value = true;

    try {
      if (invitationModalMode.value === "create") {
        await createInvitation({
          team_id: selectedTeamID.value,
          invitee_qq: normalizedInviteeQq,
          roles: encodedRoles,
        });
        message.success("邀请码已创建");
      } else if (editingInvitationRecord.value) {
        await updateInvitation(editingInvitationRecord.value.id, {
          team_id: selectedTeamID.value,
          roles: encodedRoles,
        });
        message.success("邀请码角色已更新");
      }

      isInvitationModalOpen.value = false;
      resetInvitationForm();
      await loadSelectedTeamDetails(selectedTeamID.value, false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "邀请码保存失败";
      message.error(errorMessage);
    } finally {
      invitationSubmitting.value = false;
    }
  }

  function handleDeleteInvitation(invitationInfo: InvitationInfo): void {
    if (!requireAdminAccess()) {
      return;
    }

    Modal.confirm({
      title: "删除邀请码",
      content: `确认删除邀请码 ${invitationInfo.invitation_code} 吗？删除后将无法继续使用。`,
      okText: "确认删除",
      cancelText: "取消",
      async onOk() {
        try {
          await deleteInvitation(invitationInfo.id);
          message.success("邀请码已删除");

          if (selectedTeamID.value) {
            await loadSelectedTeamDetails(selectedTeamID.value, false);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "邀请码删除失败";
          message.error(errorMessage);
          throw error;
        }
      },
    });
  }

  function openMemberCreateModal(): void {
    if (!requireAdminAccess()) {
      return;
    }

    memberModalMode.value = "create";
    resetMemberForm();
    isMemberModalOpen.value = true;
  }

  function openMemberEditModal(memberInfo: MemberInfo): void {
    if (!requireAdminAccess()) {
      return;
    }

    memberModalMode.value = "edit";
    editingMemberRecord.value = memberInfo;
    memberForm.userID = memberInfo.user_id;
    memberForm.roleMasks = decodeRoleMask(memberInfo.roles);
    isMemberModalOpen.value = true;
  }

  function handleMemberModalCancel(): void {
    isMemberModalOpen.value = false;
    resetMemberForm();
  }

  async function handleMemberModalSubmit(): Promise<void> {
    if (!requireAdminAccess() || !selectedTeamID.value) {
      return;
    }

    const normalizedUserID = memberForm.userID.trim();
    const encodedRoles = encodeRoleMask(memberForm.roleMasks);

    if (normalizedUserID.length === 0) {
      message.warning("请输入目标用户的 user_id");
      return;
    }

    if (encodedRoles === 0) {
      message.warning("请至少选择一个角色");
      return;
    }

    memberSubmitting.value = true;

    try {
      if (memberModalMode.value === "create") {
        await createMember({
          team_id: selectedTeamID.value,
          user_id: normalizedUserID,
          roles: encodedRoles,
        });
        message.success("成员已添加");
      } else if (editingMemberRecord.value) {
        await updateMemberRole(editingMemberRecord.value.id, {
          roles: encodedRoles,
        });
        message.success("成员角色已更新");
      }

      isMemberModalOpen.value = false;
      resetMemberForm();
      await loadSelectedTeamDetails(selectedTeamID.value, false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "成员信息保存失败";
      message.error(errorMessage);
    } finally {
      memberSubmitting.value = false;
    }
  }

  function handleDeleteMember(memberInfo: MemberInfo): void {
    if (!requireAdminAccess()) {
      return;
    }

    const memberDisplayName = memberInfo.user?.name || memberInfo.user_id;

    Modal.confirm({
      title: "删除成员",
      content: `确认把 ${memberDisplayName} 从当前团队移除吗？`,
      okText: "确认删除",
      cancelText: "取消",
      async onOk() {
        try {
          await deleteMember(memberInfo.id);
          message.success("成员已删除");

          if (selectedTeamID.value) {
            await loadSelectedTeamDetails(selectedTeamID.value, false);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "成员删除失败";
          message.error(errorMessage);
          throw error;
        }
      },
    });
  }

  async function handleJoinTeamSubmit(): Promise<void> {
    const normalizedInvitationCode = joinTeamForm.invitationCode.trim();

    if (normalizedInvitationCode.length === 0) {
      message.warning("请输入邀请码");
      return;
    }

    joinSubmitting.value = true;

    try {
      const existingTeamIDs = new Set(
        teams.value.map((teamInfo) => teamInfo.id),
      );

      await joinTeam({
        invitation_code: normalizedInvitationCode,
      });

      const nextTeams = await getMyTeams({
        offset: 0,
        limit: 100,
      });
      const joinedTeamID = nextTeams.find((teamInfo) => {
        return !existingTeamIDs.has(teamInfo.id);
      })?.id;

      teams.value = nextTeams;
      selectedTeamID.value = resolvePreferredTeamID(nextTeams, joinedTeamID);
      if (selectedTeamID.value) {
        authStore.setCurrentTeamId(selectedTeamID.value);
      } else {
        authStore.clearCurrentTeamId();
      }
      clearMemberSearchKeyword();

      if (selectedTeamID.value) {
        await loadSelectedTeamDetails(selectedTeamID.value, false);
      } else {
        clearCurrentTeamDetails();
      }

      isJoinTeamModalOpen.value = false;
      resetJoinTeamForm();
      message.success("已加入新的团队");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "加入团队失败";
      message.error(errorMessage);
    } finally {
      joinSubmitting.value = false;
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

  watch(canAccessAdminArea, (hasAdminAccess) => {
    if (hasAdminAccess) {
      return;
    }

    isInvitationCenterModalOpen.value = false;
    isTeamSettingsModalOpen.value = false;
    isInvitationModalOpen.value = false;
    isMemberModalOpen.value = false;
    isTeamDeleteModalOpen.value = false;
  });

  return {
    ROLE_CONFIG,
    ADMIN_ROLE_MASK,
    currentUser,
    currentUserLoading,
    teamsLoading,
    detailLoading,
    teamCreateSubmitting,
    invitationSubmitting,
    memberSubmitting,
    joinSubmitting,
    teamDeleteSubmitting,
    teamAvatarSubmitting,
    teams,
    invitations,
    members,
    selectedTeamID,
    selectedTeamAvatarFile,
    teamAvatarResetToken,
    isTeamCreateModalOpen,
    isJoinTeamModalOpen,
    isInvitationCenterModalOpen,
    isTeamSettingsModalOpen,
    isInvitationModalOpen,
    isMemberModalOpen,
    isTeamDeleteModalOpen,
    invitationModalMode,
    memberModalMode,
    editingInvitationRecord,
    editingMemberRecord,
    teamCreateForm,
    invitationForm,
    memberForm,
    joinTeamForm,
    teamDeleteForm,
    pageLoading,
    hasSelectedTeam,
    selectedTeamInfo,
    teamSelectOptions,
    roleCheckboxOptions,
    selectedTeamMember,
    isSelectedTeamAdmin,
    canAccessAdminArea,
    pendingInvitationCount,
    adminMemberCount,
    memberSearchKeyword,
    hasActiveMemberSearch,
    filteredMembers,
    memberSearchResultCount,
    formatTimestamp,
    resolveRoleEntries,
    resolveTeamAvatarUrl,
    resolveMemberAvatarUrl,
    ensureCurrentUserLoaded,
    refreshManagementData,
    setMemberSearchKeyword,
    clearMemberSearchKeyword,
    handleTeamChange,
    openTeamCreateModal,
    handleTeamCreateModalCancel,
    handleTeamCreateModalSubmit,
    openJoinTeamModal,
    handleJoinTeamModalCancel,
    openInvitationCenterModal,
    handleInvitationCenterModalCancel,
    openTeamSettingsModal,
    handleTeamSettingsModalCancel,
    handleTeamAvatarFileChange,
    handleTeamAvatarUpload,
    handleRefreshClick,
    openInvitationCreateModal,
    openInvitationEditModal,
    handleInvitationModalCancel,
    handleInvitationModalSubmit,
    handleDeleteInvitation,
    openMemberCreateModal,
    openMemberEditModal,
    handleMemberModalCancel,
    handleMemberModalSubmit,
    handleDeleteMember,
    openTeamDeleteModal,
    handleTeamDeleteModalCancel,
    handleTeamDeleteModalSubmit,
    handleJoinTeamSubmit,
    handleCopyInvitationCode,
  };
}

export type MemberManagementContext = ReturnType<
  typeof createMemberManagementState
>;

const memberManagementContextKey: InjectionKey<MemberManagementContext> =
  Symbol("member-management");

export function useMemberManagement(): MemberManagementContext {
  const state = createMemberManagementState();

  onMounted(() => {
    void Promise.allSettled([
      state.refreshManagementData(false),
      state.ensureCurrentUserLoaded().catch((error) => {
        const errorMessage =
          error instanceof Error ? error.message : "当前用户信息加载失败";
        message.error(errorMessage);
      }),
    ]);
  });

  return state;
}

export function provideMemberManagement(
  context: MemberManagementContext,
): void {
  provide(memberManagementContextKey, context);
}

export function useMemberManagementContext(): MemberManagementContext {
  const context = inject(memberManagementContextKey);

  if (!context) {
    throw new Error("member management context is not available");
  }

  return context;
}
