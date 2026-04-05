import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "ant-design-vue";

import {
  createRoleRequest,
  deleteAssignment,
  deleteChapter,
  getAssignmentList,
  getMemberList,
  getMyMembers,
  getRoleRequestList,
  getWorksetByID,
  getWorksetBoard,
  manageChapterRoleAssignment,
  updateAssignment,
  updateChapter,
  reviewRoleRequest,
} from "../../api/modules";
import { appendCacheBustQueryToUrl } from "../../api/objectStorage";
import { useAvatarDisplayUrl } from "../../composables/useAvatarDisplayUrl";
import { useBlobAssetUrlCache } from "../../composables/useBlobAssetUrlCache";
import type {
  AssignmentInfo,
  MemberInfo,
  RoleRequestInfo,
  UserInfo,
  WorksetInfo,
  WorksetBoardChapterInfo,
  WorksetBoardInfo,
  WorksetBoardRoleSlotInfo,
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

interface RoleManagementMemberOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface ChapterDefaultRoleSummary {
  key: string;
  roleLabel: string;
  assigneeName?: string;
}

export type RoleWorkspaceMode = "translate" | "proofread";

function resolveRoleSlotOccupants(
  roleSlot: WorksetBoardRoleSlotInfo | undefined,
): UserInfo[] {
  const occupants = Array.isArray(roleSlot?.occupants)
    ? roleSlot.occupants.filter((userInfo): userInfo is UserInfo =>
        Boolean(userInfo?.id),
      )
    : [];

  if (occupants.length > 0) {
    return occupants;
  }

  return roleSlot?.occupant?.id ? [roleSlot.occupant] : [];
}

function hasRoleSlotOccupant(
  roleSlot: WorksetBoardRoleSlotInfo | undefined,
): boolean {
  return resolveRoleSlotOccupants(roleSlot).length > 0;
}

function roleAllowsMultipleOccupants(roleValue: number): boolean {
  return roleValue === ROLE_TRANSLATOR;
}

function resolveAssignmentRoleMask(assignment: AssignmentInfo): number {
  let roleMask = 0;

  if (assignment.assigned_raw_provider_at) {
    roleMask |= 1;
  }

  if (assignment.assigned_translator_at) {
    roleMask |= ROLE_TRANSLATOR;
  }

  if (assignment.assigned_proofreader_at) {
    roleMask |= ROLE_PROOFREADER;
  }

  if (assignment.assigned_typesetter_at) {
    roleMask |= ROLE_TYPESETTER;
  }

  if (assignment.assigned_reviewer_at) {
    roleMask |= ROLE_REVIEWER;
  }

  if (assignment.assigned_publisher_at) {
    roleMask |= 32;
  }

  return roleMask;
}

function resolveFilledRoleSlotCount(
  chapters: WorksetBoardChapterInfo[],
): number {
  return chapters.reduce((filledCount, chapter) => {
    return (
      filledCount +
      Number(hasRoleSlotOccupant(chapter.translator)) +
      Number(hasRoleSlotOccupant(chapter.proofreader)) +
      Number(hasRoleSlotOccupant(chapter.typesetter)) +
      Number(hasRoleSlotOccupant(chapter.reviewer))
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

function hasMemberCapability(member: MemberInfo, roleValue: number): boolean {
  switch (roleValue) {
    case ROLE_TRANSLATOR:
      return Boolean(member.assigned_translator_at);
    case ROLE_PROOFREADER:
      return Boolean(member.assigned_proofreader_at);
    case ROLE_TYPESETTER:
      return Boolean(member.assigned_typesetter_at);
    case ROLE_REVIEWER:
      return Boolean(member.assigned_reviewer_at);
    default:
      return false;
  }
}

function resolveChapterRoleSlot(
  chapter: WorksetBoardChapterInfo | undefined,
  roleValue: number | undefined,
): WorksetBoardRoleSlotInfo | undefined {
  if (!chapter || typeof roleValue !== "number") {
    return undefined;
  }

  switch (roleValue) {
    case ROLE_TRANSLATOR:
      return chapter.translator;
    case ROLE_PROOFREADER:
      return chapter.proofreader;
    case ROLE_TYPESETTER:
      return chapter.typesetter;
    case ROLE_REVIEWER:
      return chapter.reviewer;
    default:
      return undefined;
  }
}

function mergeWorksetInfo(
  boardWorkset: WorksetInfo,
  detailedWorkset?: WorksetInfo,
): WorksetInfo {
  if (!detailedWorkset) {
    return boardWorkset;
  }

  return {
    ...boardWorkset,
    id: detailedWorkset.id || boardWorkset.id,
    team_id: detailedWorkset.team_id || boardWorkset.team_id,
    name: detailedWorkset.name || boardWorkset.name,
    description: detailedWorkset.description ?? boardWorkset.description,
    author: detailedWorkset.author ?? boardWorkset.author,
    status: detailedWorkset.status ?? boardWorkset.status,
    cover_url: detailedWorkset.cover_url ?? boardWorkset.cover_url,
    is_cover_uploaded:
      detailedWorkset.is_cover_uploaded ?? boardWorkset.is_cover_uploaded,
    translator_user_id:
      detailedWorkset.translator_user_id ?? boardWorkset.translator_user_id,
    proofreader_user_id:
      detailedWorkset.proofreader_user_id ?? boardWorkset.proofreader_user_id,
    typesetter_user_id:
      detailedWorkset.typesetter_user_id ?? boardWorkset.typesetter_user_id,
    reviewer_user_id:
      detailedWorkset.reviewer_user_id ?? boardWorkset.reviewer_user_id,
    index: detailedWorkset.index ?? boardWorkset.index,
    comic_count: detailedWorkset.comic_count ?? boardWorkset.comic_count,
    team: detailedWorkset.team ?? boardWorkset.team,
    translator: detailedWorkset.translator ?? boardWorkset.translator,
    proofreader: detailedWorkset.proofreader ?? boardWorkset.proofreader,
    typesetter: detailedWorkset.typesetter ?? boardWorkset.typesetter,
    reviewer: detailedWorkset.reviewer ?? boardWorkset.reviewer,
    created_at: detailedWorkset.created_at ?? boardWorkset.created_at,
    updated_at: detailedWorkset.updated_at ?? boardWorkset.updated_at,
  };
}

export function useWorksetDetailView() {
  const route = useRoute();
  const router = useRouter();
  const { resolveDisplayAssetUrl } = useBlobAssetUrlCache();
  const { resolveUserAvatarUrl } = useAvatarDisplayUrl();

  const board = ref<WorksetBoardInfo | null>(null);
  const currentTeamMember = ref<MemberInfo | null>(null);
  const teamMembers = ref<MemberInfo[]>([]);
  const loadingBoard = ref(false);
  const loadingTeamMembers = ref(false);
  const showChapterModal = ref(false);
  const showWorksetEditModal = ref(false);
  const reviewDrawerOpen = ref(false);
  const reviewChapterId = ref<string | undefined>(undefined);
  const reviewRequests = ref<RoleRequestInfo[]>([]);
  const reviewRequestsLoading = ref(false);
  const reviewSubmittingId = ref<string | undefined>(undefined);
  const batchApplyingChapterId = ref<string | undefined>(undefined);
  const editingChapterId = ref<string | undefined>(undefined);
  const editingChapterNumber = ref<number | null>(null);
  const editingChapterSubtitle = ref("");
  const updatingChapter = ref(false);
  const deletingChapterId = ref<string | undefined>(undefined);
  const managingRoleChapterId = ref<string | undefined>(undefined);
  const managingRoleValue = ref<number | undefined>(undefined);
  const managingRoleUserId = ref<string | undefined>(undefined);
  const managingRoleSubmitting = ref(false);
  const managingRoleAssignments = ref<AssignmentInfo[]>([]);
  const loadingManagedRoleAssignments = ref(false);
  const removingManagedRoleUserId = ref<string | undefined>(undefined);

  const worksetID = computed(() => String(route.params.id || ""));
  const requestedComicID = computed(() => {
    return typeof route.query.comicId === "string"
      ? route.query.comicId
      : undefined;
  });

  const selectedComic = computed(() => board.value?.selected_comic);
  const worksetCoverUrl = computed(() =>
    resolveDisplayAssetUrl(
      appendCacheBustQueryToUrl(
        board.value?.workset.cover_url,
        board.value?.workset.updated_at,
      ),
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
  const currentUserID = computed(() => currentTeamMember.value?.user_id);
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
  const latestChapter = computed<WorksetBoardChapterInfo | undefined>(() => {
    return (board.value?.chapters || []).reduce<
      WorksetBoardChapterInfo | undefined
    >((currentLatestChapter, chapter) => {
      if (!currentLatestChapter) {
        return chapter;
      }

      if (chapter.index !== currentLatestChapter.index) {
        return chapter.index > currentLatestChapter.index
          ? chapter
          : currentLatestChapter;
      }

      const chapterTimestamp = chapter.updated_at || chapter.created_at || 0;
      const latestChapterTimestamp =
        currentLatestChapter.updated_at || currentLatestChapter.created_at || 0;

      return chapterTimestamp > latestChapterTimestamp
        ? chapter
        : currentLatestChapter;
    }, undefined);
  });
  const latestChapterSummary = computed(() => {
    if (!latestChapter.value) {
      return {
        text: "暂无章节",
        hint: "创建章节后会在这里显示最新一话进度",
      };
    }

    const chapterLabel = `第${displaySequence(latestChapter.value.index)}话`;
    const chapterSubtitle = latestChapter.value.subtitle?.trim();
    const displayText = chapterSubtitle
      ? `${chapterLabel} · ${chapterSubtitle}`
      : chapterLabel;
    const chapterTimestamp =
      latestChapter.value.updated_at || latestChapter.value.created_at;

    return {
      text: displayText,
      hint: `${resolveWorkflowStageLabel(latestChapter.value.workflow_stage)} · ${formatTimestamp(chapterTimestamp)}`,
    };
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
  const worksetExternalStatusText = computed(() => {
    const explicitStatus = board.value?.workset.status?.trim();

    if (explicitStatus) {
      return explicitStatus;
    }

    return latestChapter.value ? "连载中" : "未填写";
  });
  const internalProgressSummary = computed(() => {
    const chapters = board.value?.chapters || [];
    const chapterCount = chapters.length;

    if (chapterCount <= 0) {
      return {
        label: "尚未开工",
        hint: "还没有章节，创建后上传图片即可进入制作流程",
        tone: "warning" as const,
      };
    }

    const publishedCount = chapters.filter(
      (chapter) => chapter.published_at,
    ).length;
    const reviewedCount = chapters.filter(
      (chapter) => chapter.reviewed_at,
    ).length;
    const typesetCount = chapters.filter(
      (chapter) => chapter.typeset_at,
    ).length;
    const proofreadCount = chapters.filter(
      (chapter) => chapter.proofread_at,
    ).length;
    const translatedCount = chapters.filter(
      (chapter) => chapter.translated_at,
    ).length;
    const uploadedCount = chapters.filter(
      (chapter) => chapter.uploaded_at,
    ).length;

    if (publishedCount === chapterCount) {
      return {
        label: "全部已发布",
        hint: `${publishedCount}/${chapterCount} 话已发布`,
        tone: "primary" as const,
      };
    }

    if (reviewedCount === chapterCount) {
      return {
        label: "待发布",
        hint: `${reviewedCount}/${chapterCount} 话已审稿，等待最终发布`,
        tone: "accent" as const,
      };
    }

    if (typesetCount === chapterCount) {
      return {
        label: "待审稿",
        hint: `${typesetCount}/${chapterCount} 话已嵌字`,
        tone: "accent" as const,
      };
    }

    if (proofreadCount === chapterCount) {
      return {
        label: "待嵌字",
        hint: `${proofreadCount}/${chapterCount} 话已校对`,
        tone: "accent" as const,
      };
    }

    if (translatedCount === chapterCount) {
      return {
        label: "待校对",
        hint: `${translatedCount}/${chapterCount} 话已翻译`,
        tone: "accent" as const,
      };
    }

    if (uploadedCount === chapterCount) {
      return {
        label: "待翻译",
        hint: `${uploadedCount}/${chapterCount} 话底图已上传`,
        tone: "warning" as const,
      };
    }

    return {
      label: "制作中",
      hint: `已上传 ${uploadedCount}/${chapterCount} 话，已发布 ${publishedCount}/${chapterCount} 话`,
      tone: "primary" as const,
    };
  });
  const summaryCards = computed<WorksetSummaryCard[]>(() => {
    const comicCount = board.value?.comic_options.length ?? 0;
    const chapterCount = board.value?.chapters.length ?? 0;
    const worksetAuthor = board.value?.workset.author?.trim();
    const roleCoverageValue =
      totalRoleSlotCount.value > 0
        ? `${Math.round((filledRoleSlotCount.value / totalRoleSlotCount.value) * 100)}%`
        : "0%";

    return [
      {
        key: "external-status",
        label: "对外状态",
        value: worksetExternalStatusText.value,
        hint:
          worksetAuthor ||
          (comicCount > 1
            ? `检测到 ${comicCount} 部历史漫画数据`
            : "可在编辑项目里补充作者与状态"),
        tone:
          worksetExternalStatusText.value === "未填写" ? "warning" : "primary",
      },
      {
        key: "internal-progress",
        label: "内部进度",
        value: internalProgressSummary.value.label,
        hint: internalProgressSummary.value.hint,
        tone: internalProgressSummary.value.tone,
      },
      {
        key: "chapter-count",
        label: "章节数",
        value: chapterCount,
        hint: latestChapter.value
          ? `最新：${latestChapterSummary.value.text}`
          : currentProjectTitle.value || "尚未初始化项目内容",
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
  const chapterDefaultRoleSummaries = computed<ChapterDefaultRoleSummary[]>(
    () => {
      if (!board.value) {
        return [];
      }

      return [
        {
          key: "translator",
          roleLabel: "翻译",
          assigneeName:
            board.value.workset.translator ||
            board.value.workset.translator_user_id
              ? resolveUserDisplayName(
                  board.value.workset.translator,
                  board.value.workset.translator_user_id,
                )
              : undefined,
        },
        {
          key: "proofreader",
          roleLabel: "校对",
          assigneeName:
            board.value.workset.proofreader ||
            board.value.workset.proofreader_user_id
              ? resolveUserDisplayName(
                  board.value.workset.proofreader,
                  board.value.workset.proofreader_user_id,
                )
              : undefined,
        },
        {
          key: "typesetter",
          roleLabel: "嵌字",
          assigneeName:
            board.value.workset.typesetter ||
            board.value.workset.typesetter_user_id
              ? resolveUserDisplayName(
                  board.value.workset.typesetter,
                  board.value.workset.typesetter_user_id,
                )
              : undefined,
        },
        {
          key: "reviewer",
          roleLabel: "监制",
          assigneeName:
            board.value.workset.reviewer || board.value.workset.reviewer_user_id
              ? resolveUserDisplayName(
                  board.value.workset.reviewer,
                  board.value.workset.reviewer_user_id,
                )
              : undefined,
        },
      ];
    },
  );
  const currentEditableChapter = computed(() => {
    return board.value?.chapters.find(
      (chapter) => chapter.id === editingChapterId.value,
    );
  });
  const currentManagedRoleChapter = computed(() => {
    return board.value?.chapters.find(
      (chapter) => chapter.id === managingRoleChapterId.value,
    );
  });
  const currentManagedRoleSlot = computed(() => {
    return resolveChapterRoleSlot(
      currentManagedRoleChapter.value,
      managingRoleValue.value,
    );
  });
  const currentManagedRoleAllowsMultiple = computed(() => {
    return roleAllowsMultipleOccupants(managingRoleValue.value || 0);
  });
  const currentManagedRoleOccupants = computed(() => {
    return currentManagedRoleSlot.value
      ? resolveRoleSlotOccupants(currentManagedRoleSlot.value)
      : [];
  });
  const currentManagedRoleLabel = computed(() => {
    return typeof managingRoleValue.value === "number"
      ? resolveRoleLabel(managingRoleValue.value)
      : "岗位";
  });
  const managedTranslatorAssignmentsByUserId = computed(() => {
    const nextAssignmentMap = new Map<string, AssignmentInfo>();
    for (const assignmentInfo of managingRoleAssignments.value) {
      if (
        assignmentInfo.user_id &&
        (resolveAssignmentRoleMask(assignmentInfo) & ROLE_TRANSLATOR) ===
          ROLE_TRANSLATOR
      ) {
        nextAssignmentMap.set(assignmentInfo.user_id, assignmentInfo);
      }
    }

    return nextAssignmentMap;
  });
  const currentManagedRoleOriginalUserID = computed(() => {
    if (currentManagedRoleAllowsMultiple.value) {
      return undefined;
    }

    return resolveRoleSlotOccupants(currentManagedRoleSlot.value)[0]?.id;
  });
  const manageableRoleMemberOptions = computed(() => {
    const roleValue = managingRoleValue.value;
    if (typeof roleValue !== "number") {
      return [];
    }

    const currentOccupants = resolveRoleSlotOccupants(
      currentManagedRoleSlot.value,
    );
    const currentOccupant = currentOccupants[0];
    const currentOccupantID = currentOccupant?.id;
    const nextOptions: RoleManagementMemberOption[] = teamMembers.value
      .filter((memberInfo) => {
        if (!currentManagedRoleAllowsMultiple.value) {
          return true;
        }

        return !currentOccupants.some(
          (occupant) => occupant.id === memberInfo.user_id,
        );
      })
      .filter((memberInfo) => hasMemberCapability(memberInfo, roleValue))
      .map((memberInfo) => ({
        label: `${resolveUserDisplayName(memberInfo.user, memberInfo.user_id)}${memberInfo.user_id === currentOccupantID ? " · 当前负责人" : ""}`,
        value: memberInfo.user_id,
      }));

    if (
      !currentManagedRoleAllowsMultiple.value &&
      currentOccupant?.id &&
      !nextOptions.some((option) => option.value === currentOccupant.id)
    ) {
      nextOptions.unshift({
        label: `${resolveUserDisplayName(currentOccupant, currentOccupant.id)} · 当前负责人（外部协作）`,
        value: currentOccupant.id,
        disabled: true,
      });
    }

    return nextOptions;
  });
  const roleManagerOkText = computed(() => {
    if (currentManagedRoleAllowsMultiple.value) {
      return `添加${currentManagedRoleLabel.value}`;
    }

    return managingRoleUserId.value ? "保存指派" : "确认清空";
  });
  const canDeleteChapter = computed(() => {
    if (!board.value || !currentUserID.value) {
      return false;
    }

    const isTeamAdmin = Boolean(currentTeamMember.value?.assigned_admin_at);
    const isWorksetReviewer =
      board.value.workset.reviewer_user_id === currentUserID.value;

    return isTeamAdmin || isWorksetReviewer;
  });
  const canSubmitRoleManagement = computed(() => {
    if (currentManagedRoleAllowsMultiple.value) {
      return Boolean(managingRoleUserId.value);
    }

    return (
      Boolean(currentManagedRoleChapter.value) &&
      typeof managingRoleValue.value === "number" &&
      (managingRoleUserId.value || undefined) !==
        (currentManagedRoleOriginalUserID.value || undefined)
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
      const [nextBoard, detailedWorkset] = await Promise.all([
        getWorksetBoard(
          worksetID.value,
          requestedComicID.value
            ? { comic_id: requestedComicID.value }
            : undefined,
        ),
        getWorksetByID(worksetID.value, {
          includes: [
            "team",
            "translator",
            "proofreader",
            "typesetter",
            "reviewer",
          ],
        }).catch(() => undefined),
      ]);
      board.value = {
        ...nextBoard,
        workset: mergeWorksetInfo(nextBoard.workset, detailedWorkset),
      };
      await Promise.all([
        loadCurrentTeamMember(nextBoard.workset.team_id),
        loadTeamMembers(nextBoard.workset.team_id),
      ]);

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

  async function loadTeamMembers(teamID: string): Promise<void> {
    loadingTeamMembers.value = true;

    try {
      teamMembers.value = await getMemberList({
        team_id: teamID,
        includes: ["user"],
        offset: 0,
        limit: 200,
      });
    } catch {
      teamMembers.value = [];
    } finally {
      loadingTeamMembers.value = false;
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

  function openChapterEditor(chapter: WorksetBoardChapterInfo): void {
    editingChapterId.value = chapter.id;
    editingChapterNumber.value = chapter.index + 1;
    editingChapterSubtitle.value = chapter.subtitle || "";
  }

  function closeChapterEditor(): void {
    editingChapterId.value = undefined;
    editingChapterNumber.value = null;
    editingChapterSubtitle.value = "";
  }

  async function submitChapterUpdate(): Promise<void> {
    if (!currentEditableChapter.value || editingChapterNumber.value === null) {
      return;
    }

    const nextChapterValue = editingChapterNumber.value;
    const nextSubtitle = editingChapterSubtitle.value.trim();
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

    if (
      nextChapterValue === currentEditableChapter.value.index + 1 &&
      nextSubtitle === (currentEditableChapter.value.subtitle || "").trim()
    ) {
      closeChapterEditor();
      return;
    }

    updatingChapter.value = true;
    try {
      await updateChapter(currentEditableChapter.value.id, {
        index: nextChapterValue - 1,
        subtitle: nextSubtitle,
      });
      message.success(`第 ${nextChapterValue} 话章节信息已更新`);
      closeChapterEditor();
      await loadBoard();
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : "更新章节信息失败",
      );
    } finally {
      updatingChapter.value = false;
    }
  }

  async function handleDeleteChapter(
    chapter: WorksetBoardChapterInfo,
  ): Promise<void> {
    if (!canDeleteChapter.value || deletingChapterId.value) {
      return;
    }

    deletingChapterId.value = chapter.id;
    try {
      await deleteChapter(chapter.id);
      message.success(`第 ${displaySequence(chapter.index)} 话已删除`);

      if (reviewChapterId.value === chapter.id) {
        handleReviewDrawerClose();
      }

      await loadBoard();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : "删除章节失败");
    } finally {
      if (deletingChapterId.value === chapter.id) {
        deletingChapterId.value = undefined;
      }
    }
  }

  async function loadManagedRoleAssignments(chapterID: string): Promise<void> {
    loadingManagedRoleAssignments.value = true;

    try {
      managingRoleAssignments.value = await getAssignmentList({
        chapter_id: chapterID,
        includes: ["user"],
        offset: 0,
        limit: 100,
      });
    } catch (error: unknown) {
      managingRoleAssignments.value = [];
      message.error(
        error instanceof Error ? error.message : "加载章节分工失败",
      );
    } finally {
      loadingManagedRoleAssignments.value = false;
    }
  }

  function openRoleManager(
    chapter: WorksetBoardChapterInfo,
    roleValue: number,
  ): void {
    managingRoleChapterId.value = chapter.id;
    managingRoleValue.value = roleValue;
    managingRoleUserId.value = roleAllowsMultipleOccupants(roleValue)
      ? undefined
      : resolveRoleSlotOccupants(resolveChapterRoleSlot(chapter, roleValue))[0]
          ?.id;
    managingRoleAssignments.value = [];

    if (roleAllowsMultipleOccupants(roleValue)) {
      void loadManagedRoleAssignments(chapter.id);
    }
  }

  function closeRoleManager(): void {
    managingRoleChapterId.value = undefined;
    managingRoleValue.value = undefined;
    managingRoleUserId.value = undefined;
    managingRoleAssignments.value = [];
    removingManagedRoleUserId.value = undefined;
  }

  function clearManagedRoleSelection(): void {
    managingRoleUserId.value = undefined;
  }

  function openManagedRoleReview(): void {
    if (!currentManagedRoleChapter.value) {
      return;
    }

    const chapter = currentManagedRoleChapter.value;
    closeRoleManager();
    handleRoleReview({ chapter });
  }

  async function removeManagedTranslator(userID: string): Promise<void> {
    if (!currentManagedRoleChapter.value || removingManagedRoleUserId.value) {
      return;
    }

    const targetAssignment =
      managedTranslatorAssignmentsByUserId.value.get(userID);
    if (!targetAssignment) {
      message.error("未找到该翻译的章节分工记录");
      return;
    }

    const remainingRoleMask =
      resolveAssignmentRoleMask(targetAssignment) & ~ROLE_TRANSLATOR;

    removingManagedRoleUserId.value = userID;
    try {
      if (remainingRoleMask > 0) {
        await updateAssignment(targetAssignment.id, {
          role: remainingRoleMask,
        });
      } else {
        await deleteAssignment(targetAssignment.id);
      }

      message.success("翻译负责人已移除");
      await Promise.all([
        loadBoard(),
        loadManagedRoleAssignments(currentManagedRoleChapter.value.id),
      ]);
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : "移除翻译负责人失败",
      );
    } finally {
      if (removingManagedRoleUserId.value === userID) {
        removingManagedRoleUserId.value = undefined;
      }
    }
  }

  async function submitRoleManagement(): Promise<void> {
    if (
      !currentManagedRoleChapter.value ||
      typeof managingRoleValue.value !== "number" ||
      !board.value
    ) {
      return;
    }

    if (!canSubmitRoleManagement.value) {
      closeRoleManager();
      return;
    }

    managingRoleSubmitting.value = true;
    try {
      await manageChapterRoleAssignment({
        chapter_id: currentManagedRoleChapter.value.id,
        role: managingRoleValue.value,
        user_id: managingRoleUserId.value || undefined,
        assigned_team_id: managingRoleUserId.value
          ? board.value.workset.team_id
          : undefined,
      });

      const chapterNumber = displaySequence(
        currentManagedRoleChapter.value.index,
      );
      const roleLabel = currentManagedRoleLabel.value;

      if (currentManagedRoleAllowsMultiple.value) {
        message.success(`已为第 ${chapterNumber} 话添加${roleLabel}负责人`);
        managingRoleUserId.value = undefined;
        await Promise.all([
          loadBoard(),
          loadManagedRoleAssignments(currentManagedRoleChapter.value.id),
        ]);
        return;
      }

      message.success(
        managingRoleUserId.value
          ? `第 ${chapterNumber} 话的${roleLabel}负责人已更新`
          : `第 ${chapterNumber} 话的${roleLabel}负责人已清空`,
      );
      closeRoleManager();
      await loadBoard();
    } catch (error: unknown) {
      message.error(
        error instanceof Error ? error.message : "更新章节岗位失败",
      );
    } finally {
      managingRoleSubmitting.value = false;
    }
  }

  function handleRoleWorkspace(
    chapter: WorksetBoardChapterInfo,
    mode: RoleWorkspaceMode,
  ): void {
    void router.push({
      name: "online-translator",
      params: {
        chapterId: chapter.id,
      },
      query: {
        mode,
        worksetId: board.value?.workset.id,
        comicId: selectedComic.value?.id,
        title: selectedComic.value?.title || currentProjectTitle.value,
        author: selectedComic.value?.author || undefined,
        chapterLabel: `第${displaySequence(chapter.index)}话`,
        chapterSubtitle: chapter.subtitle || undefined,
      },
    });
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

    const isCurrentUserAssignedToRole = (
      roleSlot: WorksetBoardRoleSlotInfo,
    ): boolean => {
      return Boolean(
        currentUserID.value &&
        resolveRoleSlotOccupants(roleSlot).some(
          (userInfo) => userInfo.id === currentUserID.value,
        ),
      );
    };

    return roleCandidates
      .filter((candidate) => {
        return (
          !candidate.roleSlot.my_pending_request_id &&
          !isCurrentUserAssignedToRole(candidate.roleSlot) &&
          (roleAllowsMultipleOccupants(candidate.roleValue) ||
            !hasRoleSlotOccupant(candidate.roleSlot)) &&
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
    canDeleteChapter,
    canSubmitRoleManagement,
    chapterDefaultRoleSummaries,
    clearManagedRoleSelection,
    closeChapterEditor,
    closeRoleManager,
    comicOptions,
    currentEditableChapter,
    currentManagedRoleChapter,
    currentManagedRoleAllowsMultiple,
    currentManagedRoleLabel,
    currentManagedRoleOccupants,
    currentManagedRoleSlot,
    currentProjectDescription,
    currentMemberRoleMask,
    currentTeamMember,
    currentProjectTitle,
    currentReviewChapter,
    displaySequence,
    editingChapterNumber,
    editingChapterSubtitle,
    formatTimestamp,
    handleBack,
    handleBatchApplyRoles,
    handleChapterCreated,
    handleComicChange,
    handleDeleteChapter,
    handleRoleWorkspace,
    handleReviewDrawerClose,
    handleWorksetUpdated,
    handleRoleChanged,
    handleRoleRequestReview,
    handleRoleReview,
    headerSubtitle,
    loadingManagedRoleAssignments,
    loadingBoard,
    loadingTeamMembers,
    manageableRoleMemberOptions,
    managingRoleSubmitting,
    managingRoleUserId,
    roleManagerOkText,
    nextChapterNumber,
    openChapterEditor,
    openManagedRoleReview,
    openRoleManager,
    pendingRequestTotal,
    refreshBoard,
    removeManagedTranslator,
    removingManagedRoleUserId,
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
    latestChapterSummary,
    selectedComic,
    selectedComicStats,
    showChapterModal,
    showWorksetEditModal,
    submitChapterUpdate,
    submitRoleManagement,
    summaryCards,
    internalProgressSummary,
    worksetExternalStatusText,
    deletingChapterId,
    updatingChapter,
    usedChapterNumbers,
    worksetCoverUrl,
  };
}
