/**
 * 文件用途：本地翻译器页面。
 * 页面负责项目页切换、图片标记、翻译/校对文本编辑以及快捷符号插入。
 */
import {
  buildLocalProjectCollaborationKey,
  buildLocalProjectPageCollaborationKey,
  resolveTranslatorModeLabel,
  type TranslatorMode,
} from "../local-project/collaboration";
import {
  buildOnlineChapterCollaborationKey,
  buildOnlinePageCollaborationKey,
} from "../online-workspace/collaboration";
import { resolveLocalProjectImageURL } from "../local-project/assets";
import type {
  LocalProjectRecord,
  LocalProjectUnit,
} from "../local-project/types";
import { getDefaultLocalProjectUnitBoxSize } from "../local-project/types";
import { useAuthStore } from "../stores/auth";
import { useLocalProjectsStore } from "../stores/localProjects";
import {
  useOnlineWorkspaceStore,
  type OnlineWorkspaceRecord,
} from "../stores/onlineWorkspace";
import { useSpecialSymbolsStore } from "../stores/specialSymbols";
import {
  useTranslatorCollaborationStore,
  type TranslatorCollaboratorIdentity,
  type TranslatorPageEditorState,
  type TranslatorPageSnapshot,
} from "../stores/translatorCollaboration";
import type { UserInfo } from "../types/domain";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { Modal, message } from "ant-design-vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import {
  completePageTranslation,
  getAssignmentList,
  getCurrentUserProfile,
  getUserProfileByID,
  revertPageTranslationCompletion,
} from "../api/modules";
import {
  appendCacheBustQueryToSharedAssetUrl,
  appendCacheBustQueryToUrl,
  resolveAssetUrl,
  resolveInMemoryAssetUrl,
} from "../api/objectStorage";

export const USER_PROFILE_UPDATED_EVENT = "poprako:user-profile-updated";

type EditableFieldKey = "translated_text" | "proofread_text";
type UnitOwnerRole = "translate" | "proofread";

interface SyncCurrentUserProfileOptions {
  clearDisplayAssetCache?: boolean;
}

interface ShortcutHelpItem {
  keys: string;
  description: string;
}

interface ShortcutHelpSection {
  title: string;
  items: ShortcutHelpItem[];
}

