import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "ant-design-vue";

import {
  getMyMembers,
  getRoleRequestList,
  getWorksetBoard,
  reviewRoleRequest,
} from "../../api/modules";
import { resolveAssetUrl } from "../../api/objectStorage";
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
  roleValue: number;
  roleLabel: string;
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

export function useWorksetDetailView() {
  const route = useRoute();
  const router = useRouter();

  const board = ref<WorksetBoardInfo | null>(null);
  const currentTeamMember = ref<MemberInfo | null>(null);
  const loadingBoard = ref(false);
  const showChapterModal = ref(false);
  const reviewDrawerOpen = ref(false);
  const reviewChapterId = ref<string | undefined>(undefined);
  const reviewRoleValue = ref<number | undefined>(undefined);
  const reviewRoleLabel = ref("");
  const reviewRequests = ref<RoleRequestInfo[]>([]);
  const reviewRequestsLoading = ref(false);
  const reviewSubmittingId = ref<string | undefined>(undefined);

  const worksetID = computed(() => String(route.params.id || ""));
  const requestedComicID = computed(() => {
    return typeof route.query.comicId === "string"
      ? route.query.comicId
      : undefined;
  });

  const selectedComic = computed(() => board.value?.selected_comic);
  const worksetCoverUrl = computed(() =>
    resolveAssetUrl(board.value?.workset.cover_url),
  );
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
  const filteredReviewRequests = computed(() => {
    if (!reviewRoleValue.value) {
      return reviewRequests.value;
    }

    return reviewRequests.value.filter(
      (requestInfo) => requestInfo.role === reviewRoleValue.value,
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
        hint: selectedComic.value?.title || "尚未初始化项目内容",
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

  function handleRoleChanged(): void {
    void loadBoard();
  }

  function handleRoleReview(payload: RoleReviewPayload): void {
    reviewDrawerOpen.value = true;
    reviewChapterId.value = payload.chapter.id;
    reviewRoleValue.value = payload.roleValue;
    reviewRoleLabel.value = payload.roleLabel;
    void loadRoleRequests(payload.chapter.id);
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
    reviewRoleValue.value = undefined;
    reviewRoleLabel.value = "";
    reviewRequests.value = [];
  }

  return {
    board,
    canCreateChapter,
    comicOptions,
    currentMemberRoleMask,
    currentReviewChapter,
    displaySequence,
    filteredReviewRequests,
    formatTimestamp,
    handleBack,
    handleChapterCreated,
    handleComicChange,
    handleReviewDrawerClose,
    handleRoleChanged,
    handleRoleRequestReview,
    handleRoleReview,
    headerSubtitle,
    loadingBoard,
    pendingRequestTotal,
    refreshBoard,
    resolveRoleLabel,
    resolveUserAvatarUrl,
    resolveUserDisplayName,
    resolveWorkflowStageLabel,
    resolveWorkflowTagColor,
    reviewDrawerOpen,
    reviewRequestsLoading,
    reviewRoleLabel,
    reviewSubmittingId,
    ROLE_PROOFREADER,
    ROLE_REVIEWER,
    ROLE_TRANSLATOR,
    ROLE_TYPESETTER,
    selectedComic,
    selectedComicStats,
    showChapterModal,
    summaryCards,
    worksetCoverUrl,
  };
}
