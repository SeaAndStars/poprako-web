/**
 * 文件用途：管理在线章节工作区的数据加载、整章图片缓存与远端 unit diff 保存。
 * 这里把在线章节伪装成与本地项目相近的页面结构，便于复用现有翻译器界面。
 */

import { ref } from "vue";
import { defineStore } from "pinia";
import {
  getPageList,
  getUnitList,
  savePageUnit,
  type UnitCreation,
  type UnitDiff,
  type UnitPatch,
} from "../api/modules";
import {
  deleteWebProjectImageAssets,
  storeWebProjectImageAssetBlob,
} from "../local-project/assets";
import { resolveAssetUrl } from "../api/objectStorage";
import {
  getDefaultLocalProjectUnitBoxSize,
  type LocalProjectImageSource,
  type LocalProjectUnit,
} from "../local-project/types";
import type { PageInfo, UnitInfo } from "../types/domain";

const ONLINE_WORKSPACE_STORAGE_KEY = "poprako_online_workspace_cache_v1";
const ONLINE_PAGE_SAVE_DEBOUNCE_MS = 450;
const ONLINE_INITIAL_PRELOAD_PAGE_COUNT = 3;
const ONLINE_PAGE_PREFETCH_LOOKAHEAD = 2;
const ONLINE_PAGE_UNIT_FETCH_BATCH_SIZE = 500;

type RemoteIndexBase = 0 | 1;

export interface OnlineWorkspacePageRecord {
  id: string;
  index: number;
  name: string;
  total_unit_count: number;
  translated_at?: number;
  image_source: LocalProjectImageSource;
  image_remote_url?: string;
  image_width: number;
  image_height: number;
  remote_index_base: RemoteIndexBase;
}

export interface OnlineWorkspaceRecord {
  id: string;
  workspace_kind: "online";
  chapter_id: string;
  workset_id?: string;
  comic_id?: string;
  title: string;
  author: string;
  source_label?: string;
  chapter_label: string;
  chapter_subtitle: string;
  return_workset_id?: string;
  return_comic_id?: string;
  last_page_index: number;
  page_count: number;
  created_at: string;
  updated_at: string;
  pages: OnlineWorkspacePageRecord[];
}

interface PersistedOnlineWorkspaceState {
  workspaces: OnlineWorkspaceRecord[];
}

export interface EnsureOnlineWorkspaceArgs {
  chapter_id: string;
  workset_id?: string;
  comic_id?: string;
  title?: string;
  author?: string;
  chapter_label?: string;
  chapter_subtitle?: string;
  return_workset_id?: string;
  return_comic_id?: string;
}

function clampNumber(
  rawValue: number,
  minValue: number,
  maxValue: number,
): number {
  if (!Number.isFinite(rawValue)) {
    return minValue;
  }

  return Math.max(minValue, Math.min(maxValue, rawValue));
}

function cloneUnits(units: LocalProjectUnit[]): LocalProjectUnit[] {
  return units.map((projectUnit) => ({
    ...projectUnit,
  }));
}

function normalizeTitle(
  rawValue: string | undefined,
  fallbackValue: string,
): string {
  const nextValue = rawValue?.trim();
  return nextValue || fallbackValue;
}

function normalizeOptionalText(rawValue: string | undefined): string {
  return rawValue ?? "";
}

function toPatchTextValue(rawValue: string | undefined): string | null {
  return rawValue && rawValue.length > 0 ? rawValue : null;
}

function resolvePageDisplayName(index: number): string {
  return `第 ${index} 页`;
}

function inferRemoteIndexBase(units: UnitInfo[]): RemoteIndexBase {
  return units.some((unitInfo) => unitInfo.index === 0) ? 0 : 1;
}

function buildWorkspaceID(chapterID: string): string {
  return `online_chapter_${chapterID}`;
}

