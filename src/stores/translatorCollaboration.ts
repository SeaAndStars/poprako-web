/**
 * 文件用途：维护 TranslatorView 的实时协作连接、页面锁与页面快照状态。
 * 当前实现采用“页面级独占编辑 + 整页快照广播”，避免为本轮需求引入 OT/CRDT 复杂度。
 */

import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
} from "@microsoft/signalr";
import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import type { TranslatorMode } from "../local-project/collaboration";
import {
  normalizeLocalProjectUnitGeometry,
  type LocalProjectUnit,
} from "../local-project/types";
import { useAuthStore } from "./auth";


export interface TranslatorCollaboratorIdentity {
  user_id: string;
  display_name: string;
  avatar_url?: string;
}

export type TranslatorPageEditorPresenceState = "viewing" | "lock_holder";

export interface TranslatorPageEditorState extends TranslatorCollaboratorIdentity {
  page_key: string;
  page_index: number;
  page_name: string;
  mode: TranslatorMode;
  editor_state: TranslatorPageEditorPresenceState;
  acquired_at: number;
}

export interface TranslatorProjectState {
  project_key: string;
  page_editors: TranslatorPageEditorState[];
}

export interface TranslatorPageSnapshot {
  project_key: string;
  page_key: string;
  page_index: number;
  page_name: string;
  mode: TranslatorMode;
  updated_by_user_id: string;
  updated_by_display_name: string;
  updated_at: number;
  units: LocalProjectUnit[];
}

interface JoinProjectArgs extends TranslatorCollaboratorIdentity {
  project_key: string;
}


interface OpenPageArgs {
  project_key: string;
  page_key: string;
  page_index: number;
  page_name: string;
  mode: TranslatorMode;
  units: LocalProjectUnit[];
}

type PendingSnapshotArgs = OpenPageArgs;

interface TryAcquirePageLockResult {
  acquired: boolean;
  editor?: TranslatorPageEditorState;
}

function isSameCollaboratorProfile(
  leftProfile: TranslatorCollaboratorIdentity | null,
  rightProfile: TranslatorCollaboratorIdentity,
): boolean {
  if (!leftProfile) {
    return false;
  }

  return (
    leftProfile.user_id === rightProfile.user_id &&
    leftProfile.display_name === rightProfile.display_name &&
    leftProfile.avatar_url === rightProfile.avatar_url
  );
}

function resolveHubURL(): string {
  const configuredBaseURL = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!configuredBaseURL) {
    if (window.location.protocol === "file:") {
      return "http://127.0.0.1:18881/hubs/translator-collaboration";
    }

    return `${window.location.origin}/hubs/translator-collaboration`;
  }

  const parsedBaseURL = new URL(configuredBaseURL, window.location.origin);
  parsedBaseURL.pathname = "/hubs/translator-collaboration";
  parsedBaseURL.search = "";
  parsedBaseURL.hash = "";
  return parsedBaseURL.toString();
}

function cloneUnits(units: LocalProjectUnit[]): LocalProjectUnit[] {
  return units.map((projectUnit, index) => ({
    ...normalizeLocalProjectUnitGeometry(projectUnit),
    index: index + 1,
  }));
}

function normalizeMode(rawMode: string | undefined): TranslatorMode {
  return rawMode === "proofread" ? "proofread" : "translate";
}


function normalizeEditorState(
  rawState: string | undefined,
): TranslatorPageEditorPresenceState {
  return rawState === "lock_holder" ? "lock_holder" : "viewing";
}

function sortProjectEditors(
  pageEditors: TranslatorPageEditorState[],
): TranslatorPageEditorState[] {
  return [...pageEditors].sort((leftEditor, rightEditor) => {
    if (leftEditor.page_index !== rightEditor.page_index) {
      return leftEditor.page_index - rightEditor.page_index;
    }

    if (leftEditor.editor_state !== rightEditor.editor_state) {
      return leftEditor.editor_state === "lock_holder" ? -1 : 1;
    }

    if (leftEditor.acquired_at !== rightEditor.acquired_at) {
      return rightEditor.acquired_at - leftEditor.acquired_at;
    }

    const userCompare = leftEditor.user_id.localeCompare(
      rightEditor.user_id,
    );
    if (userCompare !== 0) {
      return userCompare;
    }

    return leftEditor.page_key.localeCompare(rightEditor.page_key);
  });
}

