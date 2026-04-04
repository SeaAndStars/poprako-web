import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "ant-design-vue";

import {
  createRoleRequest,
  getMyMembers,
  getRoleRequestList,
  getWorksetBoard,
  updateChapter,
  reviewRoleRequest,
} from "../../api/modules";
import {
  appendCacheBustQueryToUrl,
  resolveAssetUrl,
} from "../../api/objectStorage";
import type {
  MemberInfo,
  RoleRequestInfo,
  UserInfo,
  WorksetBoardChapterInfo,
  WorksetBoardInfo,
} from "../../types/domain";

export const ROLE_TRANSLATOR = 2;
export const ROLE_PROOFREADER = 4;
export const ROLE_TYPESETTER = 8;
export const ROLE_REVIEWER = 16;

export const WORKFLOW_STAGE_LABELS: Record<string, string> = {
  created: "待上传",
  uploaded: "已上传",
  translating: "翻译中",
  translated: "已翻译",
  proofreading: "校对中",
  proofread: "已校对",
  typesetting: "嵌字中",
  typeset: "已嵌字",
  reviewed: "已审稿",
  published: "已发布",
};

export const WORKFLOW_STAGE_COLORS: Record<string, string> = {
  created: "default",
  uploaded: "blue",
  translating: "cyan",
  translated: "geekblue",
  proofreading: "purple",
  proofread: "magenta",
  typesetting: "orange",
  typeset: "gold",
  reviewed: "lime",
  published: "green",
};

export interface RoleReviewPayload {
  chapter: WorksetBoardChapterInfo;
}

interface WorksetSummaryCard {
  key: string;
  label: string;
  value: string | number;
  hint: string;
  tone: "primary" | "accent" | "warning" | "muted";
}

interface ComicFocusStat {
  key: string;
  label: string;
  value: string | number;
  hint: string;
}

interface BatchApplicableRole {
  roleLabel: string;
  roleValue: number;
}

function resolveFilledRoleSlotCount(
  chapters: WorksetBoardChapterInfo[],
): number {
  return chapters.reduce((filledCount, chapter) => {
    return (
      filledCount +
      Number(Boolean(chapter.translator.occupant?.id)) +
      Number(Boolean(chapter.proofreader.occupant?.id)) +
      Number(Boolean(chapter.typesetter.occupant?.id)) +
      Number(Boolean(chapter.reviewer.occupant?.id))
    );
  }, 0);
}

export function displaySequence(index: number | undefined): string {
  if (typeof index !== "number") {
    return "?";
  }

  return String(index + 1);
}

