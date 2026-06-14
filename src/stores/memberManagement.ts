/**
 * 文件用途：团队管理页状态，包含团队切换、成员/邀请码 CRUD、模态框与头像上传逻辑。
 */

import { computed, reactive, ref, watch } from "vue";
import { Modal, message } from "ant-design-vue";
import { defineStore } from "pinia";
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
} from "../api/modules";
import {
  resolveImageFileExtension,
  uploadFileToPresignedPutUrl,
} from "../api/objectStorage";
import { useAvatarDisplayUrl } from "../composables/useAvatarDisplayUrl";
import { useAuthStore } from "./auth";
import type { InvitationInfo, MemberInfo, TeamInfo } from "../types/domain";

/** 邀请码模态框模式。 */
export type InvitationModalMode = "create" | "edit";

/** 成员模态框模式。 */
export type MemberModalMode = "create" | "edit";

/** 角色配置项。 */
export interface RoleConfigItem {
  /** 角色位掩码。 */
  mask: number;
  /** 角色展示标签。 */
  label: string;
  /** 标签颜色。 */
  color: string;
}

/** 管理员角色位掩码。 */
const ADMIN_ROLE_MASK = 64;

/** 角色配置表。 */
const ROLE_CONFIG: readonly RoleConfigItem[] = [
  { mask: 1, label: "图源", color: "magenta" },
  { mask: 2, label: "翻译", color: "blue" },
  { mask: 4, label: "校对", color: "purple" },
  { mask: 8, label: "嵌字", color: "cyan" },
  { mask: 16, label: "监修", color: "orange" },
  { mask: 32, label: "发布", color: "green" },
  { mask: 64, label: "管理", color: "gold" },
] as const;

/**
 * 判断角色掩码是否包含指定角色。
 */
function hasRole(roleMask: number | undefined, roleFlag: number): boolean {
  if (typeof roleMask !== "number") {
    return false;
  }

  return (roleMask & roleFlag) !== 0;
}

/**
 * 将角色掩码解码为角色位数组。
 */
function decodeRoleMask(roleMask: number | undefined): number[] {
  return ROLE_CONFIG.filter((roleInfo) => hasRole(roleMask, roleInfo.mask)).map(
    (roleInfo) => roleInfo.mask,
  );
}

/**
 * 将角色位数组编码为角色掩码。
 */
function encodeRoleMask(roleMasks: number[]): number {
  return roleMasks.reduce((combinedMask, currentMask) => {
    return combinedMask | currentMask;
  }, 0);
}

/**
 * 解析角色掩码对应的角色配置项列表。
 */
function resolveRoleEntries(roleMask: number | undefined): RoleConfigItem[] {
  return ROLE_CONFIG.filter((roleInfo) => hasRole(roleMask, roleInfo.mask));
}

/**
 * 格式化时间戳为本地化字符串。
 */
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

