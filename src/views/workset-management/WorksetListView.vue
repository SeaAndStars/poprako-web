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
      <div v-if="!currentTeamId" class="worksets-empty-state">
        <a-empty
          description="请先在上方选择一个你参与的团队，即可查看或管理该团队下的漫画项目。"
        />
      </div>
      <div v-else-if="worksets.length === 0" class="worksets-empty-state">
        <a-empty
          :description="
            canCreateWorkset
              ? '当前团队还没有漫画项目，点击右上角创建第一个。'
              : '当前团队还没有漫画项目，需由团队管理员创建。'
          "
        />
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
                <div class="workset-card__author">
                  <TeamOutlined />
                  {{ workset.team?.name || "未展开团队信息" }}
                </div>
                <div
                  class="workset-card__status workset-card__status--description"
                >
                  {{ workset.description || "等待添加章节" }}
                </div>
              </div>
            </template>
          </a-card-meta>
        </a-card>
      </div>
    </main>

    <WorksetCreateModal
      v-model:open="isCreateModalOpen"
      :team-id="currentTeamId"
      @created="loadWorksets"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  FolderOpenOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons-vue";

import { getMyMembers, getMyTeams, getWorksetList } from "../../api/modules";
import { appendCacheBustQueryToUrl } from "../../api/objectStorage";
import type { MemberInfo, TeamInfo, WorksetInfo } from "../../types/domain";
import WorksetCreateModal from "./WorksetCreateModal.vue";

const router = useRouter();

const teams = ref<TeamInfo[]>([]);
const myMembers = ref<MemberInfo[]>([]);
const currentTeamId = ref<string | undefined>(undefined);
const worksets = ref<WorksetInfo[]>([]);
const isCreateModalOpen = ref(false);

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

onMounted(async () => {
  try {
    const [teamList, memberList] = await Promise.all([
      getMyTeams({ offset: 0, limit: 100 }),
      getMyMembers({ offset: 0, limit: 100 }),
    ]);

    teams.value = teamList;
    myMembers.value = memberList;

    if (teamList.length > 0) {
      currentTeamId.value = teamList[0].id;
      await loadWorksets();
    }
  } catch (error) {
    console.error("初始化工作集列表失败", error);
  }
});

async function handleTeamChange(teamID: string) {
  currentTeamId.value = teamID;
  await loadWorksets();
}

async function loadWorksets() {
  if (!currentTeamId.value) {
    worksets.value = [];
    return;
  }

  try {
    worksets.value = await getWorksetList({
      team_id: currentTeamId.value,
      includes: ["team"],
      offset: 0,
      limit: 100,
    });
  } catch (error) {
    worksets.value = [];
    console.error("加载工作集失败", error);
  }
}

function openCreateModal() {
  if (!currentTeamId.value) {
    return;
  }

  isCreateModalOpen.value = true;
}

function resolveWorksetCoverUrl(workset: WorksetInfo): string | undefined {
  return appendCacheBustQueryToUrl(workset.cover_url, workset.updated_at);
}

function resolveWorksetCoverLabel(workset: WorksetInfo): string {
  const comicCount = workset.comic_count ?? 0;
  if (comicCount > 1) {
    return `${comicCount} 部历史漫画`;
  }

  return comicCount === 1 ? "已初始化漫画" : "待初始化";
}

function goToDetail(worksetID: string) {
  router.push(`/worksets/${worksetID}?teamId=${currentTeamId.value}`);
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
  gap: 24px;
}

.worksets-empty-state {
  margin-top: 100px;
  display: flex;
  justify-content: center;
}

.workset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
  padding: 32px;
}

.workset-card {
  overflow: hidden;
  border-radius: 12px;
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
    padding: 16px;
  }

  &__cover {
    height: 300px;
    position: relative;
    overflow: hidden;
    border-radius: 12px 12px 0 0;
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
    padding: 12px;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
    color: white;
    display: flex;
    justify-content: flex-end;
  }

  &__chapter-count {
    font-size: 13px;
    background: rgba(0, 0, 0, 0.5);
    padding: 2px 8px;
    border-radius: 4px;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__author {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-secondary);
  }

  &__status {
    color: var(--color-text-tertiary);
  }

  &__status--description {
    line-height: 1.5;
  }
}
</style>
