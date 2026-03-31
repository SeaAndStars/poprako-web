<template>
  <div class="dashboard-layout">
    <header class="dashboard-header">
      <div class="header-left">
        <span class="header-title">协作仪表盘</span>
        <span class="header-subtitle">Workset Overview</span>
      </div>
      <a-space>
        <a-button :loading="loading" @click="refreshAllData">刷新数据</a-button>
      </a-space>
    </header>

    <main class="dashboard-content">
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
        <a-col :xs="24" :xl="14">
          <a-card title="我的汉化组" :bordered="false" class="panel-card">
            <a-table
              :columns="teamColumns"
              :data-source="teams"
              row-key="id"
              :pagination="false"
              size="middle"
            />
          </a-card>
        </a-col>
        <a-col :xs="24" :xl="10">
          <a-card title="我的分配" :bordered="false" class="panel-card">
            <a-list
              :data-source="assignments"
              :locale="{ emptyText: '暂无分配' }"
            >
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta :description="`章节：${item.chapter_id}`">
                    <template #title>
                      <a-space>
                        <span>{{ item.id }}</span>
                        <a-tag :color="getRoleTagColor(item.role)">{{
                          item.role
                        }}</a-tag>
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
import { getMyAssignments, getMyTeams } from "../api/modules";
import type { AssignmentInfo, TeamInfo } from "../types/domain";

const loading = ref(false);
const teams = ref<TeamInfo[]>([]);
const assignments = ref<AssignmentInfo[]>([]);

const teamColumns: TableColumnsType<TeamInfo> = [
  {
    title: "团队名称",
    dataIndex: "name",
    key: "name",
  },
  {
    title: "描述",
    dataIndex: "description",
    key: "description",
    customRender: ({ value }) => value || "-",
  },
  {
    title: "创建时间",
    dataIndex: "created_at",
    key: "created_at",
    customRender: ({ value }) => formatDate(value),
  },
];

/**
 * 生成首页统计卡片数据。
 */
const summaryCards = computed(() => [
  {
    label: "我的团队数",
    value: teams.value.length,
  },
  {
    label: "我的分配数",
    value: assignments.value.length,
  },
  {
    label: "待处理任务",
    value: assignments.value.filter(
      (assignmentInfo) => assignmentInfo.role !== "done",
    ).length,
  },
  {
    label: "已完成任务",
    value: assignments.value.filter(
      (assignmentInfo) => assignmentInfo.role === "done",
    ).length,
  },
]);

/**
 * 拉取仪表盘依赖数据。
 * 该方法串行加载团队与分配数据，保证页面统计一致。
 */
async function refreshAllData(): Promise<void> {
  loading.value = true;
  try {
    const [myTeams, myAssignments] = await Promise.all([
      getMyTeams(),
      getMyAssignments({
        offset: 0,
        limit: 20,
      }),
    ]);
    teams.value = myTeams;
    assignments.value = myAssignments;
    message.success("数据已刷新");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "加载失败";
    message.error(errorMessage);
  } finally {
    loading.value = false;
  }
}

/**
 * 根据角色返回不同标签颜色。
 */
function getRoleTagColor(role: string): string {
  if (role === "done") {
    return "green";
  }
  if (role === "reviewer") {
    return "blue";
  }
  return "orange";
}

/**
 * 格式化时间字符串。
 */
function formatDate(rawTime: string | undefined): string {
  if (!rawTime) {
    return "-";
  }
  const date = new Date(rawTime);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

/**
 * 页面挂载时主动拉取数据。
 */
onMounted(async () => {
  await refreshAllData();
});
</script>

<style scoped lang="scss">
/* 仪表盘页面布局：仅保留业务头部与内容容器。 */
.dashboard-layout {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  min-height: 56px;
  background: var(--dashboard-header-bg);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--dashboard-header-border);
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
}

.header-subtitle {
  color: var(--text-muted);
  font-size: 12px;
}

.dashboard-content {
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

:global(.dashboard-layout .ant-card-head) {
  border-bottom: 1px solid var(--table-border-color);
}

:global(.dashboard-layout .ant-card-head-title) {
  color: var(--text-primary);
}

:global(.dashboard-layout .ant-statistic-title) {
  color: var(--text-muted);
}

:global(.dashboard-layout .ant-statistic-content) {
  color: var(--text-primary);
}

:global(.dashboard-layout .ant-list-item) {
  border-bottom: 1px solid var(--table-border-color);
}

:global(.dashboard-layout .ant-list-item-meta-title),
:global(.dashboard-layout .ant-list-item-meta-description) {
  color: var(--text-primary);
}

@media (max-width: 900px) {
  .header-subtitle {
    display: none;
  }
}

:global(html[data-theme="dark"]) {
  /* 暗黑模式颜色全部来自全局变量，页面仅声明文字行为。 */
  .summary-card,
  .panel-card {
    background: var(--panel-bg);
    color: var(--text-primary);
  }

  .header-title {
    color: var(--text-primary);
  }
}
</style>