export const useMemberManagementStore = defineStore("member-management", () => {
  const authStore = useAuthStore();
  const {
    currentUserProfile: currentUser,
    currentUserProfileLoading: currentUserLoading,
  } = storeToRefs(authStore);

  /** 团队列表加载中。 */
  const teamsLoading = ref(false);
  /** 当前团队详情加载中。 */
  const detailLoading = ref(false);
  /** 创建团队提交中。 */
  const teamCreateSubmitting = ref(false);
  /** 邀请码提交中。 */
  const invitationSubmitting = ref(false);
  /** 成员提交中。 */
  const memberSubmitting = ref(false);
  /** 加入团队提交中。 */
  const joinSubmitting = ref(false);
  /** 删除团队提交中。 */
  const teamDeleteSubmitting = ref(false);
  /** 团队头像上传提交中。 */
  const teamAvatarSubmitting = ref(false);

  /** 当前账号可管理的团队列表。 */
  const teams = ref<TeamInfo[]>([]);
  /** 当前团队的邀请码列表。 */
  const invitations = ref<InvitationInfo[]>([]);
  /** 当前团队的成员列表。 */
  const members = ref<MemberInfo[]>([]);

  /** 当前选中的团队 ID。 */
  const selectedTeamID = ref<string | undefined>(undefined);
  /** 成员搜索关键词。 */
  const memberSearchKeyword = ref("");
  /** 待上传的团队头像文件。 */
  const selectedTeamAvatarFile = ref<File | null>(null);
  /** 团队头像上传组件重置令牌。 */
  const teamAvatarResetToken = ref(0);

  /** 创建团队模态框是否打开。 */
  const isTeamCreateModalOpen = ref(false);
  /** 加入团队模态框是否打开。 */
  const isJoinTeamModalOpen = ref(false);
  /** 邀请码中心模态框是否打开。 */
  const isInvitationCenterModalOpen = ref(false);
  /** 团队设置模态框是否打开。 */
  const isTeamSettingsModalOpen = ref(false);
  /** 邀请码编辑模态框是否打开。 */
  const isInvitationModalOpen = ref(false);
  /** 成员编辑模态框是否打开。 */
  const isMemberModalOpen = ref(false);
  /** 删除团队模态框是否打开。 */
  const isTeamDeleteModalOpen = ref(false);
  /** 邀请码模态框模式。 */
  const invitationModalMode = ref<InvitationModalMode>("create");
  /** 成员模态框模式。 */
  const memberModalMode = ref<MemberModalMode>("create");

  /** 正在编辑的邀请码记录。 */
  const editingInvitationRecord = ref<InvitationInfo | null>(null);
  /** 正在编辑的成员记录。 */
  const editingMemberRecord = ref<MemberInfo | null>(null);

  /** 团队头像缓存破坏令牌，按团队 ID 索引。 */
  const teamAvatarCacheBustTokens = reactive<Record<string, number>>({});

  /** 创建团队表单。 */
  const teamCreateForm = reactive({
    /** 团队名称。 */
    name: "",
    /** 团队简介。 */
    description: "",
  });

  /** 邀请码表单。 */
  const invitationForm = reactive({
    /** 被邀请人 QQ。 */
    inviteeQq: "",
    /** 授予角色位掩码列表。 */
    roleMasks: [] as number[],
  });

  /** 成员表单。 */
  const memberForm = reactive({
    /** 目标用户 ID。 */
    userID: "",
    /** 授予角色位掩码列表。 */
    roleMasks: [] as number[],
  });

  /** 加入团队表单。 */
  const joinTeamForm = reactive({
    /** 邀请码。 */
    invitationCode: "",
  });

  /** 删除团队确认表单。 */
  const teamDeleteForm = reactive({
    /** 确认输入的团队名称。 */
    confirmationText: "",
  });

  const {
    resolveTeamAvatarUrl: resolveDisplayTeamAvatarUrl,
    resolveUserAvatarUrl,
  } = useAvatarDisplayUrl();

  /** 页面整体加载中（用户/团队/详情）。 */
  const pageLoading = computed(() => {
    return (
      currentUserLoading.value || teamsLoading.value || detailLoading.value
    );
  });

  /** 是否已选择团队。 */
  const hasSelectedTeam = computed(() => Boolean(selectedTeamID.value));

  /** 当前选中的团队信息。 */
  const selectedTeamInfo = computed(() => {
    return (
      teams.value.find((teamInfo) => teamInfo.id === selectedTeamID.value) ||
      null
    );
  });

  /** 团队切换下拉选项。 */
  const teamSelectOptions = computed(() => {
    return teams.value.map((teamInfo) => ({
      label: teamInfo.name,
      value: teamInfo.id,
    }));
  });

  /** 角色复选框选项。 */
  const roleCheckboxOptions = computed(() => {
    return ROLE_CONFIG.map((roleInfo) => ({
      label: roleInfo.label,
      value: roleInfo.mask,
    }));
  });

  /** 当前用户在选中团队中的成员记录。 */
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

  /** 当前用户是否为选中团队管理员。 */
  const isSelectedTeamAdmin = computed(() => {
    if (!hasSelectedTeam.value) {
      return false;
    }

    if (currentUser.value?.is_super_admin) {
      return true;
    }

    return hasRole(selectedTeamMember.value?.roles, ADMIN_ROLE_MASK);
  });

  /** 是否可访问管理员区域。 */
  const canAccessAdminArea = computed(() => {
    return hasSelectedTeam.value && isSelectedTeamAdmin.value;
  });

  /** 待处理邀请码数量。 */
  const pendingInvitationCount = computed(() => {
    return invitations.value.filter((invitationInfo) => invitationInfo.pending)
      .length;
  });

  /** 管理员成员数量。 */
  const adminMemberCount = computed(() => {
    return members.value.filter((memberInfo) => {
      return hasRole(memberInfo.roles, ADMIN_ROLE_MASK);
    }).length;
  });

  /** 是否正在搜索成员。 */
  const hasActiveMemberSearch = computed(() => {
    return memberSearchKeyword.value.trim().length > 0;
  });

  /** 按关键词过滤后的成员列表。 */
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

  /** 成员搜索结果数量。 */
  const memberSearchResultCount = computed(() => filteredMembers.value.length);

  /**
   * 解析团队头像展示 URL。
   */
  function resolveTeamAvatarUrl(teamInfo: TeamInfo): string | undefined {
    return resolveDisplayTeamAvatarUrl(
      teamInfo,
      teamAvatarCacheBustTokens[teamInfo.id] || teamInfo.updated_at,
    );
  }

  /**
   * 解析成员头像展示 URL。
   */
  function resolveMemberAvatarUrl(memberInfo: MemberInfo): string | undefined {
    return resolveUserAvatarUrl(memberInfo.user);
  }

  /**
   * 重置团队头像选择状态。
   */
  function resetTeamAvatarSelection(): void {
    selectedTeamAvatarFile.value = null;
    teamAvatarResetToken.value += 1;
  }

  /**
   * 重置创建团队表单。
   */
  function resetTeamCreateForm(): void {
    teamCreateForm.name = "";
    teamCreateForm.description = "";
  }

  /**
   * 处理团队头像文件变更。
   */
  function handleTeamAvatarFileChange(nextAvatarFile: File | null): void {
    selectedTeamAvatarFile.value = nextAvatarFile;
  }

  /**
   * 清空当前团队详情数据。
   */
  function clearCurrentTeamDetails(): void {
    invitations.value = [];
    members.value = [];
    memberSearchKeyword.value = "";
    resetTeamAvatarSelection();
  }

  /**
   * 设置成员搜索关键词。
   */
  function setMemberSearchKeyword(nextKeyword: string): void {
    memberSearchKeyword.value = nextKeyword;
  }

  /**
   * 清空成员搜索关键词。
   */
  function clearMemberSearchKeyword(): void {
    memberSearchKeyword.value = "";
  }

  /**
   * 重置邀请码表单。
   */
  function resetInvitationForm(): void {
    invitationForm.inviteeQq = "";
    invitationForm.roleMasks = [];
    editingInvitationRecord.value = null;
  }

  /**
   * 重置成员表单。
   */
  function resetMemberForm(): void {
    memberForm.userID = "";
    memberForm.roleMasks = [];
    editingMemberRecord.value = null;
  }

  /**
   * 重置加入团队表单。
   */
  function resetJoinTeamForm(): void {
    joinTeamForm.invitationCode = "";
  }

  /**
   * 重置删除团队确认表单。
   */
  function resetTeamDeleteForm(): void {
    teamDeleteForm.confirmationText = "";
  }

  /**
   * 确保当前用户资料已加载。
   */
  async function ensureCurrentUserLoaded(): Promise<void> {
    if (currentUser.value) {
      return;
    }

    await authStore.ensureCurrentUserProfileLoaded();
  }

  /**
   * 校验是否已选择团队。
   */
  function requireSelectedTeam(): boolean {
    if (!selectedTeamID.value) {
      message.warning("请先选择要管理的团队");
      return false;
    }

    return true;
  }

  /**
   * 校验是否拥有管理员权限。
   */
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

  /**
   * 解析优先选中的团队 ID。
   */
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

  /**
   * 加载选中团队的成员与邀请码详情。
   */
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

  /**
   * 刷新团队管理数据（团队列表 + 当前团队详情）。
   */
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

  /**
   * 切换当前选中团队。
   */
  function handleTeamChange(nextTeamID: string): void {
    resetTeamAvatarSelection();
    resetTeamDeleteForm();
    clearMemberSearchKeyword();
    selectedTeamID.value = nextTeamID;
    authStore.setCurrentTeamId(nextTeamID);
    void loadSelectedTeamDetails(nextTeamID);
  }

  /**
   * 打开创建团队模态框。
   */
  function openTeamCreateModal(): void {
    resetTeamCreateForm();
    isTeamCreateModalOpen.value = true;
  }

  /**
   * 取消创建团队模态框。
   */
  function handleTeamCreateModalCancel(): void {
    isTeamCreateModalOpen.value = false;
    resetTeamCreateForm();
  }

  /**
   * 提交创建团队。
   */
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

  /**
   * 打开加入团队模态框。
   */
  function openJoinTeamModal(): void {
    resetJoinTeamForm();
    isJoinTeamModalOpen.value = true;
  }

  /**
   * 取消加入团队模态框。
   */
  function handleJoinTeamModalCancel(): void {
    isJoinTeamModalOpen.value = false;
    resetJoinTeamForm();
  }

  /**
   * 打开邀请码中心模态框。
   */
  function openInvitationCenterModal(): void {
    if (!requireAdminAccess()) {
      return;
    }

    isInvitationCenterModalOpen.value = true;
  }

  /**
   * 关闭邀请码中心模态框。
   */
  function handleInvitationCenterModalCancel(): void {
    isInvitationCenterModalOpen.value = false;
  }

  /**
   * 打开团队设置模态框。
   */
  function openTeamSettingsModal(): void {
    if (!requireAdminAccess()) {
      return;
    }

    isTeamSettingsModalOpen.value = true;
  }

  /**
   * 关闭团队设置模态框。
   */
  function handleTeamSettingsModalCancel(): void {
    isTeamSettingsModalOpen.value = false;
  }

  /**
   * 打开删除团队模态框。
   */
  function openTeamDeleteModal(): void {
    if (!requireAdminAccess()) {
      return;
    }

    resetTeamDeleteForm();
    isTeamDeleteModalOpen.value = true;
  }

  /**
   * 取消删除团队模态框。
   */
  function handleTeamDeleteModalCancel(): void {
    isTeamDeleteModalOpen.value = false;
    resetTeamDeleteForm();
  }

  /**
   * 提交删除团队。
   */
  async function handleTeamDeleteModalSubmit(): Promise<void> {
    if (!requireAdminAccess() || !selectedTeamInfo.value) {
      return;
    }

    const normalizedConfirmationText = teamDeleteForm.confirmationText.trim();

    if (normalizedConfirmationText !== selectedTeamInfo.value.name) {
      message.warning(`请输入团队名"${selectedTeamInfo.value.name}"以确认删除`);
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

  /**
   * 上传并保存团队头像。
   */
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

  /**
   * 点击刷新按钮。
   */
  function handleRefreshClick(): void {
    void refreshManagementData();
  }

  /**
   * 打开新建邀请码模态框。
   */
  function openInvitationCreateModal(): void {
    if (!requireAdminAccess()) {
      return;
    }

    invitationModalMode.value = "create";
    resetInvitationForm();
    isInvitationModalOpen.value = true;
  }

  /**
   * 打开编辑邀请码模态框。
   */
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

  /**
   * 取消邀请码模态框。
   */
  function handleInvitationModalCancel(): void {
    isInvitationModalOpen.value = false;
    resetInvitationForm();
  }

  /**
   * 提交邀请码创建或编辑。
   */
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

  /**
   * 删除邀请码（带确认弹窗）。
   */
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

  /**
   * 打开添加成员模态框。
   */
  function openMemberCreateModal(): void {
    if (!requireAdminAccess()) {
      return;
    }

    memberModalMode.value = "create";
    resetMemberForm();
    isMemberModalOpen.value = true;
  }

  /**
   * 打开编辑成员角色模态框。
   */
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

  /**
   * 取消成员模态框。
   */
  function handleMemberModalCancel(): void {
    isMemberModalOpen.value = false;
    resetMemberForm();
  }

  /**
   * 提交成员创建或编辑。
   */
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

  /**
   * 删除成员（带确认弹窗）。
   */
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

  /**
   * 提交加入团队。
   */
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

  /**
   * 复制邀请码到剪贴板。
   */
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
});
