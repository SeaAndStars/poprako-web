<template>
  <div class="workspace-layout">
    <header class="workspace-header mm-hero__layout">
      <div class="workspace-header__title-container mm-hero__copy">
        <span class="mm-hero__eyebrow">
          <FolderOpenOutlined />
          Comic Worksets
        </span>
        <h1
          class="workspace-header__title mm-hero__title"
          style="margin-top: 8px"
        >
          漫画项目管理
        </h1>
        <p class="workspace-header__subtitle mm-hero__description">
          在此管理团队的漫画项目、封面与默认岗位分配。
        </p>
      </div>

      <div class="workspace-header__actions mm-hero__toolbar">
        <div class="mm-hero__field">
          <span class="mm-hero__field-label">所属团队</span>
          <a-select
            v-model:value="currentTeamId"
            class="mm-hero__team-select"
            style="width: 220px"
            :options="teamOptions"
            placeholder="请选择查看团队"
            @change="handleTeamChange"
          />
        </div>

        <div class="mm-hero__field workset-toolbar__search">
          <span class="mm-hero__field-label">模糊搜索</span>
          <a-input-search
            v-model:value="searchKeyword"
            allow-clear
            class="workset-toolbar__search-input"
            placeholder="搜索项目名 / 简介 / 作者 / 状态"
            :disabled="!currentTeamId"
            @search="handleSearch"
          />
        </div>

        <div class="mm-hero__action-group" style="align-items: flex-end">
          <a-button
            v-if="canCreateWorkset"
            type="primary"
            @click="openCreateModal"
          >
            <template #icon>
              <PlusOutlined />
            </template>
            新建漫画项目
          </a-button>
        </div>
      </div>
    </header>

    <main class="workspace-content">
      <a-spin :spinning="loadingWorksets" tip="正在加载漫画项目...">
        <div v-if="!currentTeamId" class="worksets-empty-state">
          <a-empty
            description="请先在上方选择一个你参与的团队，即可查看或管理该团队下的漫画项目。"
          />
        </div>
        <div v-else-if="worksets.length === 0" class="worksets-empty-state">
          <a-empty :description="resolveEmptyDescription()" />
        </div>
        <div v-else class="workset-grid">
          <a-card
            v-for="workset in worksets"
            :key="workset.id"
            hoverable
            class="workset-card"
            @click="goToDetail(workset.id)"
          >
            <template #cover>
              <div class="workset-card__cover">
                <a-image
                  v-if="resolveWorksetCoverUrl(workset)"
                  class="workset-card__cover-media"
                  :src="resolveWorksetCoverUrl(workset)"
                  :alt="`${workset.name} 封面`"
                  :preview="false"
                />
                <div
                  v-else
                  class="workset-card__cover-media workset-card__cover-placeholder"
                ></div>

                <div class="workset-card__cover-top">
                  <a-tooltip
                    v-if="resolveMissingDefaultRoleBadge(workset)"
                    :title="resolveMissingDefaultRoleTooltip(workset)"
                  >
                    <span
                      class="workset-card__cover-pill workset-card__cover-pill--warning"
                    >
                      {{ resolveMissingDefaultRoleBadge(workset) }}
                    </span>
                  </a-tooltip>
                </div>

                <div class="workset-card__cover-overlay">
                  <span class="workset-card__chapter-count">
                    {{ resolveWorksetCoverLabel(workset) }}
                  </span>
                </div>
              </div>
            </template>
            <a-card-meta :title="workset.name">
              <template #description>
                <div class="workset-card__meta">
                  <div class="workset-card__summary-row">
                    <div class="workset-card__author">
                      <UserOutlined />
                      {{ workset.author || "作者未填写" }}
                    </div>
                    <a-tag :color="resolveWorksetExternalStatusColor(workset)">
                      对外 {{ resolveWorksetExternalStatusText(workset) }}
                    </a-tag>
                  </div>
                  <div
                    class="workset-card__status workset-card__status--description"
                  >
                    {{ workset.description || "暂无项目简介" }}
                  </div>
                </div>
              </template>
            </a-card-meta>
          </a-card>
        </div>
      </a-spin>
    </main>

    <WorksetCreateModal
      v-model:open="isCreateModalOpen"
      :team-id="currentTeamId"
      @created="loadWorksets"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import {
  FolderOpenOutlined,
  PlusOutlined,
  UserOutlined,
} from "@ant-design/icons-vue";

import { getMyMembers, getMyTeams, getWorksetList } from "../../api/modules";
import { appendCacheBustQueryToUrl } from "../../api/objectStorage";
import { useBlobAssetUrlCache } from "../../composables/useBlobAssetUrlCache";
import { useAuthStore } from "../../stores/auth";
import type { MemberInfo, TeamInfo, WorksetInfo } from "../../types/domain";
import WorksetCreateModal from "./WorksetCreateModal.vue";
import { resolveWorksetStatusColor } from "./worksetStatus";

