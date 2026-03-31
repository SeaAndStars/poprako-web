<template>
  <div class="member-list-layout">
    <header class="page-header">
      <div class="page-header__left">
        <span class="page-header__title">成员一览</span>
        <span class="page-header__subtitle">Team Members</span>
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
        <a-col :xs="24" :xl="16">
          <a-card title="成员列表" :bordered="false" class="panel-card">
            <a-table
              :columns="memberColumns"
              :data-source="members"
              row-key="id"
              :pagination="false"
              size="middle"
            />
          </a-card>
        </a-col>

        <a-col :xs="24" :xl="8">
          <a-card title="团队分布" :bordered="false" class="panel-card">
            <a-list
              :data-source="teamMemberStats"
              :locale="{ emptyText: '暂无团队成员数据' }"
            >
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta :description="item.description">
                    <template #title>
                      <a-space>
                        <span>{{ item.name }}</span>
                        <a-tag color="processing">{{ item.count }} 人</a-tag>
                      </a-space>
                    </template>
                  </a-list-item-meta>
                </a-list-item>
              </template>
            </a-list>
          </a-card>

          <a-card title="管理员" :bordered="false" class="panel-card">
            <a-list
              :data-source="adminMembers"
              :locale="{ emptyText: '当前没有团队管理员数据' }"
            >
              <template #renderItem="{ item }">
                <a-list-item>
                  <a-list-item-meta
                    :description="
                      item.team?.name || resolveTeamName(item.team_id)
                    "
                  >
                    <template #title>
                      <a-space>
                        <span>{{ item.user?.name || item.user_id }}</span>
                        <a-tag color="gold">管理</a-tag>
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
import { getMemberList, getMyTeams } from "../api/modules";
import type { MemberInfo, TeamInfo } from "../types/domain";

const ROLE_CONFIG = [
  { mask: 1, label: "图" },
  { mask: 2, label: "翻" },
  { mask: 4, label: "校" },
  { mask: 8, label: "嵌" },
  { mask: 16, label: "监" },
  { mask: 32, label: "传" },
  { mask: 64, label: "管理" },
] as const;

const loading = ref(false);
const teams = ref<TeamInfo[]>([]);
const members = ref<MemberInfo[]>([]);

const memberColumns: TableColumnsType<MemberInfo> = [
  {
    title: "成员",
    key: "user_name",
    customRender: ({ record }) => record.user?.name || record.user_id,
  },
  {
    title: "团队",
    key: "team_name",
    customRender: ({ record }) =>
      record.team?.name || resolveTeamName(record.team_id),
  },
  {
    title: "角色",
    dataIndex: "roles",
    key: "roles",
    customRender: ({ value }) => formatRoles(value),
  },
  {
    title: "QQ",
    key: "user_qq",
    customRender: ({ record }) => record.user?.qq || "-",
  },
  {
    title: "加入时间",
    dataIndex: "created_at",
    key: "created_at",
    customRender: ({ value }) => formatTimestamp(value),
  },
];

const summaryCards = computed(() => [
  {
    label: "我的团队数",
    value: teams.value.length,
  },
  {
    label: "成员记录数",
    value: members.value.length,
  },
  {
    label: "去重成员数",
    value: new Set(members.value.map((memberInfo) => memberInfo.user_id)).size,
  },
  {
    label: "管理员数",
    value: members.value.filter((memberInfo) => hasRole(memberInfo.roles, 64))
      .length,
  },
]);

const teamMemberStats = computed(() => {
  return teams.value
    .map((teamInfo) => {
      const memberCount = members.value.filter(
        (memberInfo) => memberInfo.team_id === teamInfo.id,
      ).length;

      return {
        id: teamInfo.id,
        name: teamInfo.name,
        count: memberCount,
        description: teamInfo.description || "暂无团队简介",
      };
    })
    .sort((leftTeam, rightTeam) => rightTeam.count - leftTeam.count);
});

const adminMembers = computed(() => {
  return members.value.filter((memberInfo) => hasRole(memberInfo.roles, 64));
});

function resolveTeamName(teamID: string): string {
  return teams.value.find((teamInfo) => teamInfo.id === teamID)?.name || "-";
}

function hasRole(roleMask: number | undefined, roleFlag: number): boolean {
  if (typeof roleMask !== "number") {
    return false;
  }

  return (roleMask & roleFlag) !== 0;
}

function formatRoles(roleMask: number | undefined): string {
  if (typeof roleMask !== "number") {
    return "未设置";
  }

  const labels = ROLE_CONFIG.filter((roleInfo) => {
    return hasRole(roleMask, roleInfo.mask);
  }).map((roleInfo) => roleInfo.label);

  return labels.length > 0 ? labels.join(" / ") : "未设置";
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

    const memberResults = await Promise.allSettled(
      nextTeams.map((teamInfo) =>
        getMemberList({
          team_id: teamInfo.id,
          offset: 0,
          limit: 100,
          includes: ["user"],
        }),
      ),
    );

    members.value = memberResults.flatMap((memberResult, index) => {
      if (memberResult.status !== "fulfilled") {
        return [];
      }

      if (!Array.isArray(memberResult.value)) {
        return [];
      }

      return memberResult.value.map((memberInfo) => ({
        ...memberInfo,
        team: memberInfo.team ?? nextTeams[index],
      }));
    });

    if (showSuccessMessage) {
      const failedRequestCount = memberResults.filter(
        (result) => result.status === "rejected",
      ).length;

      if (failedRequestCount > 0) {
        message.warning("成员页已刷新，但部分团队成员加载失败");
      } else {
        message.success("成员数据已刷新");
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "成员列表加载失败";
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
.member-list-layout {
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

:global(.member-list-layout .ant-card-head) {
  border-bottom: 1px solid var(--table-border-color);
}

:global(.member-list-layout .ant-card-head-title) {
  color: var(--text-primary);
}

:global(.member-list-layout .ant-statistic-title) {
  color: var(--text-muted);
}

:global(.member-list-layout .ant-statistic-content) {
  color: var(--text-primary);
}

:global(.member-list-layout .ant-list-item) {
  border-bottom: 1px solid var(--table-border-color);
}

:global(.member-list-layout .ant-list-item-meta-title),
:global(.member-list-layout .ant-list-item-meta-description) {
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
