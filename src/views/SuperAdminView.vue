<template>
  <div class="super-admin-view">
    <section class="sa-hero">
      <div class="sa-hero__layout">
        <div class="sa-hero__copy">
          <span class="sa-hero__eyebrow">
            <ControlOutlined />
            Super Admin Console
          </span>
          <h1 class="sa-hero__title">超级管理员</h1>
          <p class="sa-hero__description">
            这里处理系统级团队总览、创建团队、全局用户维护，以及选中团队的成员与邀请码明细。
          </p>

          <div class="sa-hero__chips">
            <span class="sa-chip">
              当前账号
              {{
                currentUser ? resolveUserDisplayName(currentUser) : "超级管理员"
              }}
            </span>
            <span class="sa-chip">角色仅表示团队内分工</span>
          </div>
        </div>

        <div class="sa-hero__actions">
          <a-button type="primary" @click="openTeamCreateModal">
            <template #icon>
              <PlusOutlined />
            </template>
            创建团队
          </a-button>

          <a-button
            :disabled="!hasSelectedTeam"
            @click="openInvitationCreateModal"
          >
            <template #icon>
              <LinkOutlined />
            </template>
            为当前团队添加邀请码
          </a-button>

          <a-button :loading="pageLoading" @click="handleRefreshClick">
            <template #icon>
              <ReloadOutlined />
            </template>
            刷新数据
          </a-button>
        </div>
      </div>

      <div class="sa-stat-grid">
        <article class="sa-stat-card">
          <span class="sa-stat-card__label">全部团队</span>
          <strong class="sa-stat-card__value">{{ teamCount }}</strong>
        </article>
        <article class="sa-stat-card">
          <span class="sa-stat-card__label">全部用户</span>
          <strong class="sa-stat-card__value">{{ userCount }}</strong>
        </article>
        <article class="sa-stat-card">
          <span class="sa-stat-card__label">当前团队成员</span>
          <strong class="sa-stat-card__value">{{
            selectedTeamMemberCount
          }}</strong>
        </article>
        <article class="sa-stat-card">
          <span class="sa-stat-card__label">当前团队待处理邀请码</span>
          <strong class="sa-stat-card__value">{{
            selectedTeamPendingInvitationCount
          }}</strong>
        </article>
      </div>
    </section>

    <div class="sa-main-grid">
      <a-card :bordered="false" class="sa-card sa-card--teams">
        <template #title>
          <div class="sa-section-heading">
            <div class="sa-section-heading__icon is-brand">
              <TeamOutlined />
            </div>
            <div>
              <span class="sa-section-heading__title">全部团队</span>
              <p class="sa-section-heading__subtitle">
                选择一个团队后，右侧会展开该团队的成员与邀请码明细。
              </p>
            </div>
          </div>
        </template>

        <template #extra>
          <a-tag color="processing">总数 {{ teamCount }}</a-tag>
        </template>

        <a-table
          class="sa-team-table"
          :columns="teamColumns"
          :data-source="teams"
          row-key="id"
          :loading="teamsLoading"
          :scroll="{ x: 720 }"
          :pagination="{
            pageSize: 8,
            hideOnSinglePage: true,
            showSizeChanger: false,
          }"
          :locale="{ emptyText: '当前没有可展示的团队' }"
          :row-class-name="resolveTeamRowClassName"
          :custom-row="resolveTeamTableRowProps"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'team'">
              <div class="sa-user-cell">
                <a-avatar :src="resolveTeamAvatarUrl(record)">
                  {{ resolveDisplayInitial(record.name) }}
                </a-avatar>
                <div class="sa-user-cell__content">
                  <span class="sa-user-cell__name">{{ record.name }}</span>
                  <span class="sa-muted">{{
                    record.description || "暂无团队描述"
                  }}</span>
                </div>
              </div>
            </template>

            <template v-else-if="column.key === 'description'">
              <span class="sa-muted">{{ record.description || "-" }}</span>
            </template>

            <template v-else-if="column.key === 'updated_at'">
              {{ formatTimestamp(record.updated_at) }}
            </template>
          </template>
        </a-table>
      </a-card>

      <div class="sa-detail-stack">
        <a-card :bordered="false" class="sa-card">
          <template #title>
            <div class="sa-section-heading">
              <div class="sa-section-heading__icon is-accent">
                <UserOutlined />
              </div>
              <div>
                <span class="sa-section-heading__title">团队成员</span>
                <p class="sa-section-heading__subtitle">
                  超级管理员可以查看任意团队的全部成员与团队内角色分工。
                </p>
              </div>
            </div>
          </template>

          <template #extra>
            <a-space size="small">
              <a-tag v-if="selectedTeamInfo" color="processing">
                {{ selectedTeamInfo.name }}
              </a-tag>
              <a-tag color="gold">管理员 {{ selectedTeamAdminCount }}</a-tag>
              <a-tag color="processing"
                >成员 {{ selectedTeamMemberCount }}</a-tag
              >
            </a-space>
          </template>

          <a-table
            :columns="memberColumns"
            :data-source="members"
            row-key="id"
            :loading="detailLoading"
            :scroll="{ x: 720 }"
            :pagination="{
              pageSize: 6,
              hideOnSinglePage: true,
              showSizeChanger: false,
            }"
            :locale="{
              emptyText: hasSelectedTeam ? '当前团队暂无成员' : '请先选择团队',
            }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'user'">
                <div class="sa-user-cell">
                  <a-avatar :src="resolveMemberAvatarUrl(record)">
                    {{
                      resolveDisplayInitial(resolveMemberDisplayName(record))
                    }}
                  </a-avatar>
                  <div class="sa-user-cell__content">
                    <div class="sa-user-cell__top">
                      <span class="sa-user-cell__name">
                        {{ resolveMemberDisplayName(record) }}
                      </span>
                      <a-tag
                        v-if="record.user_id === currentUser?.id"
                        color="processing"
                      >
                        我
                      </a-tag>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else-if="column.key === 'qq'">
                <span class="sa-muted">{{ record.user?.qq || "-" }}</span>
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
                    class="sa-muted"
                  >
                    未设置
                  </span>
                </a-space>
              </template>

              <template v-else-if="column.key === 'created_at'">
                {{ formatTimestamp(record.created_at) }}
              </template>
            </template>
          </a-table>
        </a-card>

        <a-card :bordered="false" class="sa-card">
          <template #title>
            <div class="sa-section-heading">
              <div class="sa-section-heading__icon is-warning">
                <LinkOutlined />
              </div>
              <div>
                <span class="sa-section-heading__title">邀请码</span>
                <p class="sa-section-heading__subtitle">
                  选中团队后可以查看邀请码状态，并继续为该团队生成新的邀请码。
                </p>
              </div>
            </div>
          </template>

          <template #extra>
            <a-space size="small">
              <a-tag v-if="selectedTeamInfo" color="processing">
                {{ selectedTeamInfo.name }}
              </a-tag>
              <a-tag color="processing"
                >邀请码 {{ selectedTeamInvitationCount }}</a-tag
              >
            </a-space>
          </template>

          <a-table
            :columns="invitationColumns"
            :data-source="invitations"
            row-key="id"
            :loading="detailLoading"
            :scroll="{ x: 760 }"
            :pagination="{
              pageSize: 6,
              hideOnSinglePage: true,
              showSizeChanger: false,
            }"
            :locale="{
              emptyText: hasSelectedTeam
                ? '当前团队暂无邀请码'
                : '请先选择团队',
            }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'invitation_code'">
                <div class="sa-code-cell">
                  <span class="sa-code">{{ record.invitation_code }}</span>
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
                </a-space>
              </template>

              <template v-else-if="column.key === 'pending'">
                <a-tag :color="record.pending ? 'gold' : 'default'">
                  {{ record.pending ? "待使用" : "已使用" }}
                </a-tag>
              </template>

              <template v-else-if="column.key === 'created_at'">
                {{ formatTimestamp(record.created_at) }}
              </template>

              <template v-else-if="column.key === 'actions'">
                <a-button
                  type="link"
                  size="small"
                  @click="handleCopyInvitationCode(record.invitation_code)"
                >
                  复制
                </a-button>
              </template>
            </template>
          </a-table>
        </a-card>
      </div>
    </div>

    <a-card :bordered="false" class="sa-card sa-card--users">
      <template #title>
        <div class="sa-section-heading">
          <div class="sa-section-heading__icon is-brand">
            <UserOutlined />
          </div>
          <div>
            <span class="sa-section-heading__title">所有用户</span>
            <p class="sa-section-heading__subtitle">
              支持按名字或 QQ 搜索，并允许超级管理员编辑昵称或删除指定用户。
            </p>
          </div>
        </div>
      </template>

      <template #extra>
        <div class="sa-users-toolbar">
          <a-input-search
            :value="userSearchKeyword"
            class="sa-search"
            placeholder="搜索用户名或 QQ"
            allow-clear
            @search="handleUserSearch"
            @update:value="handleUserSearchKeywordChange"
          />
          <a-tag color="processing">{{ userCountLabel }}</a-tag>
        </div>
      </template>

      <a-table
        :columns="userColumns"
        :data-source="users"
        row-key="id"
        :loading="usersLoading"
        :scroll="{ x: 920 }"
        :pagination="{
          pageSize: 10,
          hideOnSinglePage: true,
          showSizeChanger: false,
        }"
        :locale="{ emptyText: userEmptyText }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'user'">
            <div class="sa-user-cell">
              <a-avatar :src="resolveUserAvatarUrl(record)">
                {{ resolveDisplayInitial(resolveUserDisplayName(record)) }}
              </a-avatar>
              <div class="sa-user-cell__content">
                <div class="sa-user-cell__top">
                  <span class="sa-user-cell__name">
                    {{ resolveUserDisplayName(record) }}
                  </span>
                  <a-tag v-if="record.is_super_admin" color="gold"
                    >超级管理员</a-tag
                  >
                  <a-tag v-if="record.id === currentUser?.id" color="processing"
                    >我</a-tag
                  >
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="column.key === 'qq'">
            <span class="sa-muted">{{ record.qq || "-" }}</span>
          </template>

          <template v-else-if="column.key === 'created_at'">
            {{ formatTimestamp(record.created_at) }}
          </template>

          <template v-else-if="column.key === 'updated_at'">
            {{ formatTimestamp(record.updated_at) }}
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-space size="small">
              <a-button
                type="link"
                size="small"
                @click="openUserEditModal(record)"
              >
                编辑
              </a-button>

              <a-popconfirm
                title="确认删除这个用户吗？"
                ok-text="删除"
                cancel-text="取消"
                :disabled="!canDeleteUser(record)"
                @confirm="handleDeleteUser(record)"
              >
                <a-button
                  type="link"
                  size="small"
                  danger
                  :disabled="!canDeleteUser(record)"
                  :loading="deletingUserID === record.id"
                >
                  删除
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      :open="isTeamCreateModalOpen"
      title="创建团队"
      ok-text="创建团队"
      cancel-text="取消"
      :confirm-loading="teamCreateSubmitting"
      @ok="handleTeamCreateModalSubmit"
      @cancel="handleTeamCreateModalCancel"
    >
      <a-form layout="vertical">
        <a-form-item label="团队名称" required>
          <a-input
            v-model:value="teamCreateForm.name"
            placeholder="输入团队名称"
            maxlength="50"
          />
        </a-form-item>

        <a-form-item label="团队描述">
          <a-textarea
            v-model:value="teamCreateForm.description"
            :rows="4"
            placeholder="可选：补充团队定位或说明"
            maxlength="240"
            show-count
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      :open="isInvitationModalOpen"
      title="为当前团队创建邀请码"
      ok-text="创建邀请码"
      cancel-text="取消"
      :confirm-loading="invitationSubmitting"
      @ok="handleInvitationModalSubmit"
      @cancel="handleInvitationModalCancel"
    >
      <a-form layout="vertical">
        <a-form-item label="当前团队">
          <a-input :value="selectedTeamInfo?.name || ''" disabled />
        </a-form-item>

        <a-form-item label="被邀请人 QQ" required>
          <a-input
            v-model:value="invitationForm.inviteeQq"
            placeholder="输入被邀请人的 QQ 号"
            maxlength="20"
          />
        </a-form-item>

        <a-form-item label="团队内角色" required>
          <a-checkbox-group
            v-model:value="invitationForm.roleMasks"
            :options="roleCheckboxOptions"
          />
          <div class="sa-form-hint">这些角色只作用于当前团队内部的分工。</div>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      :open="isUserEditModalOpen"
      title="编辑用户"
      ok-text="保存昵称"
      cancel-text="取消"
      :confirm-loading="userEditSubmitting"
      @ok="handleUserEditModalSubmit"
      @cancel="handleUserEditModalCancel"
    >
      <a-form layout="vertical">
        <a-form-item label="用户 ID">
          <a-input :value="editingUser?.id || ''" disabled />
        </a-form-item>

        <a-form-item label="QQ 号">
          <a-input :value="editingUser?.qq || ''" disabled />
        </a-form-item>

        <a-form-item label="昵称" required>
          <a-input
            v-model:value="userEditForm.name"
            placeholder="请输入 2 到 20 个字符的昵称"
            maxlength="20"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  ControlOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons-vue";