const router = useRouter();
const authStore = useAuthStore();

const teams = ref<TeamInfo[]>([]);
const myMembers = ref<MemberInfo[]>([]);
const currentTeamId = ref<string | undefined>(undefined);
const worksets = ref<WorksetInfo[]>([]);
const isCreateModalOpen = ref(false);
const loadingWorksets = ref(false);
const searchKeyword = ref("");
let searchDebounceTimer: number | undefined;
const { resolveDisplayAssetUrl } = useBlobAssetUrlCache();

const teamOptions = computed(() => {
  return teams.value.map((team) => ({
    label: team.name,
    value: team.id,
  }));
});

const canCreateWorkset = computed(() => {
  if (!currentTeamId.value) {
    return false;
  }

  return myMembers.value.some(
    (member) =>
      member.team_id === currentTeamId.value &&
      Boolean(member.assigned_admin_at),
  );
});

function resolvePreferredTeamId(teamList: TeamInfo[]): string | undefined {
  const preferredTeamId = authStore.currentTeamId || undefined;
  if (preferredTeamId && teamList.some((team) => team.id === preferredTeamId)) {
    return preferredTeamId;
  }

  if (
    currentTeamId.value &&
    teamList.some((team) => team.id === currentTeamId.value)
  ) {
    return currentTeamId.value;
  }

  return teamList[0]?.id;
}

onMounted(async () => {
  try {
    await authStore.ensureCurrentUserProfileLoaded().catch(() => undefined);

    const [teamList, memberList] = await Promise.all([
      getMyTeams({ offset: 0, limit: 100 }),
      getMyMembers({ offset: 0, limit: 100 }),
    ]);

    teams.value = teamList;
    myMembers.value = memberList;

    currentTeamId.value = resolvePreferredTeamId(teamList);
    if (currentTeamId.value) {
      authStore.setCurrentTeamId(currentTeamId.value);
      await loadWorksets();
    } else {
      authStore.clearCurrentTeamId();
    }
  } catch (error) {
    console.error("初始化工作集列表失败", error);
  }
});

watch(searchKeyword, () => {
  if (!currentTeamId.value) {
    return;
  }

  if (searchDebounceTimer) {
    window.clearTimeout(searchDebounceTimer);
  }

  searchDebounceTimer = window.setTimeout(() => {
    void loadWorksets();
  }, 260);
});

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    window.clearTimeout(searchDebounceTimer);
  }
});

async function handleTeamChange(teamID: string) {
  currentTeamId.value = teamID;
  authStore.setCurrentTeamId(teamID);
  await loadWorksets();
}

async function loadWorksets() {
  if (!currentTeamId.value) {
    worksets.value = [];
    return;
  }

  loadingWorksets.value = true;

  try {
    worksets.value = await getWorksetList({
      team_id: currentTeamId.value,
      includes: ["team"],
      search: searchKeyword.value.trim() || undefined,
      offset: 0,
      limit: 100,
    });
  } catch (error) {
    worksets.value = [];
    console.error("加载工作集失败", error);
    message.error(error instanceof Error ? error.message : "加载工作集失败");
  } finally {
    loadingWorksets.value = false;
  }
}

async function handleSearch() {
  if (searchDebounceTimer) {
    window.clearTimeout(searchDebounceTimer);
  }

  await loadWorksets();
}

function openCreateModal() {
  if (!currentTeamId.value) {
    return;
  }

  isCreateModalOpen.value = true;
}

function resolveWorksetCoverUrl(workset: WorksetInfo): string | undefined {
  return resolveDisplayAssetUrl(
    appendCacheBustQueryToUrl(workset.cover_url, workset.updated_at),
  );
}

function resolveWorksetCoverLabel(workset: WorksetInfo): string {
  const comicCount = workset.comic_count ?? 0;
  if (comicCount > 1) {
    return `${comicCount} 部历史漫画`;
  }

  return comicCount === 1 ? "已初始化漫画" : "待初始化";
}

function resolveMissingDefaultRoleCount(workset: WorksetInfo): number {
  return [
    workset.translator_user_id,
    workset.proofreader_user_id,
    workset.typesetter_user_id,
    workset.reviewer_user_id,
  ].reduce((count, userID) => count + (userID ? 0 : 1), 0);
}

function resolveMissingDefaultRoleBadge(workset: WorksetInfo): string {
  const missingCount = resolveMissingDefaultRoleCount(workset);

  return missingCount > 0 ? `缺岗 ${missingCount}` : "";
}

