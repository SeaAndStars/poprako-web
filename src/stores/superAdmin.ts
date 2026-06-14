/**
 * 文件用途：超级管理员控制台的状态管理与业务操作。
 * 负责团队总览、用户维护、成员与邀请码明细的加载与变更。
 */

import { computed, reactive, ref } from "vue";
import { defineStore } from "pinia";
import { message } from "ant-design-vue";
import {
  createInvitation,
  createTeam,
  deleteUser,
  getInvitationList,
  getMemberList,
  getTeamList,
  getUserList,
  updateUserProfile,
} from "../api/modules";
import { useAssetCacheStore } from "./assetCache";
import { useAuthStore } from "./auth";
import type {
  InvitationInfo,
  MemberInfo,
  TeamInfo,
  UserInfo,
} from "../types/domain";

/** 角色配置项，用于展示团队内分工标签。 */
interface RoleConfigItem {
  /** 角色位掩码值 */
  mask: number;
  /** 角色展示名称 */
  label: string;
  /** 标签颜色 */
  color: string;
}

/** 管理员角色位掩码 */
const ADMIN_ROLE_MASK = 64;
/** 用户资料更新后广播的事件名 */
const USER_PROFILE_UPDATED_EVENT = "poprako:user-profile-updated";

/** 团队内角色配置表 */
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
 * @param roleMask 用户或成员的角色掩码
 * @param roleFlag 待检测的角色位
 */
function hasRole(roleMask: number | undefined, roleFlag: number): boolean {
  if (typeof roleMask !== "number") {
    return false;
  }

  return (roleMask & roleFlag) !== 0;
}

/**
 * 将多个角色掩码合并为单个位掩码。
 * @param roleMasks 角色掩码数组
 */
function encodeRoleMask(roleMasks: number[]): number {
  return roleMasks.reduce((combinedMask, currentMask) => {
    return combinedMask | currentMask;
  }, 0);
}

/**
 * 根据角色掩码解析可展示的角色配置项列表。
 * @param roleMask 角色掩码
 */
function resolveRoleEntries(roleMask: number | undefined): RoleConfigItem[] {
  return ROLE_CONFIG.filter((roleInfo) => hasRole(roleMask, roleInfo.mask));
}

/**
 * 将时间戳格式化为本地化日期时间字符串。
 * @param rawTime 秒级或毫秒级时间戳
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

/**
 * 从展示名称中提取首字母作为头像占位符。
 * @param rawLabel 原始展示名称
 */
function resolveDisplayInitial(rawLabel: string | undefined): string {
  const normalizedLabel = rawLabel?.trim();

  if (!normalizedLabel || normalizedLabel.length === 0) {
    return "?";
  }

  return normalizedLabel.slice(0, 1).toUpperCase();
}