function buildPageLocalUnit(
  unitInfo: UnitInfo,
  pageRecord: OnlineWorkspacePageRecord,
): LocalProjectUnit {
  const defaultBoxSize = getDefaultLocalProjectUnitBoxSize(unitInfo.is_bubble);
  const width = Math.max(pageRecord.image_width, 1);
  const height = Math.max(pageRecord.image_height, 1);
  const localIndex =
    pageRecord.remote_index_base === 0 ? unitInfo.index + 1 : unitInfo.index;

  return {
    id: unitInfo.id,
    index: localIndex,
    x_coord: clampNumber(unitInfo.x_coord / width, 0, 1),
    y_coord: clampNumber(unitInfo.y_coord / height, 0, 1),
    box_width_ratio: defaultBoxSize.box_width_ratio,
    box_height_ratio: defaultBoxSize.box_height_ratio,
    is_bubble: unitInfo.is_bubble,
    is_proofread: unitInfo.is_proofread,
    translated_text: unitInfo.translated_text ?? "",
    proofread_text: unitInfo.proofread_text ?? "",
    translator_comment: unitInfo.translator_comment ?? "",
    translator_id: unitInfo.translator_id?.trim() || undefined,
    proofreader_comment: unitInfo.proofreader_comment ?? "",
    proofreader_id: unitInfo.proofreader_id?.trim() || undefined,
    revision: Math.max(unitInfo.revision ?? 1, 1),
    last_edited_by: unitInfo.last_edited_by?.trim() || undefined,
    last_edited_at: unitInfo.last_edited_at,
  };
}

function resolveRemoteComparableUnit(
  projectUnit: LocalProjectUnit,
  pageRecord: OnlineWorkspacePageRecord,
): {
  id: string;
  index: number;
  x_coord: number;
  y_coord: number;
  is_bubble: boolean;
  is_proofread: boolean;
  translated_text: string;
  proofread_text: string;
  translator_comment: string;
  translator_id?: string;
  proofreader_comment: string;
  proofreader_id?: string;
} {
  const width = Math.max(pageRecord.image_width, 1);
  const height = Math.max(pageRecord.image_height, 1);
  const remoteIndex =
    pageRecord.remote_index_base === 0
      ? Math.max(projectUnit.index - 1, 0)
      : projectUnit.index;

  return {
    id: projectUnit.id,
    index: remoteIndex,
    x_coord: Math.round(clampNumber(projectUnit.x_coord, 0, 1) * width),
    y_coord: Math.round(clampNumber(projectUnit.y_coord, 0, 1) * height),
    is_bubble: projectUnit.is_bubble,
    is_proofread: projectUnit.is_proofread,
    translated_text: normalizeOptionalText(projectUnit.translated_text),
    proofread_text: normalizeOptionalText(projectUnit.proofread_text),
    translator_comment: normalizeOptionalText(projectUnit.translator_comment),
    translator_id: projectUnit.translator_id?.trim() || undefined,
    proofreader_comment: normalizeOptionalText(projectUnit.proofreader_comment),
    proofreader_id: projectUnit.proofreader_id?.trim() || undefined,
  };
}

function areRemoteComparableUnitsEqual(
  leftUnits: LocalProjectUnit[],
  rightUnits: LocalProjectUnit[],
  pageRecord: OnlineWorkspacePageRecord,
): boolean {
  if (leftUnits.length !== rightUnits.length) {
    return false;
  }

  for (let index = 0; index < leftUnits.length; index += 1) {
    const leftComparable = resolveRemoteComparableUnit(
      leftUnits[index],
      pageRecord,
    );
    const rightComparable = resolveRemoteComparableUnit(
      rightUnits[index],
      pageRecord,
    );

    if (
      leftComparable.id !== rightComparable.id ||
      leftComparable.index !== rightComparable.index ||
      leftComparable.x_coord !== rightComparable.x_coord ||
      leftComparable.y_coord !== rightComparable.y_coord ||
      leftComparable.is_bubble !== rightComparable.is_bubble ||
      leftComparable.is_proofread !== rightComparable.is_proofread ||
      leftComparable.translated_text !== rightComparable.translated_text ||
      leftComparable.proofread_text !== rightComparable.proofread_text ||
      leftComparable.translator_comment !==
        rightComparable.translator_comment ||
      leftComparable.translator_id !== rightComparable.translator_id ||
      leftComparable.proofreader_comment !==
        rightComparable.proofreader_comment ||
      leftComparable.proofreader_id !== rightComparable.proofreader_id
    ) {
      return false;
    }
  }

  return true;
}