import type { TableColumnsType } from "ant-design-vue";
import type {
  InvitationInfo,
  MemberInfo,
  TeamInfo,
  UserInfo,
} from "../types/domain";
import { useSuperAdminView } from "./super-admin/useSuperAdminView";

const {
  currentUser,
  pageLoading,
  teamsLoading,
  usersLoading,
  detailLoading,
  teamCreateSubmitting,
  invitationSubmitting,
  userEditSubmitting,
  deletingUserID,
  teams,
  users,
  members,
  invitations,
  selectedTeamID,
  userSearchKeyword,
  isTeamCreateModalOpen,
  isInvitationModalOpen,
  isUserEditModalOpen,
  editingUser,
  teamCreateForm,
  invitationForm,
  userEditForm,
  selectedTeamInfo,
  hasSelectedTeam,
  teamCount,
  userCount,
  selectedTeamMemberCount,
  selectedTeamInvitationCount,
  selectedTeamPendingInvitationCount,
  selectedTeamAdminCount,
  roleCheckboxOptions,
  formatTimestamp,
  resolveDisplayInitial,
  resolveRoleEntries,
  resolveTeamAvatarUrl,
  resolveUserAvatarUrl,
  resolveMemberAvatarUrl,
  resolveUserDisplayName,
  resolveMemberDisplayName,
  handleRefreshClick,
  handleTeamSelect,
  openTeamCreateModal,
  handleTeamCreateModalCancel,
  handleTeamCreateModalSubmit,
  openInvitationCreateModal,
  handleInvitationModalCancel,
  handleInvitationModalSubmit,
  handleUserSearchKeywordChange,
  handleUserSearch,
  openUserEditModal,
  handleUserEditModalCancel,
  handleUserEditModalSubmit,
  canDeleteUser,
  handleDeleteUser,
  handleCopyInvitationCode,
} = useSuperAdminView();