function normalizeEditor(
  rawEditor: TranslatorPageEditorState,
): TranslatorPageEditorState {
  return {
    ...rawEditor,
    display_name: rawEditor.display_name?.trim() || "协作成员",
    avatar_url: rawEditor.avatar_url?.trim() || undefined,
    mode: normalizeMode(rawEditor.mode),
    editor_state: normalizeEditorState(rawEditor.editor_state),
    acquired_at: Number.isFinite(rawEditor.acquired_at)
      ? rawEditor.acquired_at
      : Date.now(),
  };
}

function normalizeProjectState(
  rawState: TranslatorProjectState | null | undefined,
): TranslatorProjectState | null {
  if (!rawState || !rawState.project_key) {
    return null;
  }

  return {
    project_key: rawState.project_key,
    page_editors: Array.isArray(rawState.page_editors)
      ? sortProjectEditors(
          rawState.page_editors.map((rawEditor) =>
            normalizeEditor(rawEditor),
          ),
        )
      : [],
  };
}

function normalizeSnapshot(
  rawSnapshot: TranslatorPageSnapshot | null | undefined,
): TranslatorPageSnapshot | null {
  if (!rawSnapshot || !rawSnapshot.page_key) {
    return null;
  }

  return {
    ...rawSnapshot,
    mode: normalizeMode(rawSnapshot.mode),
    units: cloneUnits(
      Array.isArray(rawSnapshot.units) ? rawSnapshot.units : [],
    ),
  };
}


function buildSessionPageEditor(args: {
  sessionProfile: TranslatorCollaboratorIdentity;
  pageKey: string;
  pageIndex: number;
  pageName: string;
  mode: TranslatorMode;
  editorState: TranslatorPageEditorPresenceState;
  acquiredAt?: number;
}): TranslatorPageEditorState {
  return normalizeEditor({
    user_id: args.sessionProfile.user_id,
    display_name: args.sessionProfile.display_name,
    avatar_url: args.sessionProfile.avatar_url,
    page_key: args.pageKey,
    page_index: args.pageIndex,
    page_name: args.pageName,
    mode: args.mode,
    editor_state: args.editorState,
    acquired_at: args.acquiredAt ?? Date.now(),
  });
}

function replaceSessionProjectEditors(
  currentState: TranslatorProjectState | null,
  sessionUserId: string,
  nextEditors: TranslatorPageEditorState[],
  fallbackProjectKey: string,
): TranslatorProjectState {
  const remainingEditors = (currentState?.page_editors ?? []).filter(
    (pageEditor) => pageEditor.user_id !== sessionUserId,
  );

  return (
    normalizeProjectState({
      project_key: currentState?.project_key || fallbackProjectKey,
      page_editors: [...remainingEditors, ...nextEditors],
    }) ?? {
      project_key: fallbackProjectKey,
      page_editors: sortProjectEditors(nextEditors),
    }
  );
}

function replacePageLockHolder(
  currentState: TranslatorProjectState | null,
  pageKey: string,
  nextLockHolder: TranslatorPageEditorState | undefined,
  fallbackProjectKey: string,
): TranslatorProjectState {
  const remainingEditors = (currentState?.page_editors ?? []).filter(
    (pageEditor) =>
      pageEditor.page_key !== pageKey ||
      pageEditor.editor_state !== "lock_holder",
  );

  return (
    normalizeProjectState({
      project_key: currentState?.project_key || fallbackProjectKey,
      page_editors: nextLockHolder
        ? [...remainingEditors, nextLockHolder]
        : remainingEditors,
    }) ?? {
      project_key: fallbackProjectKey,
      page_editors: nextLockHolder ? [nextLockHolder] : [],
    }
  );
}