async function resolveImageSize(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    const size = {
      width: bitmap.width,
      height: bitmap.height,
    };
    bitmap.close();
    return size;
  }

  return new Promise((resolve, reject) => {
    const objectURL = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectURL);
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error("解析在线页面图片尺寸失败"));
    };

    image.src = objectURL;
  });
}

function loadPersistedWorkspaces(): Record<string, OnlineWorkspaceRecord> {
  const rawState = localStorage.getItem(ONLINE_WORKSPACE_STORAGE_KEY);
  if (!rawState) {
    return {};
  }

  try {
    const parsedState = JSON.parse(rawState) as PersistedOnlineWorkspaceState;
    if (!Array.isArray(parsedState.workspaces)) {
      return {};
    }

    return parsedState.workspaces.reduce<Record<string, OnlineWorkspaceRecord>>(
      (workspaceMap, workspaceRecord) => {
        workspaceMap[workspaceRecord.chapter_id] = workspaceRecord;
        return workspaceMap;
      },
      {},
    );
  } catch {
    return {};
  }
}

function isCachedWebAssetSource(
  imageSource: LocalProjectImageSource,
): imageSource is Extract<LocalProjectImageSource, { kind: "web-asset" }> {
  return imageSource.kind === "web-asset";
}

function buildRemotePageRecord(
  pageInfo: PageInfo,
  displayIndex: number,
): OnlineWorkspacePageRecord {
  const pageName = resolvePageDisplayName(displayIndex);

  return {
    id: pageInfo.id,
    index: displayIndex,
    name: pageName,
    total_unit_count: Math.max(pageInfo.total_unit_count ?? 0, 0),
    translated_at: pageInfo.translated_at,
    image_source: {
      kind: "web-remote",
      name: pageName,
      remote_url: pageInfo.image_url ?? "",
    },
    image_remote_url: pageInfo.image_url,
    image_width: 1,
    image_height: 1,
    remote_index_base: 0,
  };
}

