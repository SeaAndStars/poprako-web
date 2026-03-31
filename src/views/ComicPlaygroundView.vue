<template>
  <div class="comic-playground-layout">
    <header class="page-header">
      <div class="page-header__left">
        <span class="page-header__title">漫画广场</span>
        <span class="page-header__subtitle">Comic Playground</span>
      </div>

      <a-space>
        <a-button :loading="loading" @click="handleRefreshClick">
          刷新数据
        </a-button>
      </a-space>
    </header>

    <main class="page-content">
      <a-row :gutter="16" class="summary-row">
        <a-col
          v-for="summaryCard in summaryCards"
          :key="summaryCard.label"
          :xs="24"
          :md="12"
          :xl="6"
        >
          <a-card class="summary-card" :bordered="false">
            <a-statistic
              :title="summaryCard.label"
              :value="summaryCard.value"
            />
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :xs="24" :xl="10">
          <a-card title="工作集一览" :bordered="false" class="panel-card">
            <a-table
              :columns="worksetColumns"
              :data-source="worksets"
              row-key="id"
              :pagination="false"
              size="middle"
            />
          </a-card>
        </a-col>

        <a-col :xs="24" :xl="14">
          <a-card title="最近漫画" :bordered="false" class="panel-card">
            <a-list
              :data-source="recentComics"
              :locale="{ emptyText: '暂无漫画数据' }"
            >
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta :description="buildComicDescription(item)">
                    <template #title>
                      <a-space wrap>
                        <span>{{ item.title }}</span>
                        <a-tag color="processing">
                          {{ resolveWorksetName(item) }}
                        </a-tag>
                        <a-tag v-if="item.chapter_count" color="default">
                          {{ item.chapter_count }} 话
                        </a-tag>
                      </a-space>
                    </template>
                  </a-list-item-meta>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>
      </a-row>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { message, type TableColumnsType } from "ant-design-vue";
import { getComicList, getMyTeams, getWorksetList } from "../api/modules";
import type { ComicInfo, TeamInfo, WorksetInfo } from "../types/domain";

const loading = ref(false);
const teams = ref<TeamInfo[]>([]);
const worksets = ref<WorksetInfo[]>([]);
const comics = ref<ComicInfo[]>([]);

const worksetColumns: TableColumnsType<WorksetInfo> = [
  {
    title: "工作集",
    dataIndex: "name",
    key: "name",
  },
  {
    title: "所属团队",
    key: "team_name",
    customRender: ({ record }) => record.team?.name || resolveTeamName(record),
  },
  {
    title: "漫画数",
    dataIndex: "comic_count",
    key: "comic_count",
    customRender: ({ value }) => value ?? 0,
  },
  {
    title: "更新时间",
    dataIndex: "updated_at",
    key: "updated_at",
    customRender: ({ value }) => formatTimestamp(value),
  },
];

const summaryCards = computed(() => [
  {
    label: "我的团队数",
    value: teams.value.length,
  },
  {
    label: "工作集总数",
    value: worksets.value.length,
  },
  {
    label: "漫画总数",
    value: comics.value.length,
  },
  {
    label: "有内容工作集",
    value: worksets.value.filter((workset) => (workset.comic_count ?? 0) > 0)
      .length,
  },
]);

const recentComics = computed(() => {
  return [...comics.value]
    .sort((leftComic, rightComic) => {
      return resolveTimestamp(rightComic) - resolveTimestamp(leftComic);
    })
    .slice(0, 12);
});

function resolveTimestamp(comicInfo: ComicInfo): number {
  return Number(comicInfo.last_active_at ?? comicInfo.updated_at ?? 0);
}

function resolveTeamName(worksetInfo: WorksetInfo): string {
  return (
    teams.value.find((teamInfo) => teamInfo.id === worksetInfo.team_id)?.name ||
    "-"
  );
}

function resolveWorksetName(comicInfo: ComicInfo): string {
  return (
    comicInfo.workset?.name ||
    worksets.value.find(
      (worksetInfo) => worksetInfo.id === comicInfo.workset_id,
    )?.name ||
    "未归档工作集"
  );
}