const teamColumns: TableColumnsType<TeamInfo> = [
  {
    title: "团队",
    key: "team",
    width: 280,
  },
  {
    title: "描述",
    dataIndex: "description",
    key: "description",
  },
  {
    title: "更新时间",
    dataIndex: "updated_at",
    key: "updated_at",
    width: 180,
  },
];

const memberColumns: TableColumnsType<MemberInfo> = [
  {
    title: "成员",
    key: "user",
    width: 260,
  },
  {
    title: "QQ",
    key: "qq",
    width: 140,
  },
  {
    title: "角色",
    key: "roles",
    dataIndex: "roles",
    width: 240,
  },
  {
    title: "加入时间",
    key: "created_at",
    dataIndex: "created_at",
    width: 180,
  },
];

const invitationColumns: TableColumnsType<InvitationInfo> = [
  {
    title: "邀请码",
    key: "invitation_code",
    dataIndex: "invitation_code",
    width: 180,
  },
  {
    title: "邀请 QQ",
    key: "invitee_qq",
    dataIndex: "invitee_qq",
    width: 140,
  },
  {
    title: "角色",
    key: "roles",
    dataIndex: "roles",
    width: 220,
  },
  {
    title: "状态",
    key: "pending",
    dataIndex: "pending",
    width: 120,
  },
  {
    title: "创建时间",
    key: "created_at",
    dataIndex: "created_at",
    width: 180,
  },
  {
    title: "操作",
    key: "actions",
    width: 90,
    fixed: "right",
  },
];