export function useTranslatorView() {
  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();
  const localProjectsStore = useLocalProjectsStore();
  const onlineWorkspaceStore = useOnlineWorkspaceStore();
  const specialSymbolsStore = useSpecialSymbolsStore();
  const translatorCollaborationStore = useTranslatorCollaborationStore();
  const { projects } = storeToRefs(localProjectsStore);
  const { workspaces: onlineWorkspaces, loadingChapterIDs } =
    storeToRefs(onlineWorkspaceStore);
  const { customSymbols } = storeToRefs(specialSymbolsStore);
  const {
    projectState,
    currentPageEditor,
    currentPageEditors,
    hasCurrentPageLock,
    isConnected: isCollaborationConnected,
    isCurrentPageLockedByOther,
    pageEditorsByPageKey,
    pageSnapshots,
  } = storeToRefs(translatorCollaborationStore);

  const stageOverlayRef = ref<HTMLElement | null>(null);
  const isDarkTheme = ref(document.documentElement.dataset.theme === "dark");
  const currentUserProfile = ref<UserInfo | null>(null);
  const currentUserAvatarCacheBustToken = ref<number>(0);
  const displayAssetUrlCache = ref<Record<string, string>>({});
  const missingDisplayAssetUrlCache = ref<Record<string, true>>({});
  const pendingDisplayAssetLoads = new Map<
    string,
    Promise<string | undefined>
  >();
  let themeObserver: MutationObserver | null = null;
  const relatedUserProfiles = ref<Record<string, UserInfo>>({});
  const relatedCollaboratorIdentities = ref<
    Record<string, TranslatorCollaboratorIdentity>
  >({});
  const pendingRelatedUserProfileLoads = new Map<
    string,
    Promise<UserInfo | null>
  >();
  const pendingOnlineAssignmentProfileLoads = new Map<string, Promise<void>>();

  function resolveRequestedEditorModeFromRoute(): TranslatorMode {
    const routeMode =
      typeof route.query.mode === "string"
        ? route.query.mode
        : typeof route.query.role === "string"
          ? route.query.role
          : undefined;

    return routeMode === "proofread" ? "proofread" : "translate";
  }

  const editorMode = ref<TranslatorMode>(resolveRequestedEditorModeFromRoute());
  const activeTextField = ref<EditableFieldKey>("translated_text");
  const currentPageIndex = ref(0);
  const currentPageImageURL = ref<string | null>(null);
  const imageLoading = ref(false);
  const currentPageUnits = ref<LocalProjectUnit[]>([]);
  const selectedUnitID = ref<string | null>(null);
  const editingUnitID = ref<string | null>(null);
  const isAcquiringPageLock = ref(false);
  const isCompletingCurrentPageTranslation = ref(false);

  /* ── 图片缩放 & 平移状态 ── */
  const stageScale = ref(1);
  const stagePanX = ref(0);
  const stagePanY = ref(0);
  const isDragging = ref(false);
  let dragLastX = 0;
  let dragLastY = 0;
  let stageDragMoved = false;

  /* ── 标记拖拽状态 ── */
  const draggingUnitID = ref<string | null>(null);
  let markerDragStartX = 0;
  let markerDragStartY = 0;
  let markerDragOrigX = 0;
  let markerDragOrigY = 0;
  let markerDragMoved = false;

  const stageTransformStyle = computed(() => ({
    transform: `translate(${stagePanX.value}px, ${stagePanY.value}px) scale(${stageScale.value})`,
    transformOrigin: "center center",
  }));

  const isOnlineWorkspace = computed(() => route.name === "online-translator");

  const projectID = computed(() =>
    isOnlineWorkspace.value ? "" : String(route.params.projectId ?? ""),
  );

  const chapterID = computed(() =>
    isOnlineWorkspace.value ? String(route.params.chapterId ?? "") : "",
  );

  const localProjectRecord = computed(() => {
    return (
      projects.value.find(
        (projectItem) => projectItem.id === projectID.value,
      ) ?? null
    );
  });

  const onlineWorkspaceRecord = computed(() => {
    return onlineWorkspaces.value[chapterID.value] ?? null;
  });

  const projectRecord = computed<
    LocalProjectRecord | OnlineWorkspaceRecord | null
  >(() => {
    if (isOnlineWorkspace.value) {
      return onlineWorkspaceRecord.value;
    }

    return localProjectRecord.value;
  });

  const isWorkspaceLoading = computed(() => {
    return (
      isOnlineWorkspace.value &&
      Boolean(loadingChapterIDs.value[chapterID.value]) &&
      !projectRecord.value
    );
  });

  const workspaceLoadingTip = computed(() => {
    return isOnlineWorkspace.value
      ? "正在准备在线章节与前三页缓存..."
      : "正在加载项目...";
  });

  const workspaceEmptyDescription = computed(() => {
    return isOnlineWorkspace.value
      ? "未找到对应在线章节，或图片缓存准备失败。"
      : "未找到对应项目，可能已被删除或尚未创建。";
  });

  const workspaceHeaderTitle = computed(() => {
    if (!projectRecord.value) {
      return "";
    }

    const authorPrefix = projectRecord.value.author
      ? `[${projectRecord.value.author}] `
      : "";

    if (!isOnlineWorkspace.value) {
      return `${authorPrefix}${projectRecord.value.title}`;
    }

    const chapterLabel = onlineWorkspaceRecord.value?.chapter_label || "章节";
    const chapterSubtitle =
      onlineWorkspaceRecord.value?.chapter_subtitle?.trim();
    const chapterSuffix = chapterSubtitle
      ? `${chapterLabel} ${chapterSubtitle}`
      : chapterLabel;

    return `${authorPrefix}${projectRecord.value.title} · ${chapterSuffix}`;
  });

  const currentPageMeta = computed(() => {
    return projectRecord.value?.pages[currentPageIndex.value] ?? null;
  });

  function resolveCurrentPageTranslatedAt(): number | undefined {
    if (!isOnlineWorkspace.value || !currentPageMeta.value) {
      return undefined;
    }

    return "translated_at" in currentPageMeta.value
      ? currentPageMeta.value.translated_at
      : undefined;
  }

  const currentPageTranslatedAt = computed(() => {
    return resolveCurrentPageTranslatedAt();
  });

  const isCurrentPageTranslationCompleted = computed(() => {
    return Boolean(currentPageTranslatedAt.value);
  });

  const currentPageID = computed(() => currentPageMeta.value?.id ?? null);

  const projectCollaborationKey = computed(() => {
    if (!projectRecord.value) {
      return "";
    }

    if (isOnlineWorkspace.value) {
      return buildOnlineChapterCollaborationKey(chapterID.value);
    }

    return buildLocalProjectCollaborationKey(projectRecord.value);
  });

  const currentPageCollaborationKey = computed(() => {
    if (!projectRecord.value || !currentPageMeta.value) {
      return "";
    }

    if (isOnlineWorkspace.value) {
      return buildOnlinePageCollaborationKey(
        chapterID.value,
        currentPageMeta.value.id,
      );
    }

    return buildLocalProjectPageCollaborationKey(
      projectRecord.value,
      currentPageMeta.value,
    );
  });

  const selectedUnit = computed(() => {
    return (
      currentPageUnits.value.find(
        (projectUnit) => projectUnit.id === selectedUnitID.value,
      ) ?? null
    );
  });

  const currentUserDisplayName = computed(() => {
    return (
      currentUserProfile.value?.name ||
      currentUserProfile.value?.username ||
      "当前成员"
    );
  });

  function resolveDisplayAssetUrl(
    rawUrl: string | undefined,
  ): string | undefined {
    const normalizedUrl = resolveAssetUrl(rawUrl);

    if (!normalizedUrl) {
      return undefined;
    }

    const cachedDisplayUrl = displayAssetUrlCache.value[normalizedUrl];
    if (cachedDisplayUrl) {
      return cachedDisplayUrl;
    }

    if (missingDisplayAssetUrlCache.value[normalizedUrl]) {
      return undefined;
    }

    if (!pendingDisplayAssetLoads.has(normalizedUrl)) {
      const nextLoadPromise = resolveInMemoryAssetUrl(normalizedUrl)
        .then((resolvedDisplayUrl) => {
          if (resolvedDisplayUrl) {
            displayAssetUrlCache.value = {
              ...displayAssetUrlCache.value,
              [normalizedUrl]: resolvedDisplayUrl,
            };
          } else {
            missingDisplayAssetUrlCache.value = {
              ...missingDisplayAssetUrlCache.value,
              [normalizedUrl]: true,
            };
          }

          return resolvedDisplayUrl;
        })
        .finally(() => {
          pendingDisplayAssetLoads.delete(normalizedUrl);
        });

      pendingDisplayAssetLoads.set(normalizedUrl, nextLoadPromise);
    }

    return undefined;
  }

  function clearDisplayAssetUrlCaches(): void {
    displayAssetUrlCache.value = {};
    missingDisplayAssetUrlCache.value = {};
    pendingDisplayAssetLoads.clear();
  }

  const currentUserAvatarRawURL = computed(() => {
    const userProfile = currentUserProfile.value;

    if (!userProfile || userProfile.is_avatar_uploaded === false) {
      return undefined;
    }

    return userProfile.avatar_url || userProfile.avatar;
  });

  const currentUserAvatarVersionToken = computed(() => {
    return (
      currentUserAvatarCacheBustToken.value ||
      currentUserProfile.value?.updated_at
    );
  });

  const currentUserAvatarSyncURL = computed(() => {
    return appendCacheBustQueryToSharedAssetUrl(
      currentUserAvatarRawURL.value,
      currentUserAvatarVersionToken.value,
    );
  });

  function setRelatedUserProfile(userProfile: UserInfo): void {
    if (!userProfile.id) {
      return;
    }

    relatedUserProfiles.value = {
      ...relatedUserProfiles.value,
      [userProfile.id]: userProfile,
    };

    rememberCollaboratorIdentity({
      user_id: userProfile.id,
      display_name: resolveUserDisplayName(userProfile, userProfile.id),
      avatar_url:
        appendCacheBustQueryToSharedAssetUrl(
          resolveUserAvatarRawURL(userProfile),
          userProfile.updated_at,
        ) || resolveUserAvatarRawURL(userProfile),
    });
  }

  function normalizeCollaboratorIdentity(
    identity: TranslatorCollaboratorIdentity | null | undefined,
  ): TranslatorCollaboratorIdentity | null {
    const normalizedUserID = identity?.user_id?.trim();
    if (!normalizedUserID) {
      return null;
    }

    return {
      user_id: normalizedUserID,
      display_name: identity?.display_name?.trim() || normalizedUserID,
      avatar_url: identity?.avatar_url?.trim() || undefined,
    };
  }

  function rememberCollaboratorIdentity(
    identity: TranslatorCollaboratorIdentity | null | undefined,
  ): void {
    const normalizedIdentity = normalizeCollaboratorIdentity(identity);
    if (!normalizedIdentity) {
      return;
    }

    const currentIdentity =
      relatedCollaboratorIdentities.value[normalizedIdentity.user_id];
    if (
      currentIdentity?.display_name === normalizedIdentity.display_name &&
      currentIdentity?.avatar_url === normalizedIdentity.avatar_url
    ) {
      return;
    }

    relatedCollaboratorIdentities.value = {
      ...relatedCollaboratorIdentities.value,
      [normalizedIdentity.user_id]: normalizedIdentity,
    };
  }

  function rememberCollaboratorIdentities(
    identities: TranslatorCollaboratorIdentity[],
  ): void {
    let nextIdentityMap = relatedCollaboratorIdentities.value;
    let hasChanged = false;

    identities.forEach((identity) => {
      const normalizedIdentity = normalizeCollaboratorIdentity(identity);
      if (!normalizedIdentity) {
        return;
      }

      const currentIdentity = nextIdentityMap[normalizedIdentity.user_id];
      if (
        currentIdentity?.display_name === normalizedIdentity.display_name &&
        currentIdentity?.avatar_url === normalizedIdentity.avatar_url
      ) {
        return;
      }

      if (!hasChanged) {
        nextIdentityMap = { ...nextIdentityMap };
        hasChanged = true;
      }

      nextIdentityMap[normalizedIdentity.user_id] = normalizedIdentity;
    });

    if (hasChanged) {
      relatedCollaboratorIdentities.value = nextIdentityMap;
    }
  }

  function resolveKnownUserProfile(
    userID: string | undefined,
  ): UserInfo | undefined {
    if (!userID) {
      return undefined;
    }

    if (currentUserProfile.value?.id === userID) {
      return currentUserProfile.value;
    }

    return relatedUserProfiles.value[userID];
  }

  function resolveKnownCollaboratorIdentity(
    userID: string | undefined,
  ): TranslatorCollaboratorIdentity | undefined {
    if (!userID) {
      return undefined;
    }

    if (currentUserProfile.value?.id === userID) {
      return {
        user_id: userID,
        display_name: currentUserDisplayName.value,
        avatar_url:
          currentUserAvatarSyncURL.value ||
          resolveUserAvatarRawURL(currentUserProfile.value),
      };
    }

    return relatedCollaboratorIdentities.value[userID];
  }

  function resolveUserDisplayName(
    userProfile: UserInfo | undefined,
    fallbackUserID?: string,
  ): string {
    return (
      userProfile?.name?.trim() ||
      userProfile?.username?.trim() ||
      fallbackUserID ||
      "未署名"
    );
  }

  function resolveCurrentUserID(): string | undefined {
    return currentUserProfile.value?.id?.trim() || undefined;
  }

  function resolveUserAvatarRawURL(
    userProfile: UserInfo | undefined,
  ): string | undefined {
    if (!userProfile || userProfile.is_avatar_uploaded === false) {
      return undefined;
    }

    return userProfile.avatar_url || userProfile.avatar;
  }

  function resolveUnitOwnerUserID(
    projectUnit: LocalProjectUnit,
    role: UnitOwnerRole,
  ): string | undefined {
    return role === "proofread"
      ? projectUnit.proofreader_id?.trim() || undefined
      : projectUnit.translator_id?.trim() || undefined;
  }

  function resolveUnitOwnerUser(
    projectUnit: LocalProjectUnit,
    role: UnitOwnerRole,
  ): UserInfo | undefined {
    return resolveKnownUserProfile(resolveUnitOwnerUserID(projectUnit, role));
  }

  function resolveUnitOwnerDisplayName(
    projectUnit: LocalProjectUnit,
    role: UnitOwnerRole,
  ): string {
    const ownerUserID = resolveUnitOwnerUserID(projectUnit, role);
    const ownerProfile = resolveUnitOwnerUser(projectUnit, role);
    if (ownerProfile) {
      return resolveUserDisplayName(ownerProfile, ownerUserID);
    }

    return (
      resolveKnownCollaboratorIdentity(ownerUserID)?.display_name?.trim() ||
      ownerUserID ||
      "未署名"
    );
  }

  function resolveUnitOwnerAvatarURL(
    projectUnit: LocalProjectUnit,
    role: UnitOwnerRole,
  ): string | undefined {
    const ownerProfile = resolveUnitOwnerUser(projectUnit, role);
    const collaboratorIdentity = resolveKnownCollaboratorIdentity(
      resolveUnitOwnerUserID(projectUnit, role),
    );

    return resolveDisplayAssetUrl(
      ownerProfile
        ? appendCacheBustQueryToUrl(
            resolveUserAvatarRawURL(ownerProfile),
            ownerProfile.updated_at,
          )
        : collaboratorIdentity?.avatar_url,
    );
  }

  function resolveUnitOwnerInitial(
    projectUnit: LocalProjectUnit,
    role: UnitOwnerRole,
  ): string {
    return (
      resolveUnitOwnerDisplayName(projectUnit, role)
        .trim()
        .charAt(0)
        .toUpperCase() || "协"
    );
  }

  async function ensureUserProfileLoaded(
    userID: string,
  ): Promise<UserInfo | null> {
    const normalizedUserID = userID.trim();
    if (!normalizedUserID) {
      return null;
    }

    const knownUserProfile = resolveKnownUserProfile(normalizedUserID);
    if (knownUserProfile) {
      return knownUserProfile;
    }

    const pendingLoad = pendingRelatedUserProfileLoads.get(normalizedUserID);
    if (pendingLoad) {
      return pendingLoad;
    }

    const nextLoad = getUserProfileByID(normalizedUserID)
      .then((userProfile) => {
        setRelatedUserProfile(userProfile);
        return userProfile;
      })
      .catch((error) => {
        console.warn(
          "[translator] 加载 unit 归属用户失败:",
          normalizedUserID,
          error,
        );
        return null;
      })
      .finally(() => {
        pendingRelatedUserProfileLoads.delete(normalizedUserID);
      });

    pendingRelatedUserProfileLoads.set(normalizedUserID, nextLoad);
    return nextLoad;
  }

  async function ensureCurrentPageOwnerProfilesLoaded(
    units: LocalProjectUnit[],
  ): Promise<void> {
    const userIDs = Array.from(
      new Set(
        units
          .flatMap((projectUnit) => {
            return [projectUnit.translator_id, projectUnit.proofreader_id];
          })
          .map((userID) => userID?.trim() || "")
          .filter((userID): userID is string => Boolean(userID)),
      ),
    );

    if (userIDs.length === 0) {
      return;
    }

    await Promise.all(userIDs.map((userID) => ensureUserProfileLoaded(userID)));
  }

  async function ensureOnlineAssignmentProfilesLoaded(
    targetChapterID: string,
  ): Promise<void> {
    const normalizedChapterID = targetChapterID.trim();
    if (!normalizedChapterID || !authStore.isLoggedIn) {
      return;
    }

    const pendingLoad =
      pendingOnlineAssignmentProfileLoads.get(normalizedChapterID);
    if (pendingLoad) {
      return pendingLoad;
    }

    const nextLoad = getAssignmentList({
      chapter_id: normalizedChapterID,
      offset: 0,
      limit: 100,
      includes: ["user"],
    })
      .then((assignmentList) => {
        assignmentList.forEach((assignmentInfo) => {
          if (assignmentInfo.user) {
            setRelatedUserProfile(assignmentInfo.user);
          }
        });
      })
      .catch((error) => {
        console.warn(
          "[translator] 加载在线章节成员资料失败:",
          normalizedChapterID,
          error,
        );
      })
      .finally(() => {
        pendingOnlineAssignmentProfileLoads.delete(normalizedChapterID);
      });

    pendingOnlineAssignmentProfileLoads.set(normalizedChapterID, nextLoad);
    return nextLoad;
  }

  const activeProjectEditors = computed(() => {
    return projectState.value?.page_editors ?? [];
  });

  watch(
    activeProjectEditors,
    (pageEditors) => {
      rememberCollaboratorIdentities(
        pageEditors.map((pageEditor) => ({
          user_id: pageEditor.user_id,
          display_name: pageEditor.display_name,
          avatar_url: pageEditor.avatar_url,
        })),
      );
    },
    { immediate: true },
  );

  const currentPageSnapshot = computed<TranslatorPageSnapshot | null>(() => {
    if (!currentPageCollaborationKey.value) {
      return null;
    }

    return pageSnapshots.value[currentPageCollaborationKey.value] ?? null;
  });

  function resolveCollaboratorDisplayName(
    pageEditor: TranslatorPageEditorState,
  ): string {
    return pageEditor.user_id === currentUserProfile.value?.id
      ? "你"
      : pageEditor.display_name;
  }

  function isPageLockHolder(pageEditor: TranslatorPageEditorState): boolean {
    return pageEditor.editor_state === "lock_holder";
  }

  function resolveCollaboratorLockingText(
    pageEditor: TranslatorPageEditorState,
  ): string {
    return `${resolveCollaboratorDisplayName(pageEditor)}正在${resolveTranslatorModeLabel(pageEditor.mode)}第 ${pageEditor.page_index} 页`;
  }

  function resolveCollaboratorViewingText(
    pageEditor: TranslatorPageEditorState,
  ): string {
    return `${resolveCollaboratorDisplayName(pageEditor)}正在查看第 ${pageEditor.page_index} 页`;
  }

  const currentPageViewer = computed<TranslatorPageEditorState | null>(() => {
    return (
      currentPageEditors.value.find(
        (pageEditor) => !isPageLockHolder(pageEditor),
      ) ?? null
    );
  });

  const currentPageStatusText = computed(() => {
    if (!authStore.isLoggedIn || !currentUserProfile.value?.id) {
      return "未登录，仅本地编辑";
    }

    if (!isCollaborationConnected.value) {
      return "协作离线，仅本地编辑";
    }

    if (currentPageEditor.value) {
      return `正在${resolveTranslatorModeLabel(currentPageEditor.value.mode)}`;
    }

    if (currentPageViewer.value) {
      return `正在查看第 ${currentPageViewer.value.page_index} 页`;
    }

    return "当前无人查看";
  });

  const requestedEditorMode = computed<TranslatorMode>(() => {
    return resolveRequestedEditorModeFromRoute();
  });

  const currentPageLockHint = computed(() => {
    if (
      editorMode.value === "translate" &&
      isCurrentPageTranslationCompleted.value
    ) {
      return "本页翻译已完成，可回退后继续编辑或切换到校对模式";
    }

    if (!currentPageEditor.value || !isCurrentPageLockedByOther.value) {
      return currentPageStatusText.value;
    }

    return `${resolveCollaboratorLockingText(currentPageEditor.value)}，当前页面仅可查看`;
  });

  const currentPageCanEditTranslate = computed(() => {
    return (
      editorMode.value === "translate" &&
      !isCurrentPageTranslationCompleted.value &&
      !isCurrentPageLockedByOther.value &&
      !isAcquiringPageLock.value
    );
  });

  const currentPageCanEditProofread = computed(() => {
    return (
      editorMode.value === "proofread" &&
      !isCurrentPageLockedByOther.value &&
      !isAcquiringPageLock.value
    );
  });

  const currentPageCanMutateStructure = computed(() => {
    return (
      editorMode.value === "translate" &&
      !isCurrentPageTranslationCompleted.value &&
      !isCurrentPageLockedByOther.value &&
      !isAcquiringPageLock.value
    );
  });

  const shouldShowCompletePageTranslationButton = computed(() => {
    return (
      isOnlineWorkspace.value &&
      editorMode.value === "translate"
    );
  });

  const canCompletePageTranslation = computed(() => {
    return (
      shouldShowCompletePageTranslationButton.value &&
      !isCurrentPageLockedByOther.value &&
      !isAcquiringPageLock.value &&
      currentPageUnits.value.every((projectUnit) => isUnitTranslated(projectUnit))
    );
  });

  const canRevertPageTranslationCompletion = computed(() => {
    return (
      shouldShowCompletePageTranslationButton.value &&
      isCurrentPageTranslationCompleted.value &&
      !isCurrentPageLockedByOther.value &&
      !isAcquiringPageLock.value
    );
  });

  const canTogglePageTranslationCompletion = computed(() => {
    return isCurrentPageTranslationCompleted.value
      ? canRevertPageTranslationCompletion.value
      : canCompletePageTranslation.value;
  });

  const currentPageTranslationCompletionTooltip = computed(() => {
    return isCurrentPageTranslationCompleted.value
      ? "回退本页翻译完成"
      : "确认本页已完成翻译";
  });

  const currentPageTranslationCompletionAriaLabel = computed(() => {
    return currentPageTranslationCompletionTooltip.value;
  });

  const canToggleProofreadAction = computed(() => {
    return (
      editorMode.value === "proofread" &&
      !isCurrentPageLockedByOther.value &&
      !isAcquiringPageLock.value
    );
  });

  const isCurrentFieldEditable = computed(() => {
    return activeTextField.value === "proofread_text"
      ? currentPageCanEditProofread.value
      : currentPageCanEditTranslate.value;
  });

  const pageSelectEntries = computed(() => {
    if (!projectRecord.value) {
      return [];
    }

    return projectRecord.value.pages.map((projectPage, index) => {
      const pageKey = isOnlineWorkspace.value
        ? buildOnlinePageCollaborationKey(chapterID.value, projectPage.id)
        : buildLocalProjectPageCollaborationKey(
            projectRecord.value!,
            projectPage,
          );
      const pageEditors = pageEditorsByPageKey.value[pageKey] ?? [];
      const visibleEditors = pageEditors.slice(0, 2);

      return {
        value: index,
        label: `第 ${projectPage.index} 页`,
        editors: pageEditors,
        visibleEditors,
        hiddenEditorCount: Math.max(
          pageEditors.length - visibleEditors.length,
          0,
        ),
      };
    });
  });

  const currentPageSelectEntry = computed(() => {
    return pageSelectEntries.value[currentPageIndex.value] ?? null;
  });

  const pageSelectWidthStyle = computed(() => {
    const currentEntry = currentPageSelectEntry.value;
    const currentLabel = currentEntry?.label ?? "第 1 页";
    const avatarCount = currentEntry?.visibleEditors.length ?? 0;
    const moreBadgeCount = currentEntry?.hiddenEditorCount ? 1 : 0;
    const estimatedWidth =
      52 + currentLabel.length * 11 + avatarCount * 18 + moreBadgeCount * 26;
    const nextWidth = Math.max(104, Math.min(208, estimatedWidth));

    return {
      width: `${nextWidth}px`,
    };
  });

  const shortcutHelpSections = computed<ShortcutHelpSection[]>(() => {
    return [
      {
        title: "标点操作",
        items: [
          { keys: "左键", description: "框内落点" },
          { keys: "右键", description: "框外落点" },
          { keys: "右键标记", description: "删除标点" },
          { keys: "Space", description: "编辑标点" },
        ],
      },
      {
        title: "页面导航",
        items: [
          { keys: "Tab", description: "下一个标点" },
          { keys: "Shift + Tab", description: "上一个标点" },
          { keys: "Ctrl + ← / →", description: "上一页 / 下一页" },
        ],
      },
    ];
  });

  const footerHintText = computed(() => {
    return "左键：框内 · 右键：框外 · 右键标记：删除 · Space：编辑";
  });

  const currentPageTranslatedCount = computed(() => {
    return currentPageUnits.value.filter((projectUnit) => {
      return isUnitTranslated(projectUnit);
    }).length;
  });

  const currentPageProofreadCount = computed(() => {
    return currentPageUnits.value.filter((projectUnit) => {
      return isUnitProofread(projectUnit);
    }).length;
  });

  const pageInboxCount = computed(() => {
    return currentPageUnits.value.filter((u) => u.is_bubble).length;
  });

  const pageOutboxCount = computed(() => {
    return currentPageUnits.value.filter((u) => !u.is_bubble).length;
  });

  const pageUntranslatedCount = computed(() => {
    return currentPageUnits.value.filter((u) => {
      return !isUnitTranslated(u);
    }).length;
  });

  let currentImageResolveToken = 0;
  let lastCollaborationFallbackAt = 0;

  watch(
    () => ({
      onlineMode: isOnlineWorkspace.value,
      nextChapterID: chapterID.value,
      worksetID:
        typeof route.query.worksetId === "string" ? route.query.worksetId : "",
      comicID:
        typeof route.query.comicId === "string" ? route.query.comicId : "",
      title: typeof route.query.title === "string" ? route.query.title : "",
      author: typeof route.query.author === "string" ? route.query.author : "",
      chapterLabel:
        typeof route.query.chapterLabel === "string"
          ? route.query.chapterLabel
          : "",
      chapterSubtitle:
        typeof route.query.chapterSubtitle === "string"
          ? route.query.chapterSubtitle
          : "",
    }),
    async ({
      onlineMode,
      nextChapterID,
      worksetID,
      comicID,
      title,
      author,
      chapterLabel,
      chapterSubtitle,
    }) => {
      if (!onlineMode || !nextChapterID) {
        return;
      }

      try {
        await onlineWorkspaceStore.ensureChapterWorkspace({
          chapter_id: nextChapterID,
          workset_id: worksetID || undefined,
          comic_id: comicID || undefined,
          title: title || undefined,
          author: author || undefined,
          chapter_label: chapterLabel || undefined,
          chapter_subtitle: chapterSubtitle || undefined,
          return_workset_id: worksetID || undefined,
          return_comic_id: comicID || undefined,
        });
        void ensureOnlineAssignmentProfilesLoaded(nextChapterID);
      } catch (error) {
        console.error("[translator] 在线章节初始化失败:", error);
        message.error(
          error instanceof Error ? error.message : "在线章节初始化失败",
        );
      }
    },
    { immediate: true },
  );

  watch(
    projectRecord,
    (nextProjectRecord) => {
      if (!nextProjectRecord) {
        return;
      }

      if (!isOnlineWorkspace.value) {
        localProjectsStore.setActiveProject(nextProjectRecord.id);
      }

      const nextPageIndex = Math.max(
        0,
        Math.min(
          nextProjectRecord.last_page_index,
          nextProjectRecord.pages.length - 1,
        ),
      );

      currentPageIndex.value = Number.isFinite(nextPageIndex)
        ? nextPageIndex
        : 0;
    },
    { immediate: true },
  );

  watch(
    currentPageID,
    async () => {
      const nextPage = currentPageMeta.value;

      if (!nextPage) {
        currentPageUnits.value = [];
        selectedUnitID.value = null;
        editingUnitID.value = null;
        currentPageImageURL.value = null;
        await translatorCollaborationStore.disconnectProjectSession();
        return;
      }

      resetStageTransform();
      currentPageUnits.value = [];
      selectedUnitID.value = null;
      editingUnitID.value = null;
      currentPageImageURL.value = null;
      imageLoading.value = true;
      const resolveToken = ++currentImageResolveToken;

      try {
        let resolvedPage = nextPage;

        if (isOnlineWorkspace.value) {
          const cachedPage = await onlineWorkspaceStore.ensurePageImageCached(
            chapterID.value,
            nextPage.id,
          );

          if (cachedPage) {
            resolvedPage = cachedPage;
          }
        }

        const nextUnits = cloneUnits(
          isOnlineWorkspace.value
            ? await onlineWorkspaceStore.loadPageUnits(
                chapterID.value,
                nextPage.id,
              )
            : await localProjectsStore.loadProjectPageUnits(
                projectID.value,
                nextPage.id,
              ),
        );

        if (resolveToken !== currentImageResolveToken) {
          return;
        }

        currentPageUnits.value = nextUnits;
        selectedUnitID.value = nextUnits[0]?.id ?? null;
        editingUnitID.value = null;

        if (isOnlineWorkspace.value) {
          void ensureOnlineAssignmentProfilesLoaded(chapterID.value);
        }

        void ensureCurrentPageOwnerProfilesLoaded(nextUnits);
        void syncCurrentPageCollaborationSession();

        let resolvedURL: string | null = null;

        try {
          resolvedURL = await resolveLocalProjectImageURL(
            resolvedPage.image_source,
          );
        } catch (err) {
          console.error(
            "[translator] 图片解析失败:",
            resolvedPage.image_source,
            err,
          );
        }

        if (resolveToken !== currentImageResolveToken) {
          return;
        }

        currentPageImageURL.value = resolvedURL;
        imageLoading.value = false;

        if (isOnlineWorkspace.value) {
          onlineWorkspaceStore.schedulePagePrefetch(
            chapterID.value,
            currentPageIndex.value,
          );
        }
      } catch (error) {
        console.error("[translator] 页面加载失败:", error);

        if (resolveToken !== currentImageResolveToken) {
          return;
        }

        currentPageUnits.value = [];
        selectedUnitID.value = null;
        editingUnitID.value = null;
        currentPageImageURL.value = null;
        imageLoading.value = false;
        message.error(error instanceof Error ? error.message : "页面加载失败");
      }
    },
    { immediate: true },
  );

  watch(
    requestedEditorMode,
    (nextMode) => {
      if (editorMode.value !== nextMode) {
        editorMode.value = nextMode;
      }
    },
    { immediate: true },
  );

  watch(editorMode, (nextMode) => {
    if (route.query.mode !== nextMode) {
      void router.replace({
        query: {
          ...route.query,
          mode: nextMode,
          role: undefined,
        },
      });
    }

    activeTextField.value =
      nextMode === "proofread" ? "proofread_text" : "translated_text";

    if (!selectedUnitID.value) {
      void syncCurrentPageLockMode();
      return;
    }

    focusActiveFieldLater(
      Boolean(resolveSelectedTextareaTarget(document.activeElement)),
    );
    void syncCurrentPageLockMode();
  });

  watch(currentPageSnapshot, (nextSnapshot) => {
    if (!nextSnapshot) {
      return;
    }

    rememberCollaboratorIdentity({
      user_id: nextSnapshot.updated_by_user_id,
      display_name: nextSnapshot.updated_by_display_name,
      avatar_url: resolveKnownCollaboratorIdentity(
        nextSnapshot.updated_by_user_id,
      )?.avatar_url,
    });

    if (
      nextSnapshot.updated_by_user_id === currentUserProfile.value?.id &&
      hasCurrentPageLock.value
    ) {
      return;
    }

    applyIncomingPageSnapshot(nextSnapshot);
  });

  const currentOnlineWorkspaceArgs = computed(() => {
    if (!isOnlineWorkspace.value || !chapterID.value) {
      return null;
    }

    return {
      chapter_id: chapterID.value,
      workset_id: onlineWorkspaceRecord.value?.workset_id,
      comic_id: onlineWorkspaceRecord.value?.comic_id,
      title: onlineWorkspaceRecord.value?.title || undefined,
      author: onlineWorkspaceRecord.value?.author || undefined,
      chapter_label: onlineWorkspaceRecord.value?.chapter_label || undefined,
      chapter_subtitle:
        onlineWorkspaceRecord.value?.chapter_subtitle || undefined,
      return_workset_id: onlineWorkspaceRecord.value?.return_workset_id,
      return_comic_id: onlineWorkspaceRecord.value?.return_comic_id,
    };
  });

  watch(isCurrentPageLockedByOther, (lockedByOther) => {
    if (!lockedByOther) {
      return;
    }

    resolveActiveFieldElement()?.blur();
    editingUnitID.value = null;
  });

  /**
   * 复制一份 unit 列表，避免直接修改 store 内部对象引用。
   */
  function cloneUnits(units: LocalProjectUnit[]): LocalProjectUnit[] {
    return units.map((projectUnit) => ({
      ...projectUnit,
    }));
  }

  /**
   * 生成用于本地协作的“最近编辑信息”。
   */
  function buildTouchedUnit(
    projectUnit: LocalProjectUnit,
    patch: Partial<LocalProjectUnit>,
  ): LocalProjectUnit {
    return {
      ...projectUnit,
      ...patch,
      revision: Math.max(projectUnit.revision ?? 1, 1) + 1,
      last_edited_by: currentUserDisplayName.value,
      last_edited_at: Date.now(),
    };
  }

  function resolveOwnershipPatch(
    role: UnitOwnerRole,
  ): Pick<LocalProjectUnit, "translator_id" | "proofreader_id"> {
    const currentUserID = resolveCurrentUserID();
    if (!currentUserID) {
      return {};
    }

    return role === "proofread"
      ? { proofreader_id: currentUserID }
      : { translator_id: currentUserID };
  }

  /**
   * 统一应用远端页面快照，并同步回本地持久化层。
   */
  function applyIncomingPageSnapshot(snapshot: TranslatorPageSnapshot): void {
    if (
      !projectRecord.value ||
      !currentPageMeta.value ||
      snapshot.page_key !== currentPageCollaborationKey.value
    ) {
      return;
    }

    const nextUnits = cloneUnits(snapshot.units);
    currentPageUnits.value = nextUnits;
    void ensureCurrentPageOwnerProfilesLoaded(nextUnits);

    if (isOnlineWorkspace.value) {
      onlineWorkspaceStore.replaceRuntimePageUnits(
        currentPageMeta.value.id,
        nextUnits,
      );
    } else {
      localProjectsStore.replacePageUnits(
        projectRecord.value.id,
        currentPageMeta.value.id,
        nextUnits,
      );
    }

    if (
      selectedUnitID.value &&
      !nextUnits.some((projectUnit) => projectUnit.id === selectedUnitID.value)
    ) {
      selectedUnitID.value = nextUnits[0]?.id ?? null;
    }

    if (
      editingUnitID.value &&
      !nextUnits.some((projectUnit) => projectUnit.id === editingUnitID.value)
    ) {
      editingUnitID.value = null;
    }

    focusActiveFieldLater(false);
  }

  function handlePageSelectChange(nextPageIndex: number): void {
    moveToPage(Number(nextPageIndex));
  }

  function notifyCollaborationFallback(messageText: string): void {
    const now = Date.now();
    if (now - lastCollaborationFallbackAt < 2500) {
      return;
    }

    lastCollaborationFallbackAt = now;
    message.warning(messageText);
  }

  async function syncCurrentPageCollaborationSession(): Promise<void> {
    if (!projectRecord.value || !currentPageMeta.value) {
      await translatorCollaborationStore.disconnectProjectSession();
      return;
    }

    if (!authStore.isLoggedIn || !currentUserProfile.value?.id) {
      await translatorCollaborationStore.disconnectProjectSession();
      return;
    }

    try {
      await translatorCollaborationStore.connectProjectSession({
        project_key: projectCollaborationKey.value,
        user_id: currentUserProfile.value.id,
        display_name: currentUserDisplayName.value,
        avatar_url: currentUserAvatarSyncURL.value || undefined,
      });

      const remoteSnapshot = await translatorCollaborationStore.openPage({
        project_key: projectCollaborationKey.value,
        page_key: currentPageCollaborationKey.value,
        page_index: currentPageMeta.value.index,
        page_name: currentPageMeta.value.name,
        mode: editorMode.value,
        units: currentPageUnits.value,
      });

      if (remoteSnapshot) {
        applyIncomingPageSnapshot(remoteSnapshot);
      }
    } catch (error) {
      console.error("[translator] 实时协作连接失败:", error);
      notifyCollaborationFallback("实时协作连接失败，当前继续使用本地编辑");
    }
  }

  async function syncCurrentPageLockMode(): Promise<void> {
    try {
      await translatorCollaborationStore.updateActiveMode(editorMode.value);
    } catch (error) {
      console.error("[translator] 页面锁模式同步失败:", error);
    }
  }

  async function ensureCurrentPageEditLock(
    mode: TranslatorMode,
  ): Promise<boolean> {
    if (!authStore.isLoggedIn || !currentUserProfile.value?.id) {
      return true;
    }

    if (isCurrentPageLockedByOther.value) {
      message.warning(currentPageLockHint.value);
      return false;
    }

    if (hasCurrentPageLock.value) {
      if (currentPageEditor.value?.mode !== mode) {
        await syncCurrentPageLockMode();
      }

      return true;
    }

    try {
      if (!isCollaborationConnected.value) {
        await syncCurrentPageCollaborationSession();
      }

      isAcquiringPageLock.value = true;
      const acquired =
        await translatorCollaborationStore.tryAcquirePageLock(mode);

      if (!acquired) {
        message.warning(currentPageLockHint.value);
      }

      return acquired;
    } catch (error) {
      console.error("[translator] 获取页面锁失败:", error);
      notifyCollaborationFallback("协作服务暂不可用，当前退回本地编辑");
      return true;
    } finally {
      isAcquiringPageLock.value = false;
    }
  }

  /**
   * 生成本地 unit ID。
   */
  function createUnitID(): string {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `unit_${crypto.randomUUID()}`;
    }

    return `unit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * 判断文本是否有内容。
   */
  function hasTextContent(rawText: string | undefined): boolean {
    return typeof rawText === "string" && rawText.trim().length > 0;
  }

  function isUnitTranslated(projectUnit: LocalProjectUnit): boolean {
    return (
      hasTextContent(projectUnit.translated_text) ||
      hasTextContent(projectUnit.proofread_text)
    );
  }

  function isUnitProofread(projectUnit: LocalProjectUnit): boolean {
    return (
      projectUnit.is_proofread || hasTextContent(projectUnit.proofread_text)
    );
  }

  /**
   * 将当前页草稿同步回 store，并更新项目统计。
   */
  function persistCurrentPageUnits(nextUnits: LocalProjectUnit[]): void {
    if (!projectRecord.value || !currentPageMeta.value) {
      return;
    }

    currentPageUnits.value = nextUnits.map((projectUnit, index) => ({
      ...projectUnit,
      index: index + 1,
    }));

    if (isOnlineWorkspace.value) {
      onlineWorkspaceStore.schedulePageUnitsSave(
        chapterID.value,
        currentPageMeta.value.id,
        currentPageUnits.value,
      );
      onlineWorkspaceStore.replaceRuntimePageUnits(
        currentPageMeta.value.id,
        currentPageUnits.value,
      );
    } else {
      localProjectsStore.replacePageUnits(
        projectRecord.value.id,
        currentPageMeta.value.id,
        currentPageUnits.value,
      );
    }

    translatorCollaborationStore.schedulePageSnapshotSync(
      currentPageUnits.value,
    );
  }

  /**
   * 图片加载失败回调。
   */
  function handleImageError(): void {
    imageLoading.value = false;
    currentPageImageURL.value = null;
  }

  /**
   * 切换翻译/校对模式。
   */
  function toggleEditorMode(): void {
    editorMode.value =
      editorMode.value === "translate" ? "proofread" : "translate";
    message.success(
      editorMode.value === "translate"
        ? "已切换到翻译模式"
        : "已切换到校对模式",
    );
  }

  /**
   * 返回指定页。
   */
  async function handleReturnToWorkspace(): Promise<void> {
    if (projectRecord.value) {
      if (isOnlineWorkspace.value) {
        onlineWorkspaceStore.updateLastPageIndex(
          chapterID.value,
          currentPageIndex.value,
        );
        await onlineWorkspaceStore.flushChapterSaves(chapterID.value);
      } else {
        localProjectsStore.updateLastPageIndex(
          projectRecord.value.id,
          currentPageIndex.value,
        );
      }
    }

    await translatorCollaborationStore.disconnectProjectSession();

    if (
      isOnlineWorkspace.value &&
      onlineWorkspaceRecord.value?.return_workset_id
    ) {
      await router.push({
        name: "workset-detail",
        params: {
          id: onlineWorkspaceRecord.value.return_workset_id,
        },
        query: {
          comicId: onlineWorkspaceRecord.value.return_comic_id || undefined,
        },
      });
      return;
    }

    await router.push("/workspace");
  }

  /**
   * 切换到指定页。
   */
  function moveToPage(nextPageIndex: number): void {
    if (!projectRecord.value) {
      return;
    }

    const clampedIndex = Math.max(
      0,
      Math.min(nextPageIndex, projectRecord.value.pages.length - 1),
    );

    currentPageIndex.value = clampedIndex;
    if (isOnlineWorkspace.value) {
      onlineWorkspaceStore.updateLastPageIndex(chapterID.value, clampedIndex);
    } else {
      localProjectsStore.updateLastPageIndex(
        projectRecord.value.id,
        clampedIndex,
      );
    }
  }

  function moveToPreviousPage(): void {
    moveToPage(currentPageIndex.value - 1);
  }

  function moveToNextPage(): void {
    moveToPage(currentPageIndex.value + 1);
  }

  /**
   * 根据点击位置在画布上创建新标记。
   */
  async function createUnitAtPointer(
    event: MouseEvent,
    isBubble: boolean,
  ): Promise<void> {
    if (!currentPageCanMutateStructure.value) {
      message.warning(currentPageLockHint.value);
      return;
    }

    if (!(await ensureCurrentPageEditLock("translate"))) {
      return;
    }

    const overlayElement = stageOverlayRef.value;

    if (!overlayElement) {
      return;
    }

    const overlayRect = overlayElement.getBoundingClientRect();
    const normalizedX = (event.clientX - overlayRect.left) / overlayRect.width;
    const normalizedY = (event.clientY - overlayRect.top) / overlayRect.height;

    const newUnit: LocalProjectUnit = {
      id: createUnitID(),
      index: currentPageUnits.value.length + 1,
      x_coord: Math.max(0, Math.min(1, normalizedX)),
      y_coord: Math.max(0, Math.min(1, normalizedY)),
      ...getDefaultLocalProjectUnitBoxSize(isBubble),
      is_bubble: isBubble,
      is_proofread: false,
      translated_text: "",
      proofread_text: "",
      translator_comment: "",
      translator_id: resolveCurrentUserID(),
      proofreader_comment: "",
      revision: 1,
      last_edited_by: currentUserDisplayName.value,
      last_edited_at: Date.now(),
    };

    persistCurrentPageUnits([...currentPageUnits.value, newUnit]);
    selectedUnitID.value = newUnit.id;
    focusActiveFieldLater();
  }

  function clearSelectedUnit(): void {
    editingUnitID.value = null;
    selectedUnitID.value = null;
  }

  function resolveFinalUnitText(projectUnit: LocalProjectUnit): string {
    if (hasTextContent(projectUnit.proofread_text)) {
      return projectUnit.proofread_text.trim();
    }

    if (hasTextContent(projectUnit.translated_text)) {
      return projectUnit.translated_text.trim();
    }

    return "";
  }

  async function refreshCurrentOnlineWorkspace(): Promise<void> {
    if (!currentOnlineWorkspaceArgs.value) {
      return;
    }

    await onlineWorkspaceStore.ensureChapterWorkspace(
      currentOnlineWorkspaceArgs.value,
    );
  }

  function resolvePageCompletionBlockedReason(): string {
    if (isCurrentPageLockedByOther.value) {
      return currentPageLockHint.value;
    }

    if (isAcquiringPageLock.value) {
      return "正在获取页面锁，请稍后再试";
    }

    if (isCurrentPageTranslationCompleted.value) {
      return currentPageLockHint.value;
    }

    if (!currentPageUnits.value.every((projectUnit) => isUnitTranslated(projectUnit))) {
      return "当前页面仍有未翻译标记";
    }

    return currentPageLockHint.value;
  }

  function handleCompletePageTranslation(): void {
    if (!currentPageMeta.value || !isOnlineWorkspace.value) {
      return;
    }

    if (!canTogglePageTranslationCompletion.value) {
      message.warning(resolvePageCompletionBlockedReason());
      return;
    }

    const targetPageID = currentPageMeta.value.id;
    const targetPageLabel = currentPageMeta.value.name;
    const totalUnitCount = currentPageUnits.value.length;
    const isReverting = isCurrentPageTranslationCompleted.value;

    Modal.confirm({
      title: isReverting ? "回退本页翻译完成" : "确认本页已完成翻译",
      content: isReverting
        ? `${targetPageLabel} 将恢复为可继续翻译状态，确认回退吗？`
        : totalUnitCount > 0
          ? `${targetPageLabel} 的 ${totalUnitCount} 个标记都将锁定为已完成翻译，确认继续吗？`
          : `${targetPageLabel} 当前没有标记，确认按空白页处理并标记翻译完成吗？`,
      okText: isReverting ? "确认回退" : "确认完成",
      cancelText: "取消",
      async onOk() {
        if (!(await ensureCurrentPageEditLock("translate"))) {
          return;
        }

        isCompletingCurrentPageTranslation.value = true;

        try {
          if (!isReverting) {
            await onlineWorkspaceStore.flushPageUnits(chapterID.value, targetPageID);
            await completePageTranslation(targetPageID);
          } else {
            await revertPageTranslationCompletion(targetPageID);
          }

          await refreshCurrentOnlineWorkspace();
          message.success(
            isReverting
              ? `${targetPageLabel} 已回退为可继续翻译`
              : `${targetPageLabel} 已确认翻译完成`,
          );
        } catch (error) {
          message.error(
            error instanceof Error
              ? error.message
              : isReverting
                ? "回退页面翻译完成失败"
                : "确认页面翻译完成失败",
          );
          throw error;
        } finally {
          isCompletingCurrentPageTranslation.value = false;
        }
      },
    });
  }

  function resolveProofreadBubbleStyle(
    projectUnit: LocalProjectUnit,
  ): Record<string, string> {
    return {
      left: `${projectUnit.x_coord * 100}%`,
      top: `${projectUnit.y_coord * 100}%`,
      transform: "translate(-50%, calc(-100% - 20px))",
    };
  }

  function handleOverlayClick(event: MouseEvent): void {
    if (stageDragMoved || markerDragMoved) return;

    if (selectedUnitID.value) {
      clearSelectedUnit();
      return;
    }

    void createUnitAtPointer(event, true);
  }

  function handleOverlayContextMenu(event: MouseEvent): void {
    if (stageDragMoved || markerDragMoved) return;

    if (selectedUnitID.value) {
      clearSelectedUnit();
      return;
    }

    void createUnitAtPointer(event, false);
  }

  /**
   * 选中指定标记。
   */
  function handleSelectUnit(unitID: string, shouldFocus = true): void {
    selectedUnitID.value = unitID;
    editingUnitID.value = null;
    focusActiveFieldLater(shouldFocus);
  }

  /**
   * 更新选中标记的任意字段。
   */
  function updateSelectedUnitField(
    field: EditableFieldKey,
    nextValue: string,
  ): void {
    if (!selectedUnit.value) {
      return;
    }

    const nextUnits = currentPageUnits.value.map((projectUnit) => {
      if (projectUnit.id !== selectedUnit.value?.id) {
        return projectUnit;
      }

      return buildTouchedUnit(projectUnit, {
        ...resolveOwnershipPatch(
          field === "proofread_text" ? "proofread" : "translate",
        ),
        [field]: nextValue,
      } as Partial<LocalProjectUnit>);
    });

    persistCurrentPageUnits(nextUnits);
  }

  /**
   * 处理编辑器输入。
   */
  function handleTextFieldInput(field: EditableFieldKey, event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    updateSelectedUnitField(field, target.value);
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  }

  /**
   * 清空选中标记的指定字段。
   */
  async function clearFieldValue(field: EditableFieldKey): Promise<void> {
    const requiredMode = field === "proofread_text" ? "proofread" : "translate";
    if (!(await ensureCurrentPageEditLock(requiredMode))) {
      return;
    }

    updateSelectedUnitField(field, "");
    focusActiveFieldLater();
  }

  async function handleUnitFieldFocus(
    field: EditableFieldKey,
    event: FocusEvent,
  ): Promise<void> {
    activeTextField.value = field;

    const requiredMode = field === "proofread_text" ? "proofread" : "translate";
    if (editorMode.value !== requiredMode) {
      return;
    }

    if (!(await ensureCurrentPageEditLock(requiredMode))) {
      (event.target as HTMLTextAreaElement | null)?.blur();
      return;
    }

    editingUnitID.value = selectedUnitID.value;
  }

  function handleUnitFieldBlur(): void {
    window.requestAnimationFrame(() => {
      editingUnitID.value = resolveSelectedTextareaTarget(
        document.activeElement,
      )
        ? selectedUnitID.value
        : null;
    });
  }

  function canDirectPassProofread(projectUnit: LocalProjectUnit): boolean {
    return (
      editorMode.value === "proofread" &&
      hasTextContent(projectUnit.translated_text) &&
      !isUnitProofread(projectUnit)
    );
  }

  function resolveProofreadActionText(projectUnit: LocalProjectUnit): string {
    if (canDirectPassProofread(projectUnit)) {
      return "过";
    }

    return "✓";
  }

  function resolveProofreadActionTitle(projectUnit: LocalProjectUnit): string {
    if (projectUnit.is_proofread) {
      return "取消校对";
    }

    if (hasTextContent(projectUnit.proofread_text)) {
      return "已有校对内容";
    }

    if (canDirectPassProofread(projectUnit)) {
      return "直接通过校对";
    }

    return "标记已校对";
  }

  /**
   * 切换框内/框外。
   */
  async function toggleSelectedUnitBubble(): Promise<void> {
    if (!selectedUnit.value) {
      return;
    }

    if (!currentPageCanMutateStructure.value) {
      message.warning(currentPageLockHint.value);
      return;
    }

    if (!(await ensureCurrentPageEditLock("translate"))) {
      return;
    }

    const nextUnits = currentPageUnits.value.map((projectUnit) => {
      if (projectUnit.id !== selectedUnit.value?.id) {
        return projectUnit;
      }

      return buildTouchedUnit(projectUnit, {
        is_bubble: !projectUnit.is_bubble,
      });
    });

    persistCurrentPageUnits(nextUnits);
  }

  /**
   * 切换校对状态。
   */
  async function toggleSelectedUnitProofread(): Promise<void> {
    if (!selectedUnit.value) {
      return;
    }

    if (!canToggleProofreadAction.value) {
      message.warning(currentPageLockHint.value);
      return;
    }

    if (!(await ensureCurrentPageEditLock("proofread"))) {
      return;
    }

    const nextUnits = currentPageUnits.value.map((projectUnit) => {
      if (projectUnit.id !== selectedUnit.value?.id) {
        return projectUnit;
      }

      return buildTouchedUnit(projectUnit, {
        ...resolveOwnershipPatch("proofread"),
        is_proofread: !projectUnit.is_proofread,
      });
    });

    persistCurrentPageUnits(nextUnits);
  }

  /**
   * 删除指定标记。
   */
  async function requestRemoveUnit(unitID: string): Promise<void> {
    if (!currentPageCanMutateStructure.value) {
      message.warning(currentPageLockHint.value);
      return;
    }

    if (!(await ensureCurrentPageEditLock("translate"))) {
      return;
    }

    const targetUnit = currentPageUnits.value.find(
      (projectUnit) => projectUnit.id === unitID,
    );

    if (!targetUnit) {
      return;
    }

    const performRemove = (): void => {
      const nextUnits = currentPageUnits.value.filter(
        (projectUnit) => projectUnit.id !== unitID,
      );
      persistCurrentPageUnits(nextUnits);

      if (selectedUnitID.value === unitID) {
        selectedUnitID.value = nextUnits[0]?.id ?? null;
      }

      message.success("标记已删除");
    };

    if (
      hasTextContent(targetUnit.translated_text) ||
      hasTextContent(targetUnit.proofread_text) ||
      hasTextContent(targetUnit.translator_comment) ||
      hasTextContent(targetUnit.proofreader_comment)
    ) {
      Modal.confirm({
        title: "删除标记",
        content: "该标记已经填写过内容，确认删除吗？",
        okText: "确认删除",
        cancelText: "取消",
        onOk() {
          performRemove();
        },
      });
      return;
    }

    performRemove();
  }

  /**
   * 计算标记按钮位置。
   */
  function resolveMarkerStyle(
    projectUnit: LocalProjectUnit,
  ): Record<string, string> {
    return {
      left: `${projectUnit.x_coord * 100}%`,
      top: `${projectUnit.y_coord * 100}%`,
    };
  }

  /**
   * 返回当前激活字段对应的文本框元素。
   */
  function resolveActiveFieldElement(): HTMLTextAreaElement | null {
    return document.querySelector(
      `.translator-unit-card.is-active textarea[data-field="${activeTextField.value}"]`,
    ) as HTMLTextAreaElement | null;
  }

  function resolveSelectedUnitCardElement(): HTMLElement | null {
    return document.querySelector(
      ".translator-unit-card.is-active",
    ) as HTMLElement | null;
  }

  function resolveSelectedTextareaTarget(
    target: EventTarget | null,
  ): HTMLTextAreaElement | null {
    const element = target as HTMLElement | null;

    if (!(element instanceof HTMLTextAreaElement)) {
      return null;
    }

    return element.closest(".translator-unit-card.is-active") ? element : null;
  }

  function isEditableFieldKey(
    field: string | undefined,
  ): field is EditableFieldKey {
    return field === "translated_text" || field === "proofread_text";
  }

  function isShortcutBlockedTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;

    if (!element) {
      return false;
    }

    if (isTypingTarget(target)) {
      return true;
    }

    return Boolean(element.closest("button, a, [role='button'], .ant-btn"));
  }

  function syncTextareaDraft(
    textareaElement: HTMLTextAreaElement | null,
  ): void {
    if (!textareaElement || !selectedUnit.value) {
      return;
    }

    const field = textareaElement.dataset.field;

    if (!isEditableFieldKey(field)) {
      return;
    }

    const nextValue = textareaElement.value;

    if (nextValue === selectedUnit.value[field]) {
      return;
    }

    updateSelectedUnitField(field, nextValue);
  }

  function commitSelectedUnitEditing(
    eventTarget?: EventTarget | null,
    shouldClearSelection = false,
  ): void {
    if (!selectedUnitID.value) {
      return;
    }

    const activeCard = resolveSelectedUnitCardElement();

    activeCard
      ?.querySelectorAll<HTMLTextAreaElement>("textarea[data-field]")
      .forEach((textareaElement) => {
        syncTextareaDraft(textareaElement);
      });

    const targetElement = eventTarget as HTMLElement | null;

    if (targetElement && activeCard?.contains(targetElement)) {
      targetElement.blur();
    } else {
      resolveActiveFieldElement()?.blur();
    }

    editingUnitID.value = null;

    if (shouldClearSelection) {
      clearSelectedUnit();
    }
  }

  function exitSelectedUnitEditing(eventTarget?: EventTarget | null): void {
    commitSelectedUnitEditing(eventTarget, true);
  }

  /**
   * 切换选中标记后，让当前模式对应的文本框自动聚焦。
   */
  function focusActiveFieldLater(shouldFocus = true): void {
    void nextTick(() => {
      window.requestAnimationFrame(() => {
        const activeCard = resolveSelectedUnitCardElement();

        activeCard
          ?.querySelectorAll<HTMLTextAreaElement>("textarea")
          .forEach((textareaElement) => {
            textareaElement.style.height = "auto";
            textareaElement.style.height = `${textareaElement.scrollHeight}px`;
          });

        if (shouldFocus && isCurrentFieldEditable.value) {
          resolveActiveFieldElement()?.focus();
        }

        activeCard?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    });
  }

  /**
   * 向当前激活文本框插入快捷符号。
   */
  async function insertQuickSymbol(symbolValue: string): Promise<void> {
    if (!selectedUnit.value) {
      return;
    }

    const requiredMode =
      activeTextField.value === "proofread_text" ? "proofread" : "translate";
    if (!(await ensureCurrentPageEditLock(requiredMode))) {
      return;
    }

    const targetElement = resolveActiveFieldElement();
    const currentValue = selectedUnit.value[activeTextField.value];

    if (!targetElement) {
      updateSelectedUnitField(
        activeTextField.value,
        `${currentValue}${symbolValue}`,
      );
      return;
    }

    const selectionStart = targetElement.selectionStart ?? currentValue.length;
    const selectionEnd = targetElement.selectionEnd ?? currentValue.length;
    const nextValue = `${currentValue.slice(0, selectionStart)}${symbolValue}${currentValue.slice(selectionEnd)}`;

    updateSelectedUnitField(activeTextField.value, nextValue);

    window.requestAnimationFrame(() => {
      targetElement.focus();
      const nextCaretPosition = selectionStart + symbolValue.length;
      targetElement.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  }

  /**
   * 循环切换标记。
   */
  function moveSelectedUnit(direction: 1 | -1): void {
    if (currentPageUnits.value.length === 0) {
      return;
    }

    const currentIndex = currentPageUnits.value.findIndex((projectUnit) => {
      return projectUnit.id === selectedUnitID.value;
    });

    if (currentIndex < 0) {
      const fallbackIndex =
        direction === -1 ? currentPageUnits.value.length - 1 : 0;

      selectedUnitID.value = currentPageUnits.value[fallbackIndex].id;
      editingUnitID.value = null;
      focusActiveFieldLater(false);
      return;
    }

    const nextIndex =
      (currentIndex + direction + currentPageUnits.value.length) %
      currentPageUnits.value.length;

    selectedUnitID.value = currentPageUnits.value[nextIndex].id;
    editingUnitID.value = null;
    focusActiveFieldLater(false);
  }

  /* ── 图片缩放 & 平移 ── */
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 5;

  const zoomDisplayText = computed(() => {
    return Math.round(stageScale.value * 100) + "%";
  });

  function handleStageWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;
    event.preventDefault();

    const stageEl = (event.currentTarget as HTMLElement) ?? null;
    if (!stageEl) return;

    const rect = stageEl.getBoundingClientRect();
    const cursorX = event.clientX - rect.left - rect.width / 2;
    const cursorY = event.clientY - rect.top - rect.height / 2;

    const prevScale = stageScale.value;
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    const nextScale = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, prevScale * factor),
    );
    const ratio = 1 - nextScale / prevScale;

    stagePanX.value += (cursorX - stagePanX.value) * ratio;
    stagePanY.value += (cursorY - stagePanY.value) * ratio;
    stageScale.value = nextScale;
  }

  function handleStageDragStart(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    isDragging.value = true;
    stageDragMoved = false;
    dragLastX = event.clientX;
    dragLastY = event.clientY;
  }

  function handleStageDragMove(event: MouseEvent): void {
    if (draggingUnitID.value) {
      handleMarkerDragMove(event);
      return;
    }
    if (!isDragging.value) return;
    const dx = event.clientX - dragLastX;
    const dy = event.clientY - dragLastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      stageDragMoved = true;
    }
    stagePanX.value += dx;
    stagePanY.value += dy;
    dragLastX = event.clientX;
    dragLastY = event.clientY;
  }

  function handleStageDragEnd(event?: MouseEvent): void {
    if (draggingUnitID.value) {
      handleMarkerDragEnd(event);
      return;
    }
    isDragging.value = false;
  }

  function handleGlobalMouseMove(event: MouseEvent): void {
    if (draggingUnitID.value) {
      event.preventDefault();
      handleMarkerDragMove(event);
      return;
    }

    if (!isDragging.value) {
      return;
    }

    event.preventDefault();
    handleStageDragMove(event);
  }

  function handleGlobalMouseUp(event: MouseEvent): void {
    if (draggingUnitID.value) {
      handleMarkerDragEnd(event);
    }

    if (isDragging.value) {
      handleStageDragEnd(event);
    }
  }

  /* ── 标记拖拽 ── */
  function handleMarkerDragStart(event: MouseEvent, unitID: string): void {
    if (!currentPageCanMutateStructure.value) {
      message.warning(currentPageLockHint.value);
      return;
    }

    const unit = currentPageUnits.value.find((u) => u.id === unitID);
    if (!unit) return;

    void (async () => {
      if (!(await ensureCurrentPageEditLock("translate"))) {
        return;
      }

      draggingUnitID.value = unitID;
      markerDragStartX = event.clientX;
      markerDragStartY = event.clientY;
      markerDragOrigX = unit.x_coord;
      markerDragOrigY = unit.y_coord;
      markerDragMoved = false;
      event.preventDefault();
    })();
  }

  function handleMarkerDragMove(event: MouseEvent): void {
    if (!draggingUnitID.value) return;
    const overlayEl = stageOverlayRef.value;
    if (!overlayEl) return;

    const dx = event.clientX - markerDragStartX;
    const dy = event.clientY - markerDragStartY;
    if (!markerDragMoved && Math.abs(dx) + Math.abs(dy) < 4) return;
    markerDragMoved = true;

    const overlayRect = overlayEl.getBoundingClientRect();
    const nextX = markerDragOrigX + dx / overlayRect.width;
    const nextY = markerDragOrigY + dy / overlayRect.height;

    const nextUnits = currentPageUnits.value.map((u) => {
      if (u.id !== draggingUnitID.value) return u;
      return buildTouchedUnit(u, {
        x_coord: Math.max(0, Math.min(1, nextX)),
        y_coord: Math.max(0, Math.min(1, nextY)),
      });
    });
    persistCurrentPageUnits(nextUnits);
  }

  function handleMarkerDragEnd(event?: MouseEvent): void {
    if (!draggingUnitID.value) return;
    const unitID = draggingUnitID.value;
    const didMove = markerDragMoved;
    draggingUnitID.value = null;
    if (event) {
      handleSelectUnit(unitID, !didMove);
    }
  }

  function resolveCollaboratorTooltip(
    pageEditor: TranslatorPageEditorState,
  ): string {
    return isPageLockHolder(pageEditor)
      ? resolveCollaboratorLockingText(pageEditor)
      : resolveCollaboratorViewingText(pageEditor);
  }

  function resolvePageEditorKey(pageEditor: TranslatorPageEditorState): string {
    return `${pageEditor.page_key}:${pageEditor.user_id}:${pageEditor.editor_state}:${pageEditor.acquired_at}`;
  }

  function resolveCollaboratorAvatarInitial(
    pageEditor: TranslatorPageEditorState,
  ): string {
    return pageEditor.display_name.trim().charAt(0).toUpperCase() || "协";
  }

  function resetStageTransform(): void {
    stageScale.value = 1;
    stagePanX.value = 0;
    stagePanY.value = 0;
  }

  function handleGlobalKeyup(): void {
    // 保留事件监听接口以备后续扩展
  }

  function syncDarkThemeState(): void {
    isDarkTheme.value = document.documentElement.dataset.theme === "dark";
  }

  async function syncCurrentUserProfile(
    options?: SyncCurrentUserProfileOptions,
  ): Promise<void> {
    if (options?.clearDisplayAssetCache) {
      clearDisplayAssetUrlCaches();
    }

    if (!authStore.isLoggedIn) {
      currentUserAvatarCacheBustToken.value = 0;
      currentUserProfile.value = null;
      await translatorCollaborationStore.disconnectProjectSession();
      return;
    }

    try {
      currentUserProfile.value = await getCurrentUserProfile();
      if (currentUserProfile.value) {
        setRelatedUserProfile(currentUserProfile.value);
        rememberCollaboratorIdentity({
          user_id: currentUserProfile.value.id,
          display_name: currentUserDisplayName.value,
          avatar_url:
            currentUserAvatarSyncURL.value ||
            resolveUserAvatarRawURL(currentUserProfile.value),
        });
      }
    } catch {
      currentUserProfile.value = null;
    }

    await syncCurrentPageCollaborationSession();
  }

  function handleUserProfileUpdated(): void {
    currentUserAvatarCacheBustToken.value = Date.now();
    void syncCurrentUserProfile({
      clearDisplayAssetCache: true,
    });
  }

  /**
   * 判断当前按键是否发生在输入控件中。
   */
  function isTypingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;

    if (!element) {
      return false;
    }

    return (
      element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.tagName === "SELECT" ||
      element.isContentEditable
    );
  }

  /**
   * 全局快捷键处理。
   */
  function handleGlobalKeydown(event: KeyboardEvent): void {
    if (!projectRecord.value) {
      return;
    }

    if (event.isComposing) {
      return;
    }

    const selectedTextareaTarget = resolveSelectedTextareaTarget(event.target);
    const isShortcutBlocked = isShortcutBlockedTarget(event.target);

    if (event.key === "Escape" && selectedUnitID.value) {
      if (document.querySelector(".ant-modal-root .ant-modal-wrap")) {
        return;
      }

      event.preventDefault();
      exitSelectedUnitEditing(event.target);
      return;
    }

    if (event.key === "Enter" && selectedTextareaTarget && !event.shiftKey) {
      event.preventDefault();
      commitSelectedUnitEditing(event.target);
      return;
    }

    if (event.key === "F1" || event.key === "PageUp") {
      event.preventDefault();
      moveToPreviousPage();
      return;
    }

    if (event.key === "F2" || event.key === "PageDown") {
      event.preventDefault();
      moveToNextPage();
      return;
    }

    if (event.ctrlKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      editorMode.value =
        editorMode.value === "translate" ? "proofread" : "translate";
      message.success(
        editorMode.value === "translate"
          ? "已切换到翻译模式"
          : "已切换到校对模式",
      );
      return;
    }

    if (
      event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey &&
      !isShortcutBlocked
    ) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveToPreviousPage();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveToNextPage();
        return;
      }
    }

    if (
      (event.key === "ArrowUp" || event.key === "ArrowDown") &&
      !isShortcutBlocked
    ) {
      event.preventDefault();
      moveSelectedUnit(event.key === "ArrowUp" ? -1 : 1);
      return;
    }

    if (
      (event.key === " " || event.code === "Space") &&
      selectedUnitID.value &&
      !isShortcutBlocked
    ) {
      event.preventDefault();
      focusActiveFieldLater();
      return;
    }

    if (event.key === "Tab" && !isShortcutBlocked) {
      event.preventDefault();
      moveSelectedUnit(event.shiftKey ? -1 : 1);
      return;
    }

    if (event.key === "Delete" && !isShortcutBlocked && selectedUnitID.value) {
      event.preventDefault();
      void requestRemoveUnit(selectedUnitID.value);
      return;
    }

    if (event.ctrlKey && event.key === "0") {
      event.preventDefault();
      resetStageTransform();
    }
  }

  onMounted(() => {
    syncDarkThemeState();
    void syncCurrentUserProfile();

    window.addEventListener(
      USER_PROFILE_UPDATED_EVENT,
      handleUserProfileUpdated,
    );
    window.addEventListener("keydown", handleGlobalKeydown);
    window.addEventListener("keyup", handleGlobalKeyup);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    themeObserver = new MutationObserver(() => {
      syncDarkThemeState();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  });

  watch(
    () => authStore.isLoggedIn,
    () => {
      void syncCurrentUserProfile();
    },
    { immediate: false },
  );

  onBeforeUnmount(() => {
    window.removeEventListener(
      USER_PROFILE_UPDATED_EVENT,
      handleUserProfileUpdated,
    );
    window.removeEventListener("keydown", handleGlobalKeydown);
    window.removeEventListener("keyup", handleGlobalKeyup);
    window.removeEventListener("mousemove", handleGlobalMouseMove);
    window.removeEventListener("mouseup", handleGlobalMouseUp);

    themeObserver?.disconnect();
    themeObserver = null;
    if (isOnlineWorkspace.value && chapterID.value) {
      void onlineWorkspaceStore.flushChapterSaves(chapterID.value);
    }
    void translatorCollaborationStore.disconnectProjectSession();
  });

  return {
    projectRecord,
    isDragging,
    draggingUnitID,
    handleReturnToWorkspace,
    workspaceHeaderTitle,
    activeProjectEditors,
    resolvePageEditorKey,
    resolveCollaboratorTooltip,
    resolveDisplayAssetUrl,
    resolveCollaboratorAvatarInitial,
    resolveUnitOwnerAvatarURL,
    resolveUnitOwnerInitial,
    resolveUnitOwnerDisplayName,
    currentPageMeta,
    currentPageIndex,
    moveToPreviousPage,
    handlePageSelectChange,
    pageSelectEntries,
    pageSelectWidthStyle,
    shortcutHelpSections,
    currentPageStatusText,
    isCurrentPageLockedByOther,
    shouldShowCompletePageTranslationButton,
    canTogglePageTranslationCompletion,
    currentPageTranslationCompletionTooltip,
    currentPageTranslationCompletionAriaLabel,
    isCurrentPageTranslationCompleted,
    isCompletingCurrentPageTranslation,
    handleCompletePageTranslation,
    moveToNextPage,
    currentPageImageURL,
    clearSelectedUnit,
    pageInboxCount,
    pageOutboxCount,
    pageUntranslatedCount,
    currentPageTranslatedCount,
    currentPageProofreadCount,
    stageOverlayRef,
    stageTransformStyle,
    handleStageWheel,
    handleStageDragStart,
    handleImageError,
    imageLoading,
    currentPageUnits,
    editorMode,
    hasTextContent,
    resolveFinalUnitText,
    isDarkTheme,
    selectedUnitID,
    resolveProofreadBubbleStyle,
    resolveMarkerStyle,
    handleOverlayClick,
    handleOverlayContextMenu,
    handleSelectUnit,
    requestRemoveUnit,
    handleMarkerDragStart,
    editingUnitID,
    isUnitTranslated,
    isUnitProofread,
    currentPageCanMutateStructure,
    toggleSelectedUnitBubble,
    currentPageCanEditTranslate,
    handleUnitFieldFocus,
    handleUnitFieldBlur,
    handleTextFieldInput,
    clearFieldValue,
    currentPageCanEditProofread,
    customSymbols,
    isCurrentFieldEditable,
    insertQuickSymbol,
    canToggleProofreadAction,
    canDirectPassProofread,
    resolveProofreadActionTitle,
    toggleSelectedUnitProofread,
    resolveProofreadActionText,
    footerHintText,
    zoomDisplayText,
    toggleEditorMode,
    isWorkspaceLoading,
    workspaceLoadingTip,
    workspaceEmptyDescription,
  };
}