function buildComicDescription(comicInfo: ComicInfo): string {
  const authorLabel = comicInfo.author?.trim() || "未知作者";
  const teamLabel = comicInfo.workset?.team?.name || "未匹配团队";
  return `作者：${authorLabel} · 团队：${teamLabel}`;
}

function formatTimestamp(rawTime: number | undefined): string {
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

async function refreshAllData(showSuccessMessage = true): Promise<void> {
  loading.value = true;

  try {
    const nextTeams = await getMyTeams({
      offset: 0,
      limit: 50,
    });
    teams.value = nextTeams;

    const worksetResults = await Promise.allSettled(
      nextTeams.map((teamInfo) =>
        getWorksetList({
          team_id: teamInfo.id,
          offset: 0,
          limit: 50,
          includes: ["team"],
        }),
      ),
    );

    const nextWorksets = worksetResults.flatMap((worksetResult, index) => {
      if (worksetResult.status !== "fulfilled") {
        return [];
      }

      if (!Array.isArray(worksetResult.value)) {
        return [];
      }

      return worksetResult.value.map((worksetInfo) => ({
        ...worksetInfo,
        team: worksetInfo.team ?? nextTeams[index],
      }));
    });

    worksets.value = nextWorksets;

    const comicResults = await Promise.allSettled(
      nextWorksets.map((worksetInfo) =>
        getComicList({
          workset_id: worksetInfo.id,
          offset: 0,
          limit: 20,
          includes: ["workset"],
        }),
      ),
    );

    comics.value = comicResults.flatMap((comicResult, index) => {
      if (comicResult.status !== "fulfilled") {
        return [];
      }

      if (!Array.isArray(comicResult.value)) {
        return [];
      }

      return comicResult.value.map((comicInfo) => ({
        ...comicInfo,
        workset: comicInfo.workset ?? nextWorksets[index],
      }));
    });

    if (showSuccessMessage) {
      const failedRequestCount =
        worksetResults.filter((result) => result.status === "rejected").length +
        comicResults.filter((result) => result.status === "rejected").length;

      if (failedRequestCount > 0) {
        message.warning("漫画广场已刷新，但部分数据加载失败");
      } else {
        message.success("漫画广场数据已刷新");
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "漫画广场数据加载失败";
    message.error(errorMessage);
  } finally {
    loading.value = false;
  }
}

function handleRefreshClick(): void {
  void refreshAllData();
}

onMounted(() => {
  void refreshAllData(false);
});
</script>

<style scoped lang="scss">
.comic-playground-layout {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  min-height: 56px;
  background: var(--dashboard-header-bg);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--dashboard-header-border);
  padding: 0 20px;
}

.page-header__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-header__title {
  font-size: 18px;
  font-weight: 600;
}

.page-header__subtitle {
  color: var(--text-muted);
  font-size: 12px;
}

.page-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px;
}

.summary-row {
  margin-bottom: 16px;
}

.summary-card {
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--panel-border);
  backdrop-filter: blur(14px) saturate(118%);
}

.panel-card {
  border-radius: 16px;
  margin-bottom: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  backdrop-filter: blur(16px) saturate(120%);
}

:global(.comic-playground-layout .ant-card-head) {
  border-bottom: 1px solid var(--table-border-color);
}

:global(.comic-playground-layout .ant-card-head-title) {
  color: var(--text-primary);
}

:global(.comic-playground-layout .ant-statistic-title) {
  color: var(--text-muted);
}

:global(.comic-playground-layout .ant-statistic-content) {
  color: var(--text-primary);
}

:global(.comic-playground-layout .ant-list-item) {
  border-bottom: 1px solid var(--table-border-color);
}

:global(.comic-playground-layout .ant-list-item-meta-title),
:global(.comic-playground-layout .ant-list-item-meta-description) {
  color: var(--text-primary);
}

@media (max-width: 900px) {
  .page-header__subtitle {
    display: none;
  }
}

:global(html[data-theme="dark"]) {
  .summary-card,
  .panel-card {
    background: var(--panel-bg);
    color: var(--text-primary);
  }

  .page-header__title {
    color: var(--text-primary);
  }
}
</style>