export const useTranslatorCollaborationStore = defineStore(
  "translator-collaboration",
  () => {
    const authStore = useAuthStore();

    const connection = shallowRef<HubConnection | null>(null);
    const sessionProfile = ref<TranslatorCollaboratorIdentity | null>(null);
    const projectState = ref<TranslatorProjectState | null>(null);
    const pageSnapshots = ref<Record<string, TranslatorPageSnapshot>>({});
    const activeProjectKey = ref("");
    const activePageKey = ref("");
    const activePageIndex = ref(0);
    const activePageName = ref("");
    const activeMode = ref<TranslatorMode>("translate");
    const lastKnownUnitsByPageKey = ref<Record<string, LocalProjectUnit[]>>({});

    let pendingSnapshotTimer: number | null = null;
    let connectionStartPromise: Promise<HubConnection> | null = null;
    const pendingSnapshotArgs = ref<PendingSnapshotArgs | null>(null);

    const isConnected = computed(() => {
      return connection.value?.state === HubConnectionState.Connected;
    });


const pageEditorsByPageKey = computed<
  Record<string, TranslatorPageEditorState[]>
>(() => {
  const nextMap: Record<string, TranslatorPageEditorState[]> = {};

  projectState.value?.page_editors.forEach((pageEditor) => {
    nextMap[pageEditor.page_key] = [
      ...(nextMap[pageEditor.page_key] ?? []),
      pageEditor,
    ];
  });

  Object.keys(nextMap).forEach((pageKey) => {
    nextMap[pageKey] = sortProjectEditors(nextMap[pageKey]);
  });

  return nextMap;
});

const currentPageEditors = computed<TranslatorPageEditorState[]>(() => {
  if (!activePageKey.value) {
    return [];
  }

  return pageEditorsByPageKey.value[activePageKey.value] ?? [];
});

const currentPageEditor = computed<TranslatorPageEditorState | null>(() => {
  return (
    currentPageEditors.value.find(
      (pageEditor) => pageEditor.editor_state === "lock_holder",
    ) ?? null
  );
});

const hasCurrentPageLock = computed(() => {
  if (!sessionProfile.value || !currentPageEditor.value) {
    return false;
  }

  return currentPageEditor.value.user_id === sessionProfile.value.user_id;
});

const isCurrentPageLockedByOther = computed(() => {
  if (!currentPageEditor.value) {
    return false;
  }

  if (!sessionProfile.value) {
    return true;
  }

  return currentPageEditor.value.user_id !== sessionProfile.value.user_id;
});

function resetCollaborationState(clearProfile = true): void {
      projectState.value = null;
      pageSnapshots.value = {};
      activeProjectKey.value = "";
      activePageKey.value = "";
      activePageIndex.value = 0;
      activePageName.value = "";
      activeMode.value = "translate";
      lastKnownUnitsByPageKey.value = {};
      pendingSnapshotArgs.value = null;

      if (clearProfile) {
        sessionProfile.value = null;
      }
    }

    function clearPendingSnapshotTimer(): void {
      if (pendingSnapshotTimer !== null) {
        window.clearTimeout(pendingSnapshotTimer);
        pendingSnapshotTimer = null;
      }
    }

    function rememberSnapshot(snapshot: TranslatorPageSnapshot): void {
      pageSnapshots.value = {
        ...pageSnapshots.value,
        [snapshot.page_key]: snapshot,
      };
      lastKnownUnitsByPageKey.value = {
        ...lastKnownUnitsByPageKey.value,
        [snapshot.page_key]: cloneUnits(snapshot.units),
      };
    }

    function registerConnectionHandlers(nextConnection: HubConnection): void {
      nextConnection.on(
        "ProjectStateUpdated",
        (rawState: TranslatorProjectState) => {
          const normalizedState = normalizeProjectState(rawState);
          if (!normalizedState) {
            return;
          }

          if (
            activeProjectKey.value &&
            normalizedState.project_key !== activeProjectKey.value
          ) {
            return;
          }

          projectState.value = normalizedState;
        },
      );

      nextConnection.on(
        "PageSnapshotUpdated",
        (rawSnapshot: TranslatorPageSnapshot) => {
          const normalizedSnapshot = normalizeSnapshot(rawSnapshot);
          if (!normalizedSnapshot) {
            return;
          }

          rememberSnapshot(normalizedSnapshot);
        },
      );

      nextConnection.onreconnected(() => {
        void restoreSessionAfterReconnect();
      });

      nextConnection.onclose(() => {
        if (connection.value === nextConnection) {
          connection.value = null;
        }

        projectState.value = activeProjectKey.value
          ? {
              project_key: activeProjectKey.value,
              page_editors: [],
            }
          : null;

        clearPendingSnapshotTimer();
        pendingSnapshotArgs.value = null;
      });
    }

    async function ensureConnection(): Promise<HubConnection> {
      const activeConnection = connection.value;
      if (activeConnection?.state === HubConnectionState.Connected) {
        return activeConnection;
      }

      if (connectionStartPromise) {
        return connectionStartPromise;
      }

      connectionStartPromise = (async () => {
        const nextConnection = new HubConnectionBuilder()
          .withUrl(resolveHubURL(), {
            accessTokenFactory: () => authStore.accessToken,
            transport:
              HttpTransportType.WebSockets |
              HttpTransportType.ServerSentEvents |
              HttpTransportType.LongPolling,
            withCredentials: false,
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000])
          .configureLogging(
            import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning,
          )
          .build();

        registerConnectionHandlers(nextConnection);

        try {
          await nextConnection.start();
          connection.value = nextConnection;
          return nextConnection;
        } catch (error) {
          try {
            await nextConnection.stop();
          } catch {
            // 这里忽略 stop 的二次错误，保留原始启动错误给调用方。
          }

          throw error;
        }
      })();

      try {
        return await connectionStartPromise;
      } finally {
        connectionStartPromise = null;
      }
    }

    async function restoreSessionAfterReconnect(): Promise<void> {
      if (!sessionProfile.value || !activeProjectKey.value) {
        return;
      }

      const activeConnection = connection.value;
      if (
        !activeConnection ||
        activeConnection.state !== HubConnectionState.Connected
      ) {
        return;
      }

      try {
        const restoredState = normalizeProjectState(
          await activeConnection.invoke<TranslatorProjectState>("JoinProject", {
            project_key: activeProjectKey.value,
            display_name: sessionProfile.value.display_name,
            avatar_url: sessionProfile.value.avatar_url,
          }),
        );

        if (restoredState) {
          projectState.value = restoredState;
        }

        if (!activePageKey.value) {
          return;
        }

        const restoredSnapshot = normalizeSnapshot(
          await activeConnection.invoke<TranslatorPageSnapshot | null>(
            "OpenPage",
            {
              project_key: activeProjectKey.value,
              page_key: activePageKey.value,
              page_index: activePageIndex.value,
              page_name: activePageName.value,
              mode: activeMode.value,
              units: lastKnownUnitsByPageKey.value[activePageKey.value] ?? [],
            },
          ),
        );

        if (restoredSnapshot) {
          rememberSnapshot(restoredSnapshot);
        }
      } catch (error) {
        console.error("[translator-collaboration] 重连恢复失败:", error);
      }
    }

    async function connectProjectSession(args: JoinProjectArgs): Promise<void> {
      if (!authStore.isLoggedIn || !authStore.accessToken) {
        await disconnectProjectSession();
        return;
      }

      const nextProfile = {
        user_id: args.user_id,
        display_name: args.display_name.trim() || "协作成员",
        avatar_url: args.avatar_url?.trim() || undefined,
      };

      const shouldReuseActiveSession =
        activeProjectKey.value === args.project_key &&
        isSameCollaboratorProfile(sessionProfile.value, nextProfile) &&
        connection.value?.state === HubConnectionState.Connected &&
        projectState.value?.project_key === args.project_key;

      sessionProfile.value = nextProfile;

      if (shouldReuseActiveSession) {
        return;
      }

      if (
        activeProjectKey.value &&
        activeProjectKey.value !== args.project_key
      ) {
        clearPendingSnapshotTimer();
        pendingSnapshotArgs.value = null;
        pageSnapshots.value = {};
        lastKnownUnitsByPageKey.value = {};
        activePageKey.value = "";
        activePageIndex.value = 0;
        activePageName.value = "";
      }

      activeProjectKey.value = args.project_key;

      const activeConnection = await ensureConnection();
      const nextState = normalizeProjectState(
        await activeConnection.invoke<TranslatorProjectState>("JoinProject", {
          project_key: args.project_key,
          display_name: nextProfile.display_name,
          avatar_url: nextProfile.avatar_url,
        }),
      );

      if (nextState) {
        projectState.value = nextState;
      }
    }

    async function disconnectProjectSession(): Promise<void> {
      clearPendingSnapshotTimer();
      pendingSnapshotArgs.value = null;

      const activeConnection = connection.value;
      connection.value = null;
      resetCollaborationState();

      if (!activeConnection) {
        return;
      }

      try {
        await activeConnection.stop();
      } catch (error) {
        console.error("[translator-collaboration] 关闭协作连接失败:", error);
      }
    }


async function openPage(
  args: OpenPageArgs,
): Promise<TranslatorPageSnapshot | null> {
  const reopeningLockedPage =
    hasCurrentPageLock.value && activePageKey.value === args.page_key;

  await flushPendingPageSnapshotSync();

  activePageKey.value = args.page_key;
  activePageIndex.value = args.page_index;
  activePageName.value = args.page_name;
  activeMode.value = args.mode;
  lastKnownUnitsByPageKey.value = {
    ...lastKnownUnitsByPageKey.value,
    [args.page_key]: cloneUnits(args.units),
  };

  const activeSessionProfile = sessionProfile.value;
  if (activeSessionProfile) {
    const nextPresenceEditor = buildSessionPageEditor({
      sessionProfile: activeSessionProfile,
      pageKey: args.page_key,
      pageIndex: args.page_index,
      pageName: args.page_name,
      mode: args.mode,
      editorState: reopeningLockedPage ? "lock_holder" : "viewing",
    });

    projectState.value = replaceSessionProjectEditors(
      projectState.value,
      activeSessionProfile.user_id,
      [nextPresenceEditor],
      args.project_key,
    );
  }

  if (!activeSessionProfile || !authStore.isLoggedIn) {
    return null;
  }

  const activeConnection = await ensureConnection();
  const snapshot = normalizeSnapshot(
    await activeConnection.invoke<TranslatorPageSnapshot | null>(
      "OpenPage",
      {
        project_key: args.project_key,
        page_key: args.page_key,
        page_index: args.page_index,
        page_name: args.page_name,
        mode: args.mode,
        units: cloneUnits(args.units),
      },
    ),
  );

  if (snapshot) {
    rememberSnapshot(snapshot);
  }

  return snapshot;
}


async function tryAcquirePageLock(mode: TranslatorMode): Promise<boolean> {
  if (
    !sessionProfile.value ||
    !activeProjectKey.value ||
    !activePageKey.value
  ) {
    return false;
  }

  const activeConnection = connection.value;
  if (
    !activeConnection ||
    activeConnection.state !== HubConnectionState.Connected
  ) {
    throw new Error("实时协作连接尚未建立");
  }

  const result = await activeConnection.invoke<TryAcquirePageLockResult>(
    "TryAcquirePageLock",
    {
      project_key: activeProjectKey.value,
      page_key: activePageKey.value,
      page_index: activePageIndex.value,
      page_name: activePageName.value,
      mode,
    },
  );

  activeMode.value = mode;
  const activeSessionProfile = sessionProfile.value;

  if (result.acquired && activeSessionProfile) {
    const nextLockHolder = normalizeEditor(
      result.editor ??
        buildSessionPageEditor({
          sessionProfile: activeSessionProfile,
          pageKey: activePageKey.value,
          pageIndex: activePageIndex.value,
          pageName: activePageName.value,
          mode,
          editorState: "lock_holder",
        }),
    );

    projectState.value = replaceSessionProjectEditors(
      projectState.value,
      activeSessionProfile.user_id,
      [nextLockHolder],
      activeProjectKey.value,
    );
  } else if (result.editor) {
    projectState.value = replacePageLockHolder(
      projectState.value,
      activePageKey.value,
      normalizeEditor(result.editor),
      activeProjectKey.value,
    );
  }

  return result.acquired;
}


async function updateActiveMode(mode: TranslatorMode): Promise<void> {
  activeMode.value = mode;

  if (
    !hasCurrentPageLock.value ||
    !activeProjectKey.value ||
    !activePageKey.value
  ) {
    return;
  }

  const activeConnection = connection.value;
  if (
    !activeConnection ||
    activeConnection.state !== HubConnectionState.Connected
  ) {
    return;
  }

  await activeConnection.invoke("UpdatePageLockMode", {
    project_key: activeProjectKey.value,
    page_key: activePageKey.value,
    mode,
  });

  const activeSessionProfile = sessionProfile.value;
  if (currentPageEditor.value && activeSessionProfile) {
    const nextLockHolder = buildSessionPageEditor({
      sessionProfile: activeSessionProfile,
      pageKey: activePageKey.value,
      pageIndex: activePageIndex.value,
      pageName: activePageName.value,
      mode,
      editorState: "lock_holder",
      acquiredAt: Date.now(),
    });

    projectState.value = replaceSessionProjectEditors(
      projectState.value,
      activeSessionProfile.user_id,
      [nextLockHolder],
      activeProjectKey.value,
    );
  }
}


async function releaseCurrentPageLock(): Promise<void> {
  if (
    !hasCurrentPageLock.value ||
    !activeProjectKey.value ||
    !activePageKey.value
  ) {
    return;
  }

  await flushPendingPageSnapshotSync();

  const activeSessionProfile = sessionProfile.value;
  const viewingEditor = activeSessionProfile
    ? buildSessionPageEditor({
        sessionProfile: activeSessionProfile,
        pageKey: activePageKey.value,
        pageIndex: activePageIndex.value,
        pageName: activePageName.value,
        mode: activeMode.value,
        editorState: "viewing",
        acquiredAt: Date.now(),
      })
    : undefined;

  const activeConnection = connection.value;
  if (
    !activeConnection ||
    activeConnection.state !== HubConnectionState.Connected
  ) {
    if (activeSessionProfile && viewingEditor) {
      projectState.value = replaceSessionProjectEditors(
        projectState.value,
        activeSessionProfile.user_id,
        [viewingEditor],
        activeProjectKey.value,
      );
    }
    return;
  }

  await activeConnection.invoke("ReleaseCurrentPageLock", {
    project_key: activeProjectKey.value,
  });

  if (activeSessionProfile && viewingEditor) {
    projectState.value = replaceSessionProjectEditors(
      projectState.value,
      activeSessionProfile.user_id,
      [viewingEditor],
      activeProjectKey.value,
    );
  }
}

    function schedulePageSnapshotSync(units: LocalProjectUnit[]): void {
      if (!activeProjectKey.value || !activePageKey.value) {
        return;
      }

      const clonedUnits = cloneUnits(units);
      lastKnownUnitsByPageKey.value = {
        ...lastKnownUnitsByPageKey.value,
        [activePageKey.value]: clonedUnits,
      };

      if (!hasCurrentPageLock.value) {
        return;
      }

      pendingSnapshotArgs.value = {
        project_key: activeProjectKey.value,
        page_key: activePageKey.value,
        page_index: activePageIndex.value,
        page_name: activePageName.value,
        mode: activeMode.value,
        units: clonedUnits,
      };

      if (pendingSnapshotTimer !== null) {
        return;
      }

      pendingSnapshotTimer = window.setTimeout(() => {
        void flushPendingPageSnapshotSync();
      }, 120);
    }

    async function flushPendingPageSnapshotSync(): Promise<void> {
      clearPendingSnapshotTimer();

      const nextSnapshotArgs = pendingSnapshotArgs.value;
      pendingSnapshotArgs.value = null;

      if (
        !nextSnapshotArgs ||
        !sessionProfile.value ||
        !hasCurrentPageLock.value
      ) {
        return;
      }

      const activeConnection = connection.value;
      if (
        !activeConnection ||
        activeConnection.state !== HubConnectionState.Connected
      ) {
        return;
      }

      rememberSnapshot({
        project_key: nextSnapshotArgs.project_key,
        page_key: nextSnapshotArgs.page_key,
        page_index: nextSnapshotArgs.page_index,
        page_name: nextSnapshotArgs.page_name,
        mode: nextSnapshotArgs.mode,
        updated_by_user_id: sessionProfile.value.user_id,
        updated_by_display_name: sessionProfile.value.display_name,
        updated_at: Date.now(),
        units: cloneUnits(nextSnapshotArgs.units),
      });

      await activeConnection.invoke("SyncPageSnapshot", nextSnapshotArgs);
    }

    return {
      sessionProfile,
      projectState,
      pageSnapshots,
      activeProjectKey,
      activePageKey,
      activeMode,
      isConnected,
      pageEditorsByPageKey,
      currentPageEditors,
      currentPageEditor,
      hasCurrentPageLock,
      isCurrentPageLockedByOther,
      connectProjectSession,
      disconnectProjectSession,
      openPage,
      tryAcquirePageLock,
      updateActiveMode,
      releaseCurrentPageLock,
      schedulePageSnapshotSync,
      flushPendingPageSnapshotSync,
    };
  },
);
