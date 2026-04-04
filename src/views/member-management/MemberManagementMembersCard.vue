<template>
  <a-card :bordered="false" class="mm-panel mm-panel--table mm-panel--members">
    <template #title>
      <div class="mm-section-heading">
        <div class="mm-section-heading__icon is-brand">
          <UsergroupAddOutlined />
        </div>
        <div>
          <span class="mm-section-heading__title">公共成员区</span>
          <p class="mm-section-heading__subtitle">
            所有成员都可查看名单；只有管理员会在此看到角色编辑和移除操作。
          </p>
        </div>
      </div>
    </template>

    <template #extra>
      <a-space size="small">
        <a-tag v-if="selectedTeamInfo" color="processing">
          {{ selectedTeamInfo.name }}
        </a-tag>
        <a-tag color="processing">成员数 {{ members.length }}</a-tag>
      </a-space>
    </template>

    <a-table
      :columns="memberColumns"
      :data-source="members"
      row-key="id"
      :loading="detailLoading"
      size="middle"
      :scroll="{ x: 840 }"
      :row-class-name="resolveMemberRowClassName"
      :pagination="{
        pageSize: 8,
        hideOnSinglePage: true,
        showSizeChanger: false,
      }"
      :locale="{
        emptyText: hasSelectedTeam ? '当前团队暂无成员记录' : '请先选择团队',
      }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'user'">
          <div class="mm-member-cell">
            <a-avatar
              class="mm-member-cell__avatar"
              :src="resolveMemberAvatarUrl(record)"
            >
              {{ resolveMemberFallback(record) }}
            </a-avatar>

            <div class="mm-member-cell__content">
              <div class="mm-member-cell__top">
                <span class="mm-member-cell__name">
                  {{ record.user?.name || record.user_id }}
                </span>
                <a-tag
                  v-if="record.user_id === currentUser?.id"
                  color="processing"
                  class="mm-member-cell__self-tag"
                >
                  我
                </a-tag>
              </div>
              <span class="mm-member-cell__meta">{{ record.user_id }}</span>
            </div>
          </div>
        </template>

        <template v-else-if="column.key === 'qq'">
          <span class="mm-muted">{{ record.user?.qq || "-" }}</span>
        </template>

        <template v-else-if="column.key === 'roles'">
          <a-space wrap>
            <a-tag
              v-for="roleInfo in resolveRoleEntries(record.roles)"
              :key="`${record.id}-${roleInfo.mask}`"
              :color="roleInfo.color"
            >
              {{ roleInfo.label }}
            </a-tag>
            <span
              v-if="resolveRoleEntries(record.roles).length === 0"
              class="mm-muted"
            >
              未设置
            </span>
          </a-space>
        </template>

        <template v-else-if="column.key === 'created_at'">
          {{ formatTimestamp(record.created_at) }}
        </template>

        <template v-else-if="column.key === 'actions'">
          <a-space size="small">
            <a-button
              type="link"
              size="small"
              @click="openMemberEditModal(record)"
            >
              <template #icon>
                <EditOutlined />
              </template>
              编辑角色
            </a-button>
            <a-button
              type="link"
              danger
              size="small"
              @click="handleDeleteMember(record)"
            >
              <template #icon>
                <DeleteOutlined />
              </template>
              删除
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  DeleteOutlined,
  EditOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons-vue";
import type { TableColumnsType } from "ant-design-vue";
import type { MemberInfo } from "../../types/domain";
import { useMemberManagementContext } from "./useMemberManagement";

const {
  currentUser,
  members,
  detailLoading,
  hasSelectedTeam,
  selectedTeamInfo,
  canAccessAdminArea,
  formatTimestamp,
  resolveRoleEntries,
  resolveMemberAvatarUrl,
  openMemberEditModal,
  handleDeleteMember,
} = useMemberManagementContext();

const memberColumns = computed<TableColumnsType<MemberInfo>>(() => {
  const columns: TableColumnsType<MemberInfo> = [
    {
      title: "成员",
      key: "user",
      width: 260,
    },
    {
      title: "QQ",
      key: "qq",
      width: 120,
    },
    {
      title: "角色",
      dataIndex: "roles",
      key: "roles",
      width: 240,
    },
    {
      title: "加入时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 180,
    },
  ];

  if (canAccessAdminArea.value) {
    columns.push({
      title: "操作",
      key: "actions",
      width: 180,
      fixed: "right",
    });
  }

  return columns;
});

function resolveMemberFallback(memberInfo: MemberInfo): string {
  return (memberInfo.user?.name || memberInfo.user_id || "?")
    .slice(0, 1)
    .toUpperCase();
}

function resolveMemberRowClassName(memberInfo: MemberInfo): string {
  return memberInfo.user_id === currentUser.value?.id ? "is-current-user" : "";
}
</script>
