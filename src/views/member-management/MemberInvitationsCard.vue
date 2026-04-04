<template>
  <a-card :bordered="false" class="mm-panel mm-panel--table">
    <template #title>
      <div class="mm-section-heading">
        <div class="mm-section-heading__icon is-warning">
          <LinkOutlined />
        </div>
        <div>
          <span class="mm-section-heading__title">邀请码中心</span>
          <p class="mm-section-heading__subtitle">
            仅当前团队管理员可见，用于预配置角色、复制邀请码并维护失效状态。
          </p>
        </div>
      </div>
    </template>

    <template #extra>
      <a-space size="small">
        <a-tag :color="pendingInvitationCount > 0 ? 'gold' : 'default'">
          待处理 {{ pendingInvitationCount }}
        </a-tag>
        <a-button
          size="small"
          type="primary"
          @click="openInvitationCreateModal"
        >
          <template #icon>
            <PlusOutlined />
          </template>
          新建邀请码
        </a-button>
      </a-space>
    </template>

    <a-table
      :columns="invitationColumns"
      :data-source="invitations"
      row-key="id"
      :loading="detailLoading"
      size="middle"
      :scroll="{ x: 860 }"
      :pagination="{
        pageSize: 6,
        hideOnSinglePage: true,
        showSizeChanger: false,
      }"
      :locale="{
        emptyText: hasSelectedTeam ? '当前团队暂无邀请码' : '请先选择团队',
      }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'invitation_code'">
          <div class="mm-code-cell">
            <span class="mm-code">{{ record.invitation_code }}</span>
            <a-tooltip title="复制邀请码">
              <a-button
                type="text"
                size="small"
                @click="handleCopyInvitationCode(record.invitation_code)"
              >
                <template #icon>
                  <CopyOutlined />
                </template>
              </a-button>
            </a-tooltip>
          </div>
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

        <template v-else-if="column.key === 'pending'">
          <a-tag :color="record.pending ? 'success' : 'default'">
            {{ record.pending ? "待接受" : "已失效" }}
          </a-tag>
        </template>

        <template v-else-if="column.key === 'invitor'">
          <span class="mm-muted">
            {{ record.invitor?.name || record.invitor_id || "-" }}
          </span>
        </template>

        <template v-else-if="column.key === 'created_at'">
          {{ formatTimestamp(record.created_at) }}
        </template>

        <template v-else-if="column.key === 'actions'">
          <a-space size="small">
            <a-button
              type="link"
              size="small"
              @click="openInvitationEditModal(record)"
            >
              <template #icon>
                <EditOutlined />
              </template>
              编辑
            </a-button>
            <a-button
              type="link"
              danger
              size="small"
              @click="handleDeleteInvitation(record)"
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
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
} from "@ant-design/icons-vue";
import type { TableColumnsType } from "ant-design-vue";
import type { InvitationInfo } from "../../types/domain";
import { useMemberManagementContext } from "./useMemberManagement";

const {
  invitations,
  detailLoading,
  hasSelectedTeam,
  pendingInvitationCount,
  formatTimestamp,
  resolveRoleEntries,
  handleCopyInvitationCode,
  openInvitationCreateModal,
  openInvitationEditModal,
  handleDeleteInvitation,
} = useMemberManagementContext();

const invitationColumns: TableColumnsType<InvitationInfo> = [
  {
    title: "被邀请 QQ",
    dataIndex: "invitee_qq",
    key: "invitee_qq",
    width: 140,
  },
  {
    title: "邀请码",
    dataIndex: "invitation_code",
    key: "invitation_code",
    width: 180,
  },
  {
    title: "角色",
    dataIndex: "roles",
    key: "roles",
    width: 220,
  },
  {
    title: "状态",
    dataIndex: "pending",
    key: "pending",
    width: 110,
  },
  {
    title: "邀请人",
    key: "invitor",
    width: 140,
  },
  {
    title: "创建时间",
    dataIndex: "created_at",
    key: "created_at",
    width: 180,
  },
  {
    title: "操作",
    key: "actions",
    width: 160,
    fixed: "right",
  },
];
</script>