export const useSuperAdminStore = defineStore("super-admin", () => {
  const authStore = useAuthStore();
  const assetCacheStore = useAssetCacheStore();

  /** 团队列表是否正在加载 */
  const teamsLoading = ref(false);
  /** 用户列表是否正在加载 */
  const usersLoading = ref(false);
  /** 选中团队明细是否正在加载 */
  const detailLoading = ref(false);
  /** 创建团队表单是否正在提交 */
  const teamCreateSubmitting = ref(false);
  /** 创建邀请码表单是否正在提交 */
  const invitationSubmitting = ref(false);
  /** 编辑用户表单是否正在提交 */
  const userEditSubmitting = ref(false);
  /** 当前正在删除的用户 ID */
  const deletingUserID = ref<string | undefined>(undefined);

  /** 全部团队列表 */
  const teams = ref<TeamInfo[]>([]);
  /** 全部用户列表 */
  const users = ref<UserInfo[]>([]);
  /** 当前选中团队的成员列表 */
  const members = ref<MemberInfo[]>([]);
  /** 当前选中团队的邀请码列表 */
  const invitations = ref<InvitationInfo[]>([]);

  /** 当前选中的团队 ID */
  const selectedTeamID = ref<string | undefined>(undefined);
  /** 用户搜索关键词 */
  const userSearchKeyword = ref("");

  /** 创建团队弹窗是否打开 */
  const isTeamCreateModalOpen = ref(false);
  /** 创建邀请码弹窗是否打开 */
  const isInvitationModalOpen = ref(false);
  /** 编辑用户弹窗是否打开 */
  const isUserEditModalOpen = ref(false);
  /** 当前正在编辑的用户 */
  const editingUser = ref<UserInfo | null>(null);

  /** 创建团队表单数据 */
  const teamCreateForm = reactive({
    /** 团队名称 */
    name: "",
    /** 团队描述 */
    description: "",
  });

  /** 编辑用户表单数据 */
  const userEditForm = reactive({
    /** 用户昵称 */
    name: "",
  });

  /** 创建邀请码表单数据 */
  const invitationForm = reactive({
    /** 被邀请人 QQ 号 */
    inviteeQq: "",
    /** 选中的团队内角色掩码列表 */
    roleMasks: [] as number[],
  });

  /** 当前选中的团队详情 */
  const selectedTeamInfo = computed(() => {
    return (
      teams.value.find((teamInfo) => teamInfo.id === selectedTeamID.value) ||
      null
    );
  });

  /** 是否已选中团队 */
  const hasSelectedTeam = computed(() => Boolean(selectedTeamInfo.value));
  /** 团队总数 */
  const teamCount = computed(() => teams.value.length);
  /** 用户总数 */
  const userCount = computed(() => users.value.length);
  /** 当前选中团队的成员数 */
  const selectedTeamMemberCount = computed(() => members.value.length);
  /** 当前选中团队的邀请码总数 */
  const selectedTeamInvitationCount = computed(() => invitations.value.length);
  /** 当前选中团队待处理邀请码数 */
  const selectedTeamPendingInvitationCount = computed(() => {
    return invitations.value.filter((invitationInfo) => invitationInfo.pending)
      .length;
  });
  /** 当前选中团队的管理员数 */
  const selectedTeamAdminCount = computed(() => {
    return members.value.filter((memberInfo) => {
      return hasRole(memberInfo.roles, ADMIN_ROLE_MASK);
    }).length;
  });
  /** 页面整体加载状态 */
  const pageLoading = computed(() => {
    return (
      authStore.currentUserProfileLoading ||
      teamsLoading.value ||
      usersLoading.value ||
      detailLoading.value
    );
  });
  /** 邀请码角色多选框选项 */
  const roleCheckboxOptions = computed(() => {
    return ROLE_CONFIG.map((roleInfo) => ({
      label: roleInfo.label,
      value: roleInfo.mask,
    }));
  });

  /**
   * 确保当前用户已加载且具备超级管理员权限。
   */
  async function ensureSuperAdminLoaded(): Promise<void> {
    await authStore.ensureCurrentUserProfileLoaded();

    if (!authStore.isSuperAdmin) {
      throw new Error("只有超级管理员可以访问该页面");
    }
  }

  /**
   * 解析优先选中的团队 ID。
   * @param nextTeams 最新团队列表
   * @param preferredTeamID 优先指定的团队 ID
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

  /** 重置创建团队表单。 */
  function resetTeamCreateForm(): void {
    teamCreateForm.name = "";
    teamCreateForm.description = "";
  }

  /** 重置创建邀请码表单。 */
  function resetInvitationForm(): void {
    invitationForm.inviteeQq = "";
    invitationForm.roleMasks = [];
  }

  /** 重置编辑用户表单。 */
  function resetUserEditForm(): void {
    editingUser.value = null;
    userEditForm.name = "";
  }

  /**
   * 解析成员头像展示 URL。
   * @param memberInfo 成员信息
   */
  function resolveMemberAvatarUrl(memberInfo: MemberInfo): string | undefined {
    return assetCacheStore.resolveUserAvatarUrl(memberInfo.user);
  }

  /**
   * 解析用户展示名称。
   * @param userInfo 用户信息
   */
  function resolveUserDisplayName(userInfo: UserInfo | undefined): string {
    const normalizedName = userInfo?.name?.trim();

    return normalizedName && normalizedName.length > 0
      ? normalizedName
      : "未命名用户";
  }

  /**
   * 解析成员展示名称。
   * @param memberInfo 成员信息
   */
  function resolveMemberDisplayName(memberInfo: MemberInfo): string {
    return resolveUserDisplayName(memberInfo.user);
  }

  /** 刷新用户列表及当前团队明细。 */
  async function refreshUserRelatedData(): Promise<void> {
    const tasks: Array<Promise<unknown>> = [loadUsers({ ensureAccess: false })];

    if (selectedTeamID.value) {
      tasks.push(loadSelectedTeamDetails(selectedTeamID.value));
    }

    await Promise.allSettled(tasks);
  }

  /**
   * 加载指定团队的成员与邀请码明细。
   * @param teamID 团队 ID
   */
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

  /**
   * 加载团队列表并同步选中团队。
   * @param options 加载选项
   */
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

  /**
   * 加载用户列表。
   * @param options 加载选项
   */
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

  /** 初始化超级管理员页面数据。 */
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

  /**
   * 刷新全部超级管理员数据。
   * @param showSuccessMessage 成功后是否展示提示
   */
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

  /** 处理刷新按钮点击。 */
  function handleRefreshClick(): void {
    void refreshAllData();
  }

  /**
   * 切换当前选中团队。
   * @param teamID 目标团队 ID
   */
  function handleTeamSelect(teamID: string): void {
    if (teamID === selectedTeamID.value) {
      return;
    }

    selectedTeamID.value = teamID;
    authStore.setCurrentTeamId(teamID);
    void loadSelectedTeamDetails(teamID);
  }

  /** 打开创建团队弹窗。 */
  function openTeamCreateModal(): void {
    resetTeamCreateForm();
    isTeamCreateModalOpen.value = true;
  }

  /** 取消创建团队弹窗。 */
  function handleTeamCreateModalCancel(): void {
    isTeamCreateModalOpen.value = false;
    resetTeamCreateForm();
  }

  /** 提交创建团队表单。 */
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

  /** 打开创建邀请码弹窗。 */
  function openInvitationCreateModal(): void {
    if (!selectedTeamID.value) {
      message.warning("请先选择要操作的团队");
      return;
    }

    resetInvitationForm();
    isInvitationModalOpen.value = true;
  }

  /** 取消创建邀请码弹窗。 */
  function handleInvitationModalCancel(): void {
    isInvitationModalOpen.value = false;
    resetInvitationForm();
  }

  /** 提交创建邀请码表单。 */
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

  /**
   * 处理用户搜索关键词变更。
   * @param nextKeyword 新的搜索关键词
   */
  function handleUserSearchKeywordChange(nextKeyword: string): void {
    userSearchKeyword.value = nextKeyword;

    if (nextKeyword.trim().length === 0) {
      void loadUsers();
    }
  }

  /** 执行用户搜索。 */
  function handleUserSearch(): void {
    void loadUsers();
  }

  /**
   * 打开编辑用户弹窗。
   * @param userInfo 待编辑用户
   */
  function openUserEditModal(userInfo: UserInfo): void {
    editingUser.value = userInfo;
    userEditForm.name = resolveUserDisplayName(userInfo);
    isUserEditModalOpen.value = true;
  }

  /** 取消编辑用户弹窗。 */
  function handleUserEditModalCancel(): void {
    isUserEditModalOpen.value = false;
    resetUserEditForm();
  }

  /** 提交编辑用户表单。 */
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

      if (authStore.currentUserProfile?.id === targetUser.id) {
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

  /**
   * 判断指定用户是否允许删除。
   * @param userInfo 目标用户
   */
  function canDeleteUser(userInfo: UserInfo): boolean {
    return userInfo.id !== authStore.currentUserProfile?.id;
  }

  /**
   * 删除指定用户。
   * @param userInfo 目标用户
   */
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

  /**
   * 复制邀请码到剪贴板。
   * @param invitationCode 邀请码文本
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

  return {
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
    userEditForm,
    invitationForm,
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
    resolveTeamAvatarUrl: assetCacheStore.resolveTeamAvatarUrl,
    resolveUserAvatarUrl: assetCacheStore.resolveUserAvatarUrl,
    resolveMemberAvatarUrl,
    resolveUserDisplayName,
    resolveMemberDisplayName,
    initializeSuperAdminView,
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
});
