/**
 * 文件用途：维护本地翻校项目状态。
 * 该 store 同时负责本地持久化、当前激活项目切换，以及项目统计字段的派生更新。
 */

import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { deleteWebProjectImageAssets } from "../local-project/assets";
import type {
  CreateLocalProjectPayload,
  LocalProjectDraftPage,
  LocalProjectPage,
  LocalProjectRecord,
  LocalProjectUnit,
} from "../local-project/types";

const LOCAL_PROJECT_STORAGE_KEY = "poprako_local_projects";
const ACTIVE_LOCAL_PROJECT_STORAGE_KEY = "poprako_active_local_project_id";

interface PersistedLocalProjectState {
  projects: LocalProjectRecord[];
}

/**
 * 生成随机 ID。
 */
function createLocalProjectID(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 判断文本字段是否为“有内容”。
 */
function hasTextContent(rawText: string | undefined): boolean {
  return typeof rawText === "string" && rawText.trim().length > 0;
}

/**
 * 根据页面单元重新计算项目统计。
 */
function recalculateProjectMetrics(
  projectRecord: LocalProjectRecord,
): LocalProjectRecord {
  let unitCount = 0;
  let translatedCount = 0;
  let proofreadCount = 0;
  let inboxCount = 0;
  let outboxCount = 0;

  projectRecord.pages.forEach((projectPage) => {
    projectPage.units.forEach((projectUnit) => {
      unitCount += 1;

      if (projectUnit.is_bubble) {
        inboxCount += 1;
      } else {
        outboxCount += 1;
      }

      if (
        hasTextContent(projectUnit.translated_text) ||
        hasTextContent(projectUnit.proofread_text)
      ) {
        translatedCount += 1;
      }

      if (projectUnit.is_proofread || hasTextContent(projectUnit.proofread_text)) {
        proofreadCount += 1;
      }
    });
  });

  return {
    ...projectRecord,
    page_count: projectRecord.pages.length,
    unit_count: unitCount,
    translated_unit_count: translatedCount,
    proofread_unit_count: proofreadCount,
    inbox_unit_count: inboxCount,
    outbox_unit_count: outboxCount,
    updated_at: new Date().toISOString(),
  };
}

/**
 * 为新建项目生成页面实体。
 */
function createProjectPages(draftPages: LocalProjectDraftPage[]): LocalProjectPage[] {
  return draftPages.map((draftPage, index) => ({
    id: createLocalProjectID("page"),
    index: index + 1,
    name: draftPage.name,
    image_source: draftPage.image_source,
    units: [],
  }));
}

/**
 * 从 localStorage 读取初始项目状态。
 */
function loadPersistedProjects(): LocalProjectRecord[] {
  const rawState = localStorage.getItem(LOCAL_PROJECT_STORAGE_KEY);

  if (!rawState) {
    return [];
  }

  try {
    const parsedState = JSON.parse(rawState) as PersistedLocalProjectState;
    return Array.isArray(parsedState.projects) ? parsedState.projects : [];
  } catch {
    return [];
  }
}

/**
 * 本地项目 Store。
 */
export const useLocalProjectsStore = defineStore("local-projects", () => {
  const projects = ref<LocalProjectRecord[]>(loadPersistedProjects());
  const activeProjectID = ref<string | null>(
    localStorage.getItem(ACTIVE_LOCAL_PROJECT_STORAGE_KEY),
  );

  /**
   * 当前激活项目。
   */
  const activeProject = computed<LocalProjectRecord | null>(() => {
    if (!activeProjectID.value) {
      return null;
    }

    return (
      projects.value.find((projectRecord) => projectRecord.id === activeProjectID.value) ??
      null
    );
  });

  watch(
    projects,
    (nextProjects) => {
      localStorage.setItem(
        LOCAL_PROJECT_STORAGE_KEY,
        JSON.stringify({
          projects: nextProjects,
        } satisfies PersistedLocalProjectState),
      );
    },
    {
      deep: true,
      immediate: true,
    },
  );

  watch(
    activeProjectID,
    (nextActiveProjectID) => {
      if (nextActiveProjectID) {
        localStorage.setItem(
          ACTIVE_LOCAL_PROJECT_STORAGE_KEY,
          nextActiveProjectID,
        );
        return;
      }

      localStorage.removeItem(ACTIVE_LOCAL_PROJECT_STORAGE_KEY);
    },
    { immediate: true },
  );

  /**
   * 新建本地项目。
   */
  function createProject(createPayload: CreateLocalProjectPayload): LocalProjectRecord {
    const nowISO = new Date().toISOString();
    const nextProject = recalculateProjectMetrics({
      id: createLocalProjectID("project"),
      title: createPayload.title,
      author: createPayload.author,
      source_label: createPayload.source_label,
      last_page_index: 0,
      page_count: 0,
      unit_count: 0,
      translated_unit_count: 0,
      proofread_unit_count: 0,
      inbox_unit_count: 0,
      outbox_unit_count: 0,
      created_at: nowISO,
      updated_at: nowISO,
      pages: createProjectPages(createPayload.pages),
    });

    projects.value = [nextProject, ...projects.value];
    return nextProject;
  }

  /**
   * 更新项目基础信息。
   */
  function updateProjectMeta(
    projectID: string,
    patch: Partial<Pick<LocalProjectRecord, "title" | "author" | "source_label">>,
  ): void {
    projects.value = projects.value.map((projectRecord) => {
      if (projectRecord.id !== projectID) {
        return projectRecord;
      }

      return {
        ...projectRecord,
        ...patch,
        updated_at: new Date().toISOString(),
      };
    });
  }

  /**
   * 设置激活项目。
   */
  function setActiveProject(projectID: string | null): void {
    activeProjectID.value = projectID;
  }

  /**
   * 记录用户在项目中停留的页码。
   */
  function updateLastPageIndex(projectID: string, nextPageIndex: number): void {
    projects.value = projects.value.map((projectRecord) => {
      if (projectRecord.id !== projectID) {
        return projectRecord;
      }

      return {
        ...projectRecord,
        last_page_index: Math.max(0, Math.min(nextPageIndex, projectRecord.page_count - 1)),
        updated_at: new Date().toISOString(),
      };
    });
  }

  /**
   * 替换指定页面的全部 unit。
   * 翻译器界面在一次操作结束后直接调用该方法即可，统计会自动重算。
   */
  function replacePageUnits(
    projectID: string,
    pageID: string,
    nextUnits: LocalProjectUnit[],
  ): void {
    projects.value = projects.value.map((projectRecord) => {
      if (projectRecord.id !== projectID) {
        return projectRecord;
      }

      const nextPages = projectRecord.pages.map((projectPage) => {
        if (projectPage.id !== pageID) {
          return projectPage;
        }

        return {
          ...projectPage,
          units: nextUnits.map((projectUnit, index) => ({
            ...projectUnit,
            index: index + 1,
          })),
        };
      });

      return recalculateProjectMetrics({
        ...projectRecord,
        pages: nextPages,
      });
    });
  }

  /**
   * 删除项目，并清理 web 端持久化图片资源。
   */
  async function deleteProject(projectID: string): Promise<void> {
    const targetProject = projects.value.find(
      (projectRecord) => projectRecord.id === projectID,
    );

    if (!targetProject) {
      return;
    }

    const webAssetIDs = targetProject.pages
      .map((projectPage) => projectPage.image_source)
      .filter((imageSource) => imageSource.kind === "web-asset")
      .map((imageSource) => imageSource.asset_id);

    await deleteWebProjectImageAssets(webAssetIDs);

    projects.value = projects.value.filter(
      (projectRecord) => projectRecord.id !== projectID,
    );

    if (activeProjectID.value === projectID) {
      activeProjectID.value = null;
    }
  }

  return {
    projects,
    activeProjectID,
    activeProject,
    createProject,
    updateProjectMeta,
    setActiveProject,
    updateLastPageIndex,
    replacePageUnits,
    deleteProject,
  };
});