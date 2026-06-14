/**
 * 文件用途：Dashboard 工作区状态管理，包含本地项目列表、在线章节参与与嵌字下载逻辑。
 */

import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Modal, message } from "ant-design-vue";
import { storeToRefs } from "pinia";
import { defineStore } from "pinia";
import {
  exportChapterManuscriptPackage,
  getMyAssignments,
} from "../api/modules";
import { useLocalProjectsStore } from "./localProjects";
import type { AssignmentInfo } from "../types/domain";
import { parsePageRange } from "../utils/pageRange";

/** 可进入在线工作区的参与模式。 */
export type WorkspaceParticipationMode = "translate" | "proofread";

/** 参与角色模式，含嵌字。 */
type WorkspaceParticipationRoleMode = WorkspaceParticipationMode | "typeset";

/** 可进入工作区的参与角色。 */
type WorkspaceEnterRole = WorkspaceParticipationRole & {
  mode: WorkspaceParticipationMode;
  entersWorkspace: true;
};

/** 章节参与角色信息。 */
interface WorkspaceParticipationRole {
  /** 角色模式。 */
  mode: WorkspaceParticipationRoleMode;
  /** 角色展示标签。 */
  label: string;
  /** 分配时间戳。 */
  assignedAt?: number;
  /** 是否可进入在线工作区。 */
  entersWorkspace: boolean;
}

/**
 * 判断角色是否可进入在线工作区。
 */
export function isWorkspaceEnterRole(
  role: WorkspaceParticipationRole,
): role is WorkspaceEnterRole {
  return role.entersWorkspace && role.mode !== "typeset";
}

/** 在线章节参与条目。 */
export interface WorkspaceParticipationEntry {
  /** 章节 ID。 */
  chapterId: string;
  /** 漫画 ID。 */
  comicId?: string;
  /** 漫画标题。 */
  comicTitle: string;
  /** 漫画作者。 */
  comicAuthor: string;
  /** 章节标签。 */
  chapterLabel: string;
  /** 章节副标题。 */
  chapterSubtitle?: string;
  /** 页数。 */
  pageCount: number;
  /** 标记总数。 */
  totalUnitCount: number;
  /** 已翻译标记数。 */
  translatedUnitCount: number;
  /** 已校对标记数。 */
  proofreadUnitCount: number;
  /** 翻译进度百分比。 */
  translatedProgressPercent: number;
  /** 校对进度百分比。 */
  proofreadProgressPercent: number;
  /** 待翻译标记数。 */
  pendingTranslateUnitCount: number;
  /** 待校对标记数。 */
  pendingProofreadUnitCount: number;
  /** 当前用户在该章节的角色列表。 */
  roles: WorkspaceParticipationRole[];
  /** 是否可下载嵌字译稿。 */
  canDownloadManuscript: boolean;
  /** 最近活跃时间戳。 */
  lastActiveAt?: number;
}

/** 参与时间格式化器。 */
const participationTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * 从分配信息解析参与角色列表。
 */
function resolveParticipationRoles(
  assignmentInfo: AssignmentInfo,
): WorkspaceParticipationRole[] {
  const roles: WorkspaceParticipationRole[] = [];

  if (assignmentInfo.assigned_translator_at) {
    roles.push({
      mode: "translate",
      label: "翻译",
      assignedAt: assignmentInfo.assigned_translator_at,
      entersWorkspace: true,
    });
  }

  if (assignmentInfo.assigned_proofreader_at) {
    roles.push({
      mode: "proofread",
      label: "校对",
      assignedAt: assignmentInfo.assigned_proofreader_at,
      entersWorkspace: true,
    });
  }

  if (assignmentInfo.assigned_typesetter_at) {
    roles.push({
      mode: "typeset",
      label: "嵌字",
      assignedAt: assignmentInfo.assigned_typesetter_at,
      entersWorkspace: false,
    });
  }

  return roles;
}

/**
 * 解析章节标签文案。
 */
function resolveChapterLabel(index?: number): string {
  return `第 ${typeof index === "number" ? index + 1 : "?"} 话`;
}

/**
 * 计算进度百分比。
 */
function resolveProgressPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}

/**
 * 解析最近参与时间戳。
 */