function resolveMissingDefaultRoleTooltip(workset: WorksetInfo): string {
  const missingRoles = [
    !workset.translator_user_id ? "翻译" : "",
    !workset.proofreader_user_id ? "校对" : "",
    !workset.typesetter_user_id ? "嵌字" : "",
    !workset.reviewer_user_id ? "审稿" : "",
  ].filter(Boolean);

  return missingRoles.length
    ? `默认岗位缺人：${missingRoles.join("、")}`
    : "默认岗位已配齐";
}

function resolveWorksetExternalStatusText(workset: WorksetInfo): string {
  const explicitStatus = workset.status?.trim();

  if (explicitStatus) {
    return explicitStatus;
  }

  return (workset.comic_count ?? 0) > 0 ? "连载中" : "未填写";
}

function resolveWorksetExternalStatusColor(workset: WorksetInfo): string {
  const externalStatusText = resolveWorksetExternalStatusText(workset);

  return resolveWorksetStatusColor(
    externalStatusText === "未填写" ? undefined : externalStatusText,
  );
}

function goToDetail(worksetID: string) {
  router.push(`/worksets/${worksetID}?teamId=${currentTeamId.value}`);
}

function resolveEmptyDescription(): string {
  if (searchKeyword.value.trim()) {
    return "没有匹配当前关键词的漫画项目。";
  }

  return canCreateWorkset.value
    ? "当前团队还没有漫画项目，点击右上角创建第一个。"
    : "当前团队还没有漫画项目，需由团队管理员创建。";
}
</script>

<style scoped lang="scss">
.workspace-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background-color: var(--color-bg-container);
}

.workspace-header {
  padding: 24px 32px;
  border-bottom: 1px solid var(--color-border-secondary);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 24px;
}

.workspace-header__title-container {
  flex: 1 1 320px;
  min-width: 0;
}

.workspace-header__actions {
  flex: 1 1 640px;
  display: grid;
  grid-template-columns: minmax(220px, 240px) minmax(340px, 420px) auto;
  justify-content: end;
  align-items: end;
  gap: 16px;
}

.mm-hero__field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mm-hero__field-label {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.2;
}

.mm-hero__action-group {
  display: flex;
  justify-content: flex-end;
}

.workset-toolbar__search {
  min-width: 340px;
}

.workset-toolbar__search-input {
  width: 100%;
}

.worksets-empty-state {
  margin-top: 100px;
  display: flex;
  justify-content: center;
}

.workset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(192px, 1fr));
  gap: 18px;
  padding: 24px 24px 32px;
}

.workset-card {
  overflow: hidden;
  border-radius: 10px;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px -10px rgba(0, 0, 0, 0.15);
    border-color: var(--color-primary);

    .workset-card__cover-media {
      transform: scale(1.05);
    }
  }

  :deep(.ant-card-body) {
    padding: 12px 12px 14px;
  }

  &__cover {
    height: 248px;
    position: relative;
    overflow: hidden;
    border-radius: 10px 10px 0 0;
  }

  &__cover-media {
    display: block;
    width: 100%;
    height: 100%;
    transition: transform 0.4s ease;

    :deep(.ant-image),
    :deep(.ant-image-img) {
      display: block;
      width: 100%;
      height: 100%;
    }

    :deep(.ant-image-img) {
      object-fit: cover;
    }
  }

  &__cover-placeholder {
    background: linear-gradient(
      160deg,
      rgba(95, 20, 12, 0.94),
      rgba(177, 46, 31, 0.88) 55%,
      rgba(237, 195, 72, 0.72)
    );
  }

  &__cover-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 10px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
    color: white;
    display: flex;
    justify-content: flex-end;
  }

  &__cover-top {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    display: flex;
    justify-content: flex-start;
    pointer-events: none;
  }

  &__cover-pill {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 0 9px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    backdrop-filter: blur(8px);
    pointer-events: auto;
  }

  &__cover-pill--warning {
    color: #fff8eb;
    background: rgba(188, 87, 18, 0.82);
    border: 1px solid rgba(255, 214, 153, 0.42);
    box-shadow: 0 8px 18px rgba(120, 47, 9, 0.24);
  }

  &__chapter-count {
    font-size: 12px;
    background: rgba(0, 0, 0, 0.5);
    padding: 2px 8px;
    border-radius: 4px;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__author {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  &__status {
    color: var(--color-text-tertiary);
  }

  &__status--description {
    font-size: 13px;
    line-height: 1.45;
  }
}

@media (max-width: 900px) {
  .workspace-header__actions {
    width: 100%;
    grid-template-columns: 1fr;
    justify-content: stretch;
  }

  .workset-toolbar__search,
  .workset-toolbar__search-input {
    width: 100%;
    min-width: 0;
  }

  .mm-hero__action-group {
    justify-content: flex-start;
  }

  .workset-card__summary-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