export const useOnlineWorkspaceStore = defineStore("online-workspace", () => {
  const workspaces = ref<Record<string, OnlineWorkspaceRecord>>(
    loadPersistedWorkspaces(),
  );
  const loadingChapterIDs = ref<Record<string, boolean>>({});
  const baseUnitsByPageID = ref<Record<string, LocalProjectUnit[]>>({});
  const workingUnitsByPageID = ref<Record<string, LocalProjectUnit[]>>({});

  const pendingSaveTimers = new Map<string, number>();
  const inflightSaveJobs = new Map<string, Promise<void>>();
  const inflightPageImageJobs = new Map<
    string,
    Promise<OnlineWorkspacePageRecord>
  >();

  async function loadRemotePageUnits(
    pageID: string,
    expectedTotalUnitCount: number,
  ): Promise<UnitInfo[]> {
    if (expectedTotalUnitCount <= ONLINE_PAGE_UNIT_FETCH_BATCH_SIZE) {
      return getUnitList({ page_id: pageID });
    }

    const remoteUnits: UnitInfo[] = [];

    for (let offset = 0; ; offset += ONLINE_PAGE_UNIT_FETCH_BATCH_SIZE) {
      const unitBatch = await getUnitList({
        page_id: pageID,
        offset,
        limit: ONLINE_PAGE_UNIT_FETCH_BATCH_SIZE,
      });

      if (unitBatch.length === 0) {
        break;
      }

      remoteUnits.push(...unitBatch);

      if (unitBatch.length < ONLINE_PAGE_UNIT_FETCH_BATCH_SIZE) {
        break;
      }
    }

    return remoteUnits;
  }

  function persistWorkspaceState(): void {
    localStorage.setItem(
      ONLINE_WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        workspaces: Object.values(workspaces.value),
      } satisfies PersistedOnlineWorkspaceState),
    );
  }

  function setWorkspaceRecord(workspaceRecord: OnlineWorkspaceRecord): void {
    workspaces.value = {
      ...workspaces.value,
      [workspaceRecord.chapter_id]: workspaceRecord,
    };
    persistWorkspaceState();
  }

  function setWorkspacePageRecord(
    chapterID: string,
    nextPageRecord: OnlineWorkspacePageRecord,
  ): OnlineWorkspacePageRecord {
    const targetWorkspace = workspaces.value[chapterID];
    if (!targetWorkspace) {
      return nextPageRecord;
    }

    setWorkspaceRecord({
      ...targetWorkspace,
      updated_at: new Date().toISOString(),
      pages: targetWorkspace.pages.map((pageRecord) => {
        return pageRecord.id === nextPageRecord.id
          ? nextPageRecord
          : pageRecord;
      }),
    });

    return nextPageRecord;
  }

  function setChapterLoading(chapterID: string, isLoading: boolean): void {
    loadingChapterIDs.value = {
      ...loadingChapterIDs.value,
      [chapterID]: isLoading,
    };
  }

  function resolveWorkspacePage(
    chapterID: string,
    pageID: string,
  ): OnlineWorkspacePageRecord | null {
    return (
      workspaces.value[chapterID]?.pages.find(
        (pageRecord) => pageRecord.id === pageID,
      ) ?? null
    );
  }

  async function cacheOnlinePage(
    chapterID: string,
    pageRecord: OnlineWorkspacePageRecord,
  ): Promise<OnlineWorkspacePageRecord> {
    if (!pageRecord.image_remote_url) {
      throw new Error(
        `第 ${pageRecord.index} 页缺少图片地址，无法进入在线工作区`,
      );
    }

    const resolvedImageURL =
      resolveAssetUrl(pageRecord.image_remote_url) ||
      pageRecord.image_remote_url;
    const response = await fetch(resolvedImageURL);
    if (!response.ok) {
      throw new Error(`下载第 ${pageRecord.index} 页图片失败`);
    }

    const imageBlob = await response.blob();
    const imageSize = await resolveImageSize(imageBlob);
    const assetID = await storeWebProjectImageAssetBlob(
      imageBlob,
      `chapter-${chapterID}-page-${pageRecord.index}`,
    );

    return {
      ...pageRecord,
      image_source: {
        kind: "web-asset",
        asset_id: assetID,
        name: pageRecord.name,
      },
      image_width: imageSize.width,
      image_height: imageSize.height,
    };
  }

  async function ensurePageImageCached(
    chapterID: string,
    pageID: string,
  ): Promise<OnlineWorkspacePageRecord | null> {
    const pageRecord = resolveWorkspacePage(chapterID, pageID);
    if (!pageRecord) {
      return null;
    }

    if (isCachedWebAssetSource(pageRecord.image_source)) {
      return pageRecord;
    }

    const jobKey = `${chapterID}:${pageID}`;
    const inflightJob = inflightPageImageJobs.get(jobKey);
    if (inflightJob) {
      return inflightJob;
    }

    const nextJob = cacheOnlinePage(chapterID, pageRecord)
      .then((nextPageRecord) => {
        return setWorkspacePageRecord(chapterID, nextPageRecord);
      })
      .finally(() => {
        inflightPageImageJobs.delete(jobKey);
      });

    inflightPageImageJobs.set(jobKey, nextJob);
    return nextJob;
  }

  function schedulePagePrefetch(
    chapterID: string,
    currentPageIndex: number,
  ): void {
    const targetWorkspace = workspaces.value[chapterID];
    if (!targetWorkspace) {
      return;
    }

    for (
      let offset = 1;
      offset <= ONLINE_PAGE_PREFETCH_LOOKAHEAD;
      offset += 1
    ) {
      const nextPageRecord = targetWorkspace.pages[currentPageIndex + offset];
      if (
        !nextPageRecord ||
        isCachedWebAssetSource(nextPageRecord.image_source)
      ) {
        continue;
      }

      void ensurePageImageCached(chapterID, nextPageRecord.id).catch(
        (error) => {
          console.warn(
            "[online-workspace] 页面预缓存失败:",
            nextPageRecord.id,
            error,
          );
        },
      );
    }
  }

  async function ensureChapterWorkspace(
    args: EnsureOnlineWorkspaceArgs,
  ): Promise<OnlineWorkspaceRecord> {
    setChapterLoading(args.chapter_id, true);

    try {
      const pageList = await getPageList({
        chapter_id: args.chapter_id,
        offset: 0,
        limit: 500,
      });
      const sortedPages = [...pageList].sort(
        (left, right) => left.index - right.index,
      );
      const existingWorkspace = workspaces.value[args.chapter_id];
      const existingPageMap = new Map(
        (existingWorkspace?.pages ?? []).map((pageRecord) => [
          pageRecord.id,
          pageRecord,
        ]),
      );
      const nextPageIDSet = new Set(sortedPages.map((pageInfo) => pageInfo.id));
      const staleAssetIDs = new Set<string>();
      let nextPages: OnlineWorkspacePageRecord[] = [];

      for (let index = 0; index < sortedPages.length; index += 1) {
        const pageInfo = sortedPages[index];
        const displayIndex = index + 1;
        const shouldPreload = displayIndex <= ONLINE_INITIAL_PRELOAD_PAGE_COUNT;
        const existingPageRecord = existingPageMap.get(pageInfo.id);
        const nextRemoteUrl = pageInfo.image_url ?? undefined;

        if (
          existingPageRecord &&
          existingPageRecord.image_remote_url === nextRemoteUrl
        ) {
          let reusedPageRecord: OnlineWorkspacePageRecord = {
            ...existingPageRecord,
            index: displayIndex,
            name: resolvePageDisplayName(displayIndex),
            total_unit_count: Math.max(
              pageInfo.total_unit_count ?? existingPageRecord.total_unit_count,
              0,
            ),
            translated_at: pageInfo.translated_at,
            image_remote_url: nextRemoteUrl,
            image_source:
              existingPageRecord.image_source.kind === "web-remote"
                ? {
                    ...existingPageRecord.image_source,
                    name: resolvePageDisplayName(displayIndex),
                    remote_url: nextRemoteUrl ?? "",
                  }
                : {
                    ...existingPageRecord.image_source,
                    name: resolvePageDisplayName(displayIndex),
                  },
          };

          if (
            shouldPreload &&
            !isCachedWebAssetSource(reusedPageRecord.image_source)
          ) {
            reusedPageRecord = await cacheOnlinePage(
              args.chapter_id,
              reusedPageRecord,
            );
          }

          nextPages.push(reusedPageRecord);
          continue;
        }

        if (
          existingPageRecord &&
          isCachedWebAssetSource(existingPageRecord.image_source)
        ) {
          staleAssetIDs.add(existingPageRecord.image_source.asset_id);
        }

        let nextPageRecord = buildRemotePageRecord(pageInfo, displayIndex);
        if (shouldPreload) {
          nextPageRecord = await cacheOnlinePage(
            args.chapter_id,
            nextPageRecord,
          );
        }

        nextPages.push(nextPageRecord);
      }

      if (existingWorkspace) {
        existingWorkspace.pages.forEach((pageRecord) => {
          if (
            nextPageIDSet.has(pageRecord.id) ||
            !isCachedWebAssetSource(pageRecord.image_source)
          ) {
            return;
          }

          staleAssetIDs.add(pageRecord.image_source.asset_id);
        });

        if (staleAssetIDs.size > 0) {
          await deleteWebProjectImageAssets([...staleAssetIDs]);
        }
      }

      const nowISO = new Date().toISOString();
      const workspaceRecord: OnlineWorkspaceRecord = {
        id: buildWorkspaceID(args.chapter_id),
        workspace_kind: "online",
        chapter_id: args.chapter_id,
        workset_id: args.workset_id,
        comic_id: args.comic_id,
        title: normalizeTitle(args.title, "在线章节"),
        author: args.author?.trim() || "",
        source_label: "在线工作区",
        chapter_label: normalizeTitle(args.chapter_label, "章节"),
        chapter_subtitle: args.chapter_subtitle?.trim() || "",
        return_workset_id: args.return_workset_id,
        return_comic_id: args.return_comic_id,
        last_page_index: Math.min(
          existingWorkspace?.last_page_index ?? 0,
          Math.max(nextPages.length - 1, 0),
        ),
        page_count: nextPages.length,
        created_at: existingWorkspace?.created_at ?? nowISO,
        updated_at: nowISO,
        pages: nextPages,
      };

      setWorkspaceRecord(workspaceRecord);
      return workspaceRecord;
    } finally {
      setChapterLoading(args.chapter_id, false);
    }
  }

  async function loadPageUnits(
    chapterID: string,
    pageID: string,
  ): Promise<LocalProjectUnit[]> {
    const pageRecord = resolveWorkspacePage(chapterID, pageID);
    if (!pageRecord) {
      return [];
    }

    const currentBaseUnits = baseUnitsByPageID.value[pageID] ?? [];
    const currentWorkingUnits = workingUnitsByPageID.value[pageID] ?? [];
    const hasPendingSave =
      pendingSaveTimers.has(pageID) || inflightSaveJobs.has(pageID);

    if (
      currentWorkingUnits.length > 0 &&
      (hasPendingSave ||
        !areRemoteComparableUnitsEqual(
          currentBaseUnits,
          currentWorkingUnits,
          pageRecord,
        ))
    ) {
      return cloneUnits(currentWorkingUnits);
    }

    const remoteUnits = await loadRemotePageUnits(
      pageID,
      Math.max(pageRecord.total_unit_count, 0),
    );
    const remoteIndexBase = inferRemoteIndexBase(remoteUnits);
    const normalizedUnitCount = remoteUnits.length;
    const shouldSyncPageRecord =
      pageRecord.remote_index_base !== remoteIndexBase ||
      pageRecord.total_unit_count !== normalizedUnitCount;

    pageRecord.remote_index_base = remoteIndexBase;
    pageRecord.total_unit_count = normalizedUnitCount;

    const normalizedUnits = remoteUnits
      .map((unitInfo) => buildPageLocalUnit(unitInfo, pageRecord))
      .sort((leftUnit, rightUnit) => leftUnit.index - rightUnit.index);

    if (shouldSyncPageRecord) {
      setWorkspacePageRecord(chapterID, {
        ...pageRecord,
      });
    }

    baseUnitsByPageID.value = {
      ...baseUnitsByPageID.value,
      [pageID]: cloneUnits(normalizedUnits),
    };
    workingUnitsByPageID.value = {
      ...workingUnitsByPageID.value,
      [pageID]: cloneUnits(normalizedUnits),
    };
    persistWorkspaceState();

    return cloneUnits(normalizedUnits);
  }

  function replaceRuntimePageUnits(
    pageID: string,
    units: LocalProjectUnit[],
  ): void {
    workingUnitsByPageID.value = {
      ...workingUnitsByPageID.value,
      [pageID]: cloneUnits(units),
    };
  }

  function updateLastPageIndex(chapterID: string, nextPageIndex: number): void {
    const targetWorkspace = workspaces.value[chapterID];
    if (!targetWorkspace) {
      return;
    }

    setWorkspaceRecord({
      ...targetWorkspace,
      last_page_index: Math.max(
        0,
        Math.min(nextPageIndex, Math.max(targetWorkspace.page_count - 1, 0)),
      ),
      updated_at: new Date().toISOString(),
    });
  }

  function buildUnitDiff(
    pageRecord: OnlineWorkspacePageRecord,
    previousUnits: LocalProjectUnit[],
    nextUnits: LocalProjectUnit[],
  ): UnitDiff {
    const previousUnitMap = new Map(
      previousUnits.map((projectUnit) => [projectUnit.id, projectUnit]),
    );
    const nextUnitMap = new Map(
      nextUnits.map((projectUnit) => [projectUnit.id, projectUnit]),
    );

    const deleteIDs = previousUnits
      .filter((projectUnit) => !nextUnitMap.has(projectUnit.id))
      .map((projectUnit) => projectUnit.id);

    const insertUnits: UnitCreation[] = nextUnits
      .filter((projectUnit) => !previousUnitMap.has(projectUnit.id))
      .map((projectUnit) => {
        const remoteComparable = resolveRemoteComparableUnit(
          projectUnit,
          pageRecord,
        );

        return {
          id: projectUnit.id,
          page_id: pageRecord.id,
          index: remoteComparable.index,
          x_coord: remoteComparable.x_coord,
          y_coord: remoteComparable.y_coord,
          is_bubble: remoteComparable.is_bubble,
          is_proofread: remoteComparable.is_proofread,
          translated_text:
            toPatchTextValue(projectUnit.translated_text) ?? undefined,
          proofread_text:
            toPatchTextValue(projectUnit.proofread_text) ?? undefined,
          translator_comment:
            toPatchTextValue(projectUnit.translator_comment) ?? undefined,
          translator_id: projectUnit.translator_id?.trim() || undefined,
          proofreader_comment:
            toPatchTextValue(projectUnit.proofreader_comment) ?? undefined,
          proofreader_id: projectUnit.proofreader_id?.trim() || undefined,
        };
      });

    const patchUnits: UnitPatch[] = nextUnits
      .filter((projectUnit) => previousUnitMap.has(projectUnit.id))
      .map((projectUnit) => {
        const previousUnit = previousUnitMap.get(projectUnit.id)!;
        const previousComparable = resolveRemoteComparableUnit(
          previousUnit,
          pageRecord,
        );
        const nextComparable = resolveRemoteComparableUnit(
          projectUnit,
          pageRecord,
        );

        const patchUnit: UnitPatch = {
          id: projectUnit.id,
        };

        if (previousComparable.index !== nextComparable.index) {
          patchUnit.index = nextComparable.index;
        }

        if (previousComparable.x_coord !== nextComparable.x_coord) {
          patchUnit.x_coord = nextComparable.x_coord;
        }

        if (previousComparable.y_coord !== nextComparable.y_coord) {
          patchUnit.y_coord = nextComparable.y_coord;
        }

        if (previousComparable.is_bubble !== nextComparable.is_bubble) {
          patchUnit.is_bubble = nextComparable.is_bubble;
        }

        if (previousComparable.is_proofread !== nextComparable.is_proofread) {
          patchUnit.is_proofread = nextComparable.is_proofread;
        }

        if (
          previousComparable.translated_text !== nextComparable.translated_text
        ) {
          patchUnit.translated_text = toPatchTextValue(
            projectUnit.translated_text,
          );
        }

        if (
          previousComparable.proofread_text !== nextComparable.proofread_text
        ) {
          patchUnit.proofread_text = toPatchTextValue(
            projectUnit.proofread_text,
          );
        }

        if (
          previousComparable.translator_comment !==
          nextComparable.translator_comment
        ) {
          patchUnit.translator_comment = toPatchTextValue(
            projectUnit.translator_comment,
          );
        }

        if (previousComparable.translator_id !== nextComparable.translator_id) {
          patchUnit.translator_id = projectUnit.translator_id?.trim() || null;
        }

        if (
          previousComparable.proofreader_comment !==
          nextComparable.proofreader_comment
        ) {
          patchUnit.proofreader_comment = toPatchTextValue(
            projectUnit.proofreader_comment,
          );
        }

        if (
          previousComparable.proofreader_id !== nextComparable.proofreader_id
        ) {
          patchUnit.proofreader_id = projectUnit.proofreader_id?.trim() || null;
        }

        return patchUnit;
      })
      .filter((patchUnit) => Object.keys(patchUnit).length > 1);

    return {
      delete: deleteIDs,
      insert: insertUnits,
      patch: patchUnits,
    };
  }

  async function flushPageUnits(
    chapterID: string,
    pageID: string,
  ): Promise<void> {
    const pendingTimer = pendingSaveTimers.get(pageID);
    if (typeof pendingTimer === "number") {
      window.clearTimeout(pendingTimer);
      pendingSaveTimers.delete(pageID);
    }

    const existingJob = inflightSaveJobs.get(pageID);
    if (existingJob) {
      await existingJob;
      return;
    }

    const pageRecord = resolveWorkspacePage(chapterID, pageID);
    if (!pageRecord) {
      return;
    }

    const previousUnits = baseUnitsByPageID.value[pageID] ?? [];
    const nextUnits = workingUnitsByPageID.value[pageID] ?? [];

    if (areRemoteComparableUnitsEqual(previousUnits, nextUnits, pageRecord)) {
      return;
    }

    const saveJob = (async () => {
      const unitDiff = buildUnitDiff(pageRecord, previousUnits, nextUnits);
      await savePageUnit({
        page_id: pageID,
        unit_diff: unitDiff,
      });

      if (pageRecord.total_unit_count !== nextUnits.length) {
        setWorkspacePageRecord(chapterID, {
          ...pageRecord,
          total_unit_count: nextUnits.length,
        });
      }

      baseUnitsByPageID.value = {
        ...baseUnitsByPageID.value,
        [pageID]: cloneUnits(nextUnits),
      };

      const latestUnits = workingUnitsByPageID.value[pageID] ?? [];
      if (!areRemoteComparableUnitsEqual(nextUnits, latestUnits, pageRecord)) {
        schedulePageUnitsSave(chapterID, pageID, latestUnits);
      }
    })();

    inflightSaveJobs.set(pageID, saveJob);

    try {
      await saveJob;
    } finally {
      inflightSaveJobs.delete(pageID);
    }
  }

  function schedulePageUnitsSave(
    chapterID: string,
    pageID: string,
    units: LocalProjectUnit[],
  ): void {
    workingUnitsByPageID.value = {
      ...workingUnitsByPageID.value,
      [pageID]: cloneUnits(units),
    };

    const existingTimer = pendingSaveTimers.get(pageID);
    if (typeof existingTimer === "number") {
      window.clearTimeout(existingTimer);
    }

    const timerID = window.setTimeout(() => {
      void flushPageUnits(chapterID, pageID);
    }, ONLINE_PAGE_SAVE_DEBOUNCE_MS);
    pendingSaveTimers.set(pageID, timerID);
  }

  async function flushChapterSaves(chapterID: string): Promise<void> {
    const targetWorkspace = workspaces.value[chapterID];
    if (!targetWorkspace) {
      return;
    }

    await Promise.allSettled(
      targetWorkspace.pages.map((pageRecord) =>
        flushPageUnits(chapterID, pageRecord.id),
      ),
    );
  }

  return {
    workspaces,
    loadingChapterIDs,
    ensureChapterWorkspace,
    loadPageUnits,
    ensurePageImageCached,
    schedulePagePrefetch,
    replaceRuntimePageUnits,
    updateLastPageIndex,
    schedulePageUnitsSave,
    flushPageUnits,
    flushChapterSaves,
  };
});