function resolveMostRecentParticipationTimestamp(
  assignmentInfo: AssignmentInfo,
  roles: WorkspaceParticipationRole[],
): number | undefined {
  const chapterInfo = assignmentInfo.chapter;
  const latestTimestamp = Math.max(
    chapterInfo?.updated_at ?? 0,
    chapterInfo?.created_at ?? 0,
    assignmentInfo.updated_at ?? 0,
    assignmentInfo.created_at ?? 0,
    ...roles.map((roleInfo) => roleInfo.assignedAt ?? 0),
  );

  return latestTimestamp > 0 ? latestTimestamp : undefined;
}

/**
 * 格式化最近参与时间展示文案。
 */
export function formatParticipationTimestamp(timestamp?: number): string {
  if (!timestamp) {
    return "最近参与";
  }

  return `最近参与 ${participationTimeFormatter.format(new Date(timestamp))}`;
}

/**
 * Dashboard 工作区 Store。
 */
export const useDashboardStore = defineStore("dashboard", () => {
  const localProjectsStore = useLocalProjectsStore();
  const { projects, activeProject } = storeToRefs(localProjectsStore);

  /** 新建本地项目弹窗是否打开。 */
  const createModalOpen = ref(false);
  /** 搜索关键词。 */
  const searchKeyword = ref("");
  /** 在线章节分配是否加载中。 */
  const onlineAssignmentsLoading = ref(false);
  /** 在线章节分配加载错误信息。 */
  const onlineAssignmentsErrorMessage = ref("");
  /** 当前用户的在线章节分配列表。 */
  const myAssignments = ref<AssignmentInfo[]>([]);
  /** 正在下载译稿的章节 ID 映射。 */
  const downloadingChapterIDs = ref<Record<string, boolean>>({});

  /** 嵌字下载弹窗是否打开。 */
  const downloadModalOpen = ref(false);
  /** 嵌字下载弹窗当前章节。 */
  const downloadModalChapter = ref<WorkspaceParticipationEntry | null>(null);
  /** 嵌字下载页码模式：全部页或指定范围。 */
  const downloadModalMode = ref<"all" | "range">("all");
  /** 嵌字下载自定义页码范围输入。 */
  const downloadModalRangeInput = ref("");
  /** 嵌字下载页码范围校验错误。 */
  const downloadModalRangeError = ref("");
  /** 嵌字下载是否同时包含图源。 */
  const downloadModalIncludeImages = ref(false);

  /** 规范化后的搜索关键词。 */
  const normalizedSearchKeyword = computed(() =>
    searchKeyword.value.trim().toLowerCase(),
  );

  /**
   * 加载当前用户的在线章节分配。
   */
  async function loadMyOnlineAssignments(): Promise<void> {
    onlineAssignmentsLoading.value = true;
    onlineAssignmentsErrorMessage.value = "";

    try {
      const nextAssignments: AssignmentInfo[] = [];
      const pageSize = 100;

      for (let offset = 0; ; offset += pageSize) {
        const assignmentPage = await getMyAssignments({
          offset,
          limit: pageSize,
          includes: ["chapter.comic"],
        });

        nextAssignments.push(...assignmentPage);

        if (assignmentPage.length < pageSize) {
          break;
        }
      }

      myAssignments.value = nextAssignments;
    } catch (error: unknown) {
      onlineAssignmentsErrorMessage.value =
        error instanceof Error ? error.message : "加载在线章节失败";
    } finally {
      onlineAssignmentsLoading.value = false;
    }
  }

  /** 按搜索关键词过滤后的本地项目列表。 */
  const filteredProjects = computed(() => {
    const normalizedKeyword = normalizedSearchKeyword.value;

    if (!normalizedKeyword) {
      return projects.value;
    }

    return projects.value.filter((projectRecord) => {
      return (
        projectRecord.title.toLowerCase().includes(normalizedKeyword) ||
        projectRecord.author.toLowerCase().includes(normalizedKeyword)
      );
    });
  });

  /** 在线章节参与条目列表。 */
  const onlineParticipations = computed<WorkspaceParticipationEntry[]>(() => {
    const participationsByChapter = new Map<
      string,
      Omit<
        WorkspaceParticipationEntry,
        | "translatedProgressPercent"
        | "proofreadProgressPercent"
        | "pendingTranslateUnitCount"
        | "pendingProofreadUnitCount"
      >
    >();

    for (const assignmentInfo of myAssignments.value) {
      const chapterInfo = assignmentInfo.chapter;
      if (!chapterInfo) {
        continue;
      }

      const roles = resolveParticipationRoles(assignmentInfo);
      if (roles.length === 0) {
        continue;
      }

      const existingEntry = participationsByChapter.get(
        assignmentInfo.chapter_id,
      ) ?? {
        chapterId: assignmentInfo.chapter_id,
        comicId: chapterInfo.comic_id || chapterInfo.comic?.id,
        comicTitle: chapterInfo.comic?.title || "未命名作品",
        comicAuthor: chapterInfo.comic?.author || "",
        chapterLabel: resolveChapterLabel(chapterInfo.index),
        chapterSubtitle: chapterInfo.subtitle || undefined,
        pageCount: chapterInfo.page_count ?? 0,
        totalUnitCount: chapterInfo.total_unit_count ?? 0,
        translatedUnitCount: chapterInfo.translated_unit_count ?? 0,
        proofreadUnitCount: chapterInfo.proofread_unit_count ?? 0,
        roles: [],
        canDownloadManuscript: false,
        lastActiveAt: undefined,
      };

      existingEntry.comicTitle =
        chapterInfo.comic?.title || existingEntry.comicTitle || "未命名作品";
      existingEntry.comicAuthor =
        chapterInfo.comic?.author || existingEntry.comicAuthor;
      existingEntry.chapterSubtitle =
        chapterInfo.subtitle || existingEntry.chapterSubtitle;
      existingEntry.pageCount =
        chapterInfo.page_count ?? existingEntry.pageCount;
      existingEntry.totalUnitCount =
        chapterInfo.total_unit_count ?? existingEntry.totalUnitCount;
      existingEntry.translatedUnitCount =
        chapterInfo.translated_unit_count ?? existingEntry.translatedUnitCount;
      existingEntry.proofreadUnitCount =
        chapterInfo.proofread_unit_count ?? existingEntry.proofreadUnitCount;
      const latestParticipationAt = resolveMostRecentParticipationTimestamp(
        assignmentInfo,
        roles,
      );
      existingEntry.lastActiveAt = Math.max(
        existingEntry.lastActiveAt ?? 0,
        latestParticipationAt ?? 0,
      );

      for (const roleInfo of roles) {
        const existingRole = existingEntry.roles.find(
          (entryRole) => entryRole.mode === roleInfo.mode,
        );

        if (!existingRole) {
          existingEntry.roles.push(roleInfo);
          continue;
        }

        existingRole.assignedAt = Math.max(
          existingRole.assignedAt ?? 0,
          roleInfo.assignedAt ?? 0,
        );
      }

      existingEntry.roles.sort((leftRole, rightRole) => {
        const roleOrder: Record<WorkspaceParticipationRoleMode, number> = {
          translate: 0,
          proofread: 1,
          typeset: 2,
        };

        return roleOrder[leftRole.mode] - roleOrder[rightRole.mode];
      });
      existingEntry.canDownloadManuscript = existingEntry.roles.some(
        (entryRole) => entryRole.mode === "typeset",
      );

      participationsByChapter.set(assignmentInfo.chapter_id, existingEntry);
    }

    return Array.from(participationsByChapter.values())
      .map((participationEntry) => {
        const totalUnitCount = participationEntry.totalUnitCount;
        const translatedUnitCount = participationEntry.translatedUnitCount;
        const proofreadUnitCount = participationEntry.proofreadUnitCount;

        return {
          ...participationEntry,
          translatedProgressPercent: resolveProgressPercent(
            translatedUnitCount,
            totalUnitCount,
          ),
          proofreadProgressPercent: resolveProgressPercent(
            proofreadUnitCount,
            totalUnitCount,
          ),
          pendingTranslateUnitCount: Math.max(
            totalUnitCount - translatedUnitCount,
            0,
          ),
          pendingProofreadUnitCount: Math.max(
            translatedUnitCount - proofreadUnitCount,
            0,
          ),
        };
      })
      .sort((left, right) => {
        return (right.lastActiveAt ?? 0) - (left.lastActiveAt ?? 0);
      });
  });

  /** 按搜索关键词过滤后的在线章节参与列表。 */
  const filteredOnlineParticipations = computed(() => {
    const normalizedKeyword = normalizedSearchKeyword.value;

    if (!normalizedKeyword) {
      return onlineParticipations.value;
    }

    return onlineParticipations.value.filter((participationEntry) => {
      return [
        participationEntry.comicTitle,
        participationEntry.comicAuthor,
        participationEntry.chapterLabel,
        participationEntry.chapterSubtitle,
        ...participationEntry.roles.map((roleInfo) => roleInfo.label),
      ].some((fieldValue) => {
        return fieldValue?.toLowerCase().includes(normalizedKeyword);
      });
    });
  });

  /** 工具栏统计提示文案。 */
  const toolbarHint = computed(() => {
    return `本地项目 ${filteredProjects.value.length} / ${projects.value.length}，在线章节 ${filteredOnlineParticipations.value.length} / ${onlineParticipations.value.length}`;
  });

  /** 在线章节空态文案。 */
  const onlineParticipationEmptyText = computed(() => {
    if (onlineAssignmentsErrorMessage.value) {
      return onlineAssignmentsErrorMessage.value;
    }

    if (
      normalizedSearchKeyword.value &&
      onlineParticipations.value.length > 0
    ) {
      return "没有匹配当前搜索条件的在线章节";
    }

    return "当前没有参与中的在线翻译或校对章节";
  });

  /** 本地项目空态文案。 */
  const localProjectEmptyText = computed(() => {
    if (normalizedSearchKeyword.value && projects.value.length > 0) {
      return "没有匹配当前搜索条件的本地项目";
    }

    return "当前还没有本地翻校项目";
  });

  /** 顶部汇总卡片数据。 */
  const summaryCards = computed(() => {
    const pageCount = projects.value.reduce((totalCount, projectRecord) => {
      return totalCount + projectRecord.page_count;
    }, 0);

    const unitCount = projects.value.reduce((totalCount, projectRecord) => {
      return totalCount + projectRecord.unit_count;
    }, 0);

    const translatedCount = projects.value.reduce(
      (totalCount, projectRecord) => {
        return totalCount + projectRecord.translated_unit_count;
      },
      0,
    );

    const proofreadCount = projects.value.reduce(
      (totalCount, projectRecord) => {
        return totalCount + projectRecord.proofread_unit_count;
      },
      0,
    );

    return [
      {
        label: "项目总数",
        value: projects.value.length,
      },
      {
        label: "总页数",
        value: pageCount,
      },
      {
        label: "总标记数",
        value: unitCount,
      },
      {
        label: "已校对 / 已翻译",
        value: `${proofreadCount}/${translatedCount}`,
      },
    ];
  });

  /**
   * 打开本地翻校项目。
   */
  function handleOpenProject(projectID: string): void {
    localProjectsStore.setActiveProject(projectID);
    const router = useRouter();
    void router.push(`/translator/${projectID}`);
  }

  /**
   * 进入在线章节工作区。
   */
  function handleOpenOnlineChapter(
    chapterEntry: WorkspaceParticipationEntry,
    mode: WorkspaceParticipationMode,
  ): void {
    const router = useRouter();
    void router.push({
      name: "online-translator",
      params: {
        chapterId: chapterEntry.chapterId,
      },
      query: {
        mode,
        comicId: chapterEntry.comicId,
        title: chapterEntry.comicTitle,
        author: chapterEntry.comicAuthor || undefined,
        chapterLabel: chapterEntry.chapterLabel,
        chapterSubtitle: chapterEntry.chapterSubtitle,
      },
    });
  }

  /**
   * 解析嵌字译稿下载文件名。
   */
  function resolveManuscriptFileName(
    chapterEntry: WorkspaceParticipationEntry,
  ): string {
    const rawFileName = `${chapterEntry.comicTitle}-${chapterEntry.chapterLabel}-交付包.zip`;
    return rawFileName.replace(/[\\/:*?"<>|]/g, "_");
  }

  /**
   * 打开嵌字译稿下载弹窗。
   */
  async function handleDownloadChapterManuscript(
    chapterEntry: WorkspaceParticipationEntry,
  ): Promise<void> {
    if (!chapterEntry.canDownloadManuscript) {
      return;
    }

    downloadModalChapter.value = chapterEntry;
    downloadModalMode.value = "all";
    downloadModalRangeInput.value = "";
    downloadModalRangeError.value = "";
    downloadModalIncludeImages.value = false;
    downloadModalOpen.value = true;
  }

  /**
   * 执行嵌字译稿下载。
   */
  async function performChapterManuscriptDownload(
    chapterEntry: WorkspaceParticipationEntry,
    pageRange: string | undefined,
    includeImages: boolean,
  ): Promise<void> {
    downloadingChapterIDs.value = {
      ...downloadingChapterIDs.value,
      [chapterEntry.chapterId]: true,
    };

    try {
      const chapterBlob = await exportChapterManuscriptPackage(
        chapterEntry.chapterId,
        pageRange,
        includeImages,
      );
      const objectURL = URL.createObjectURL(chapterBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = objectURL;
      downloadLink.download = resolveManuscriptFileName(chapterEntry);
      downloadLink.click();
      URL.revokeObjectURL(objectURL);
      message.success("交付包已开始下载");
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : "交付包下载失败");
    } finally {
      downloadingChapterIDs.value = {
        ...downloadingChapterIDs.value,
        [chapterEntry.chapterId]: false,
      };
    }
  }

  /**
   * 确认嵌字译稿下载弹窗并触发下载。
   */
  async function confirmDownloadModal(): Promise<void> {
    const chapterEntry = downloadModalChapter.value;
    if (!chapterEntry) {
      downloadModalOpen.value = false;
      return;
    }

    let pageRange: string | undefined;

    if (downloadModalMode.value === "range") {
      const trimmed = downloadModalRangeInput.value.trim();
      const parseResult = parsePageRange(trimmed);
      if (parseResult.error) {
        downloadModalRangeError.value = parseResult.error;
        return;
      }

      const totalPages = chapterEntry.pageCount;
      if (totalPages > 0) {
        const outOfRange = parseResult.pages.filter(
          (page) => page > totalPages,
        );
        if (outOfRange.length > 0) {
          downloadModalRangeError.value = `以下页码超出本章节范围（共 ${totalPages} 页）：${outOfRange.join(", ")}`;
          return;
        }
      }

      downloadModalRangeError.value = "";
      pageRange = trimmed;
    }

    downloadModalOpen.value = false;
    const targetEntry = chapterEntry;
    const includeImages = downloadModalIncludeImages.value;
    downloadModalChapter.value = null;

    await performChapterManuscriptDownload(
      targetEntry,
      pageRange,
      includeImages,
    );
  }

  /**
   * 取消嵌字译稿下载弹窗。
   */
  function cancelDownloadModal(): void {
    downloadModalOpen.value = false;
    downloadModalChapter.value = null;
    downloadModalRangeError.value = "";
  }

  /**
   * 本地项目创建成功后的回调。
   */
  function handleProjectCreated(projectID: string): void {
    createModalOpen.value = false;
    handleOpenProject(projectID);
  }

  /**
   * 删除本地项目（含确认弹窗）。
   */
  function handleDeleteProject(projectID: string): void {
    const targetProject = projects.value.find(
      (projectRecord) => projectRecord.id === projectID,
    );

    if (!targetProject) {
      return;
    }

    Modal.confirm({
      title: "删除本地项目",
      content: `确认删除“${targetProject.title}”吗？web 端导入的图片缓存也会被一并清理。`,
      okText: "确认删除",
      cancelText: "取消",
      async onOk() {
        await localProjectsStore.deleteProject(projectID);
        message.success("项目已删除");
      },
    });
  }

  return {
    activeProject,
    createModalOpen,
    filteredOnlineParticipations,
    filteredProjects,
    handleDeleteProject,
    handleDownloadChapterManuscript,
    handleOpenOnlineChapter,
    handleOpenProject,
    handleProjectCreated,
    loadMyOnlineAssignments,
    localProjectEmptyText,
    onlineAssignmentsErrorMessage,
    onlineAssignmentsLoading,
    onlineParticipationEmptyText,
    onlineParticipations,
    downloadingChapterIDs,
    downloadModalOpen,
    downloadModalChapter,
    downloadModalMode,
    downloadModalRangeInput,
    downloadModalRangeError,
    downloadModalIncludeImages,
    confirmDownloadModal,
    cancelDownloadModal,
    projects,
    searchKeyword,
    summaryCards,
    toolbarHint,
  };
});