export function formatTimestamp(rawTime: number | undefined): string {
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

export function resolveUserDisplayName(
  user?: UserInfo,
  fallbackId?: string,
): string {
  return user?.name || fallbackId || "无指派";
}

export function resolveWorkflowStageLabel(stage: string): string {
  return WORKFLOW_STAGE_LABELS[stage] || "处理中";
}

export function resolveWorkflowTagColor(stage: string): string {
  return WORKFLOW_STAGE_COLORS[stage] || "default";
}

export function resolveUserAvatarUrl(user?: UserInfo): string | undefined {
  return resolveAssetUrl(user?.avatar_url || user?.avatar);
}

export function resolveRoleLabel(roleValue: number): string {
  switch (roleValue) {
    case ROLE_TRANSLATOR:
      return "翻译";
    case ROLE_PROOFREADER:
      return "校对";
    case ROLE_TYPESETTER:
      return "嵌字";
    case ROLE_REVIEWER:
      return "审稿";
    default:
      return `岗位 ${roleValue}`;
  }
}

function hasRoleCapability(
  roleMask: number | undefined,
  roleValue: number,
): boolean {
  return typeof roleMask === "number" && (roleMask & roleValue) === roleValue;
}

export function useWorksetDetailView() {
  const route = useRoute();
  const router = useRouter();

  const board = ref<WorksetBoardInfo | null>(null);
  const currentTeamMember = ref<MemberInfo | null>(null);
  const loadingBoard = ref(false);
  const showChapterModal = ref(false);
  const showWorksetEditModal = ref(false);
  const reviewDrawerOpen = ref(false);
  const reviewChapterId = ref<string | undefined>(undefined);
  const reviewRequests = ref<RoleRequestInfo[]>([]);
  const reviewRequestsLoading = ref(false);
  const reviewSubmittingId = ref<string | undefined>(undefined);
  const batchApplyingChapterId = ref<string | undefined>(undefined);
  const editingChapterNumberId = ref<string | undefined>(undefined);
  const editingChapterNumber = ref<number | null>(null);
  const updatingChapterNumber = ref(false);

  const worksetID = computed(() => String(route.params.id || ""));
  const requestedComicID = computed(() => {
    return typeof route.query.comicId === "string"
      ? route.query.comicId
      : undefined;
  });

  const selectedComic = computed(() => board.value?.selected_comic);
  const worksetCoverUrl = computed(() =>
    appendCacheBustQueryToUrl(
      board.value?.workset.cover_url,
      board.value?.workset.updated_at,
    ),
  );
  const currentProjectTitle = computed(() => {
    const worksetName = board.value?.workset.name?.trim();
    const comicTitle = selectedComic.value?.title?.trim();

    if ((board.value?.comic_options.length ?? 0) <= 1) {
      return worksetName || comicTitle || "未命名项目";
    }

    return comicTitle || worksetName || "未命名项目";
  });
  const currentProjectDescription = computed(() => {
    const worksetDescription = board.value?.workset.description?.trim();
    const comicDescription = selectedComic.value?.description?.trim();

    if ((board.value?.comic_options.length ?? 0) <= 1) {
      return (
        worksetDescription || comicDescription || "当前项目还没有补充简介。"
      );
    }

    return comicDescription || worksetDescription || "当前项目还没有补充简介。";
  });
  const currentMemberRoleMask = computed(() => currentTeamMember.value?.roles);
  const headerSubtitle = computed(() => {
    const teamName =
      board.value?.workset.team?.name || board.value?.workset.team_id;
    return teamName ? `在 ${teamName} 团队下的漫画项目看板` : "漫画项目看板";
  });
  const comicOptions = computed(() => {
    return (board.value?.comic_options || []).map((comicInfo) => ({
      label: `项目条目 ${displaySequence(comicInfo.index)} · ${comicInfo.title}`,
      value: comicInfo.id,
    }));
  });
  const canCreateChapter = computed(() => Boolean(selectedComic.value));
  const currentReviewChapter = computed(() => {
    return board.value?.chapters.find(
      (chapter) => chapter.id === reviewChapterId.value,
    );
  });
  const pendingRequestTotal = computed(() => {
    return (
      board.value?.chapters.reduce((total, chapter) => {
        return total + chapter.pending_request_count;
      }, 0) ?? 0
    );
  });
  const totalRoleSlotCount = computed(() => {
    return (board.value?.chapters.length ?? 0) * 4;
  });
  const filledRoleSlotCount = computed(() => {
    return resolveFilledRoleSlotCount(board.value?.chapters || []);
  });
  const summaryCards = computed<WorksetSummaryCard[]>(() => {
    const comicCount = board.value?.comic_options.length ?? 0;
    const chapterCount = board.value?.chapters.length ?? 0;
    const roleCoverageValue =
      totalRoleSlotCount.value > 0
        ? `${Math.round((filledRoleSlotCount.value / totalRoleSlotCount.value) * 100)}%`
        : "0%";

    return [
      {
        key: "project-status",
        label: "项目状态",
        value: comicCount > 0 ? "已就绪" : "待初始化",
        hint:
          comicCount > 1
            ? `检测到 ${comicCount} 部历史漫画数据`
            : "创建 workset 后默认生成同名漫画",
        tone: comicCount > 0 ? "primary" : "warning",
      },
      {
        key: "chapter-count",
        label: "章节数",
        value: chapterCount,
        hint: currentProjectTitle.value || "尚未初始化项目内容",
        tone: "accent",
      },
      {
        key: "pending-requests",
        label: "待审批申请",
        value: pendingRequestTotal.value,
        hint:
          pendingRequestTotal.value > 0
            ? "审稿或管理员需要处理"
            : "当前申请队列已清空",
        tone: pendingRequestTotal.value > 0 ? "warning" : "muted",
      },
      {
        key: "role-coverage",
        label: "岗位占用率",
        value: roleCoverageValue,
        hint: `${filledRoleSlotCount.value}/${totalRoleSlotCount.value} 个岗位已占位`,
        tone: "primary",
      },
    ];
  });
  const selectedComicStats = computed<ComicFocusStat[]>(() => {
    const chapters = board.value?.chapters || [];
    const pageCount = chapters.reduce(
      (total, chapter) => total + chapter.page_count,
      0,
    );
    const unitCount = chapters.reduce(
      (total, chapter) => total + chapter.total_unit_count,
      0,
    );

    return [
      {
        key: "chapter-total",
        label: "章节数",
        value: chapters.length,
        hint: "当前项目已创建章节",
      },
      {
        key: "page-total",
        label: "页面数",
        value: pageCount,
        hint: "底图页数量汇总",
      },
      {
        key: "unit-total",
        label: "单元数",
        value: unitCount,
        hint: "用于翻校与进度统计",
      },
      {
        key: "last-active",
        label: "最近活跃",
        value: formatTimestamp(selectedComic.value?.last_active_at),
        hint: "按项目维度记录",
      },
    ];
  });
  const nextChapterNumber = computed(() => {
    const maxIndex = (board.value?.chapters || []).reduce(
      (currentMax, chapter) => {
        return Math.max(currentMax, chapter.index);
      },
      -1,
    );

    return maxIndex + 2;
  });
  const usedChapterNumbers = computed(() => {
    return (board.value?.chapters || [])
      .map((chapter) => chapter.index + 1)
      .filter((chapterNumber) => chapterNumber > 0);
  });
  const currentEditableChapter = computed(() => {
    return board.value?.chapters.find(
      (chapter) => chapter.id === editingChapterNumberId.value,
    );
  });

  watch(
    () => [worksetID.value, requestedComicID.value],
    () => {
      void loadBoard();
    },
    { immediate: true },
  );

  async function loadBoard(): Promise<void> {
    if (!worksetID.value) {
      board.value = null;
      return;
    }

    loadingBoard.value = true;

    try {
      const nextBoard = await getWorksetBoard(
        worksetID.value,
        requestedComicID.value
          ? { comic_id: requestedComicID.value }
          : undefined,
      );
      board.value = nextBoard;
      await loadCurrentTeamMember(nextBoard.workset.team_id);

      if (reviewDrawerOpen.value && reviewChapterId.value) {
        await loadRoleRequests(reviewChapterId.value);
      }
    } catch (error: unknown) {
      if (!board.value) {
        board.value = null;
      }

      message.error(
        error instanceof Error ? error.message : "无法加载该工作集详情",
      );
    } finally {
      loadingBoard.value = false;
    }
  }

  async function loadCurrentTeamMember(teamID: string): Promise<void> {
    try {
      const myMembers = await getMyMembers({
        offset: 0,
        limit: 100,
      });
      currentTeamMember.value =
        myMembers.find((memberInfo) => memberInfo.team_id === teamID) || null;
    } catch {
      currentTeamMember.value = null;
    }
  }

  async function loadRoleRequests(chapterID: string): Promise<void> {
    reviewRequestsLoading.value = true;

    try {
      reviewRequests.value = await getRoleRequestList({
        chapter_id: chapterID,
        status: "pending",
        includes: ["user"],
        offset: 0,
        limit: 100,
      });
    } catch (error: unknown) {
      reviewRequests.value = [];
      message.error(
        error instanceof Error ? error.message : "加载岗位申请失败",
      );
    } finally {
      reviewRequestsLoading.value = false;
    }
  }

  function handleBack(): void {
    router.back();
  }

  function refreshBoard(): void {
    void loadBoard();
  }

  function handleComicChange(comicID: string): void {
    if (!comicID || comicID === requestedComicID.value) {
      return;
    }

    void router.replace({
      query: {
        ...route.query,
        comicId: comicID,
      },
    });
  }

  function handleChapterCreated(): void {
    showChapterModal.value = false;
    void loadBoard();
  }

  function handleWorksetUpdated(): void {
    showWorksetEditModal.value = false;
    void loadBoard();
  }

  function handleRoleChanged(): void {
    void loadBoard();
  }

  function handleRoleReview(payload: RoleReviewPayload): void {
    reviewDrawerOpen.value = true;
    reviewChapterId.value = payload.chapter.id;
    void loadRoleRequests(payload.chapter.id);
  }

  function openChapterNumberEditor(chapter: WorksetBoardChapterInfo): void {
    editingChapterNumberId.value = chapter.id;
    editingChapterNumber.value = chapter.index + 1;
  }

  function closeChapterNumberEditor(): void {
    editingChapterNumberId.value = undefined;
    editingChapterNumber.value = null;
  }

  async function submitChapterNumberUpdate(): Promise<void> {
    if (!currentEditableChapter.value || editingChapterNumber.value === null) {
      return;
    }

    const nextChapterValue = editingChapterNumber.value;
    if (!Number.isInteger(nextChapterValue) || nextChapterValue <= 0) {
      message.warning("章节话数必须是大于 0 的整数");
      return;
    }

    const duplicatedActiveChapter = (board.value?.chapters || []).some(
      (chapter) =>
        chapter.id !== currentEditableChapter.value?.id &&
        chapter.index + 1 === nextChapterValue,
    );
    if (duplicatedActiveChapter) {
      message.error(`第 ${nextChapterValue} 话已存在，请更换编号`);
      return;
    }

    updatingChapterNumber.value = true;
    try {
      await updateChapter(currentEditableChapter.value.id, {
        index: nextChapterValue - 1,
      });
      message.success(`第 ${nextChapterValue} 话编号已更新`);
      closeChapterNumberEditor();
      await loadBoard();
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : "更新章节话数失败",
      );
    } finally {
      updatingChapterNumber.value = false;
    }
  }

  function resolveBatchApplicableRoles(
    chapter: WorksetBoardChapterInfo,
  ): BatchApplicableRole[] {
    const currentRoleMask = currentMemberRoleMask.value;
    const roleCandidates = [
      {
        roleLabel: "翻译",
        roleValue: ROLE_TRANSLATOR,
        roleSlot: chapter.translator,
      },
      {
        roleLabel: "校对",
        roleValue: ROLE_PROOFREADER,
        roleSlot: chapter.proofreader,
      },
      {
        roleLabel: "嵌字",
        roleValue: ROLE_TYPESETTER,
        roleSlot: chapter.typesetter,
      },
      {
        roleLabel: "审稿",
        roleValue: ROLE_REVIEWER,
        roleSlot: chapter.reviewer,
      },
    ];

    return roleCandidates
      .filter((candidate) => {
        return (
          !candidate.roleSlot.occupant?.id &&
          !candidate.roleSlot.my_pending_request_id &&
          hasRoleCapability(currentRoleMask, candidate.roleValue)
        );
      })
      .map(({ roleLabel, roleValue }) => ({ roleLabel, roleValue }));
  }

  function canBatchApplyRoles(chapter: WorksetBoardChapterInfo): boolean {
    return resolveBatchApplicableRoles(chapter).length > 1;
  }

  function resolveBatchApplyLabel(chapter: WorksetBoardChapterInfo): string {
    const applicableRoles = resolveBatchApplicableRoles(chapter);
    return `一键申请 ${applicableRoles.length} 个可做岗位`;
  }

  async function handleBatchApplyRoles(
    chapter: WorksetBoardChapterInfo,
  ): Promise<void> {
    const applicableRoles = resolveBatchApplicableRoles(chapter);
    if (applicableRoles.length <= 1 || batchApplyingChapterId.value) {
      return;
    }

    batchApplyingChapterId.value = chapter.id;
    const messageKey = `batch-role-request-${chapter.id}`;

    try {
      message.loading({
        content: `正在提交第 ${displaySequence(chapter.index)} 话的多个岗位申请...`,
        key: messageKey,
      });

      const results = await Promise.allSettled(
        applicableRoles.map((roleInfo) =>
          createRoleRequest({
            chapter_id: chapter.id,
            role: roleInfo.roleValue,
            applied_team_id: board.value?.workset.team_id,
          }),
        ),
      );

      const succeededRoles: string[] = [];
      const failedRoles: string[] = [];

      results.forEach((result, index) => {
        const targetRole = applicableRoles[index];
        if (result.status === "fulfilled") {
          succeededRoles.push(targetRole.roleLabel);
          return;
        }

        const errorMessage =
          result.reason instanceof Error ? result.reason.message : "申请失败";
        failedRoles.push(`${targetRole.roleLabel}：${errorMessage}`);
      });

      if (succeededRoles.length > 0 && failedRoles.length === 0) {
        message.success({
          content: `已提交第 ${displaySequence(chapter.index)} 话的${succeededRoles.join("、")}申请`,
          key: messageKey,
          duration: 2,
        });
      } else if (succeededRoles.length > 0) {
        message.warning({
          content: `已提交${succeededRoles.join("、")}；其余失败：${failedRoles.join("；")}`,
          key: messageKey,
          duration: 4,
        });
      } else {
        message.error({
          content: failedRoles.join("；") || "批量申请岗位失败",
          key: messageKey,
        });
      }

      if (succeededRoles.length > 0 || failedRoles.length > 0) {
        await loadBoard();
      }
    } finally {
      batchApplyingChapterId.value = undefined;
    }
  }

  async function handleRoleRequestReview(
    roleRequestID: string,
    status: "approved" | "rejected",
  ): Promise<void> {
    reviewSubmittingId.value = roleRequestID;

    try {
      await reviewRoleRequest(roleRequestID, { status });
      message.success(
        status === "approved" ? "岗位申请已通过" : "岗位申请已拒绝",
      );

      if (reviewChapterId.value) {
        await loadRoleRequests(reviewChapterId.value);
      }

      await loadBoard();
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : "审批岗位申请失败",
      );
    } finally {
      reviewSubmittingId.value = undefined;
    }
  }

  function handleReviewDrawerClose(): void {
    reviewDrawerOpen.value = false;
    reviewChapterId.value = undefined;
    reviewRequests.value = [];
  }

  return {
    board,
    batchApplyingChapterId,
    canCreateChapter,
    canBatchApplyRoles,
    closeChapterNumberEditor,
    comicOptions,
    currentEditableChapter,
    currentProjectDescription,
    currentMemberRoleMask,
    currentProjectTitle,
    currentReviewChapter,
    displaySequence,
    editingChapterNumber,
    formatTimestamp,
    handleBack,
    handleBatchApplyRoles,
    handleChapterCreated,
    handleComicChange,
    openChapterNumberEditor,
    handleReviewDrawerClose,
    handleWorksetUpdated,
    handleRoleChanged,
    handleRoleRequestReview,
    handleRoleReview,
    headerSubtitle,
    loadingBoard,
    nextChapterNumber,
    pendingRequestTotal,
    refreshBoard,
    resolveBatchApplyLabel,
    resolveRoleLabel,
    resolveUserAvatarUrl,
    resolveUserDisplayName,
    resolveWorkflowStageLabel,
    resolveWorkflowTagColor,
    reviewRequests,
    reviewDrawerOpen,
    reviewRequestsLoading,
    reviewSubmittingId,
    ROLE_PROOFREADER,
    ROLE_REVIEWER,
    ROLE_TRANSLATOR,
    ROLE_TYPESETTER,
    selectedComic,
    selectedComicStats,
    showChapterModal,
    showWorksetEditModal,
    submitChapterNumberUpdate,
    summaryCards,
    updatingChapterNumber,
    usedChapterNumbers,
    worksetCoverUrl,
  };
}