const userColumns: TableColumnsType<UserInfo> = [
  {
    title: "用户",
    key: "user",
    width: 280,
  },
  {
    title: "QQ",
    key: "qq",
    dataIndex: "qq",
    width: 160,
  },
  {
    title: "创建时间",
    key: "created_at",
    dataIndex: "created_at",
    width: 180,
  },
  {
    title: "更新时间",
    key: "updated_at",
    dataIndex: "updated_at",
    width: 180,
  },
  {
    title: "操作",
    key: "actions",
    width: 140,
    fixed: "right",
  },
];

const userCountLabel = computed(() => {
  if (userSearchKeyword.value.trim().length > 0) {
    return `匹配 ${userCount.value}`;
  }

  return `用户数 ${userCount.value}`;
});

const userEmptyText = computed(() => {
  return userSearchKeyword.value.trim().length > 0
    ? "没有匹配的用户"
    : "当前没有可展示的用户";
});

function resolveTeamTableRowProps(teamInfo: TeamInfo): Record<string, unknown> {
  return {
    onClick: () => handleTeamSelect(teamInfo.id),
    style: {
      cursor: "pointer",
    },
  };
}

function resolveTeamRowClassName(teamInfo: TeamInfo): string {
  return teamInfo.id === selectedTeamID.value ? "sa-team-row--active" : "";
}
</script>

<style lang="scss" src="./super-admin/superAdminView.scss"></style>
