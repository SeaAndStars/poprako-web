/**
 * 文件用途：抽离 DashboardView 的数据加载、搜索过滤与工作区操作逻辑。
 */
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Modal, message } from "ant-design-vue";
import { storeToRefs } from "pinia";
import { getMyAssignments } from "../api/modules";
import { useLocalProjectsStore } from "../stores/localProjects";
import type { AssignmentInfo } from "../types/domain";

export type WorkspaceParticipationMode = "translate" | "proofread";

interface WorkspaceParticipationRole {
  mode: WorkspaceParticipationMode;
  label: string;
  assignedAt?: number;
}

export interface WorkspaceParticipationEntry {
  chapterId: string;
  comicId?: string;
  comicTitle: string;
  comicAuthor: string;
  chapterLabel: string;
  chapterSubtitle?: string;
  pageCount: number;
  totalUnitCount: number;
  translatedUnitCount: number;
  proofreadUnitCount: number;
  translatedProgressPercent: number;
  proofreadProgressPercent: number;
  pendingTranslateUnitCount: number;
  pendingProofreadUnitCount: number;
  roles: WorkspaceParticipationRole[];
  lastActiveAt?: number;
}

const participationTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function resolveParticipationRoles(
  assignmentInfo: AssignmentInfo,
): WorkspaceParticipationRole[] {
  const roles: WorkspaceParticipationRole[] = [];

  if (assignmentInfo.assigned_translator_at) {
    roles.push({
      mode: "translate",
      label: "翻译",
      assignedAt: assignmentInfo.assigned_translator_at,
    });
  }

  if (assignmentInfo.assigned_proofreader_at) {
    roles.push({
      mode: "proofread",
      label: "校对",
      assignedAt: assignmentInfo.assigned_proofreader_at,
    });
  }

  return roles;
}

function resolveChapterLabel(index?: number): string {
  return `第 ${typeof index === "number" ? index + 1 : "?"} 话`;
}

function resolveProgressPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}

export function formatParticipationTimestamp(timestamp?: number): string {
  if (!timestamp) {
    return "最近参与";
  }

  return `最近参与 ${participationTimeFormatter.format(new Date(timestamp))}`;
}

export function useDashboardView() {
  const router = useRouter();
  const localProjectsStore = useLocalProjectsStore();
  const { projects, activeProject } = storeToRefs(localProjectsStore);

  const createModalOpen = ref(false);
  const searchKeyword = ref("");
  const onlineAssignmentsLoading = ref(false);
  const onlineAssignmentsErrorMessage = ref("");
  const myAssignments = ref<AssignmentInfo[]>([]);

  const normalizedSearchKeyword = computed(() =>
    searchKeyword.value.trim().toLowerCase(),
  );

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
      existingEntry.lastActiveAt = Math.max(
        existingEntry.lastActiveAt ?? 0,
        assignmentInfo.updated_at ?? 0,
        assignmentInfo.created_at ?? 0,
        ...roles.map((roleInfo) => roleInfo.assignedAt ?? 0),
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
        return leftRole.mode === rightRole.mode
          ? 0
          : leftRole.mode === "translate"
            ? -1
            : 1;
      });

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

  const toolbarHint = computed(() => {
    return `本地项目 ${filteredProjects.value.length} / ${projects.value.length}，在线章节 ${filteredOnlineParticipations.value.length} / ${onlineParticipations.value.length}`;
  });

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

  const localProjectEmptyText = computed(() => {
    if (normalizedSearchKeyword.value && projects.value.length > 0) {
      return "没有匹配当前搜索条件的本地项目";
    }

    return "当前还没有本地翻校项目";
  });

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

  function handleOpenProject(projectID: string): void {
    localProjectsStore.setActiveProject(projectID);
    void router.push(`/translator/${projectID}`);
  }

  function handleOpenOnlineChapter(
    chapterEntry: WorkspaceParticipationEntry,
    mode: WorkspaceParticipationMode,
  ): void {
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

  function handleProjectCreated(projectID: string): void {
    createModalOpen.value = false;
    handleOpenProject(projectID);
  }

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

  onMounted(() => {
    void loadMyOnlineAssignments();
  });

  return {
    activeProject,
    createModalOpen,
    filteredOnlineParticipations,
    filteredProjects,
    formatParticipationTimestamp,
    handleDeleteProject,
    handleOpenOnlineChapter,
    handleOpenProject,
    handleProjectCreated,
    loadMyOnlineAssignments,
    localProjectEmptyText,
    onlineAssignmentsErrorMessage,
    onlineAssignmentsLoading,
    onlineParticipationEmptyText,
    onlineParticipations,
    projects,
    searchKeyword,
    summaryCards,
    toolbarHint,
  };
}
