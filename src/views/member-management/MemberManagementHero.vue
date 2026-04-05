<template>
  <section class="mm-hero">
    <div class="mm-hero__layout">
      <div class="mm-hero__copy">
        <span class="mm-hero__eyebrow">
          <TeamOutlined />
          Team Workspace
        </span>
        <h1 class="mm-hero__title">团队管理</h1>
        <p class="mm-hero__description">
          这里聚焦单团队成员、邀请码和团队设置。
        </p>
      </div>

      <div class="mm-hero__toolbar">
        <div class="mm-hero__field">
          <span class="mm-hero__field-label">团队切换</span>
          <a-select
            :value="selectedTeamID"
            class="mm-hero__team-select"
            placeholder="请选择要查看的团队"
            :options="teamSelectOptions"
            :loading="teamsLoading"
            :disabled="teams.length === 0"
            @change="handleTeamChange"
          />
        </div>

        <div class="mm-hero__actions">
          <div class="mm-hero__action-group">
            <span class="mm-hero__group-label">团队入口</span>
            <div class="mm-hero__action-row">
              <a-button @click="openJoinTeamModal">
                <template #icon>
                  <UsergroupAddOutlined />
                </template>
                加入团队
              </a-button>

              <a-button :loading="pageLoading" @click="handleRefreshClick">
                <template #icon>
                  <ReloadOutlined />
                </template>
                刷新数据
              </a-button>
            </div>
          </div>

          <div v-if="canAccessAdminArea" class="mm-hero__action-group">
            <span class="mm-hero__group-label">管理员工具</span>
            <div class="mm-hero__action-row">
              <a-button @click="openInvitationCenterModal">
                <template #icon>
                  <LinkOutlined />
                </template>
                邀请码中心
              </a-button>

              <a-button @click="openTeamSettingsModal">
                <template #icon>
                  <SettingOutlined />
                </template>
                团队设置
              </a-button>

              <a-button type="primary" @click="openMemberCreateModal">
                <template #icon>
                  <UserAddOutlined />
                </template>
                添加成员
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mm-hero__status" aria-live="polite">
      <div v-if="selectedTeamInfo" class="mm-hero__team-pill">
        <a-avatar
          class="mm-hero__team-avatar"
          :src="resolveTeamAvatarUrl(selectedTeamInfo)"
        >
          {{ selectedTeamInfo.name.slice(0, 1).toUpperCase() }}
        </a-avatar>
        <span class="mm-hero__team-name">{{ selectedTeamInfo.name }}</span>
      </div>

      <a-tag v-else color="default">尚未选择团队</a-tag>

      <a-tag
        v-if="hasSelectedTeam"
        :color="canAccessAdminArea ? 'gold' : 'default'"
      >
        {{ canAccessAdminArea ? "管理员视图" : "成员视图" }}
      </a-tag>

      <span class="mm-hero__hint">
        {{ heroHintText }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  LinkOutlined,
  ReloadOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons-vue";
import { computed } from "vue";
import { useMemberManagementContext } from "./useMemberManagement";

const {
  teamsLoading,
  teams,
  selectedTeamID,
  teamSelectOptions,
  pageLoading,
  hasSelectedTeam,
  canAccessAdminArea,
  selectedTeamInfo,
  resolveTeamAvatarUrl,
  handleTeamChange,
  handleRefreshClick,
  openJoinTeamModal,
  openInvitationCenterModal,
  openTeamSettingsModal,
  openMemberCreateModal,
} = useMemberManagementContext();

const heroHintText = computed(() => {
  if (teams.value.length === 0) {
    return "你还没有团队，可以先通过邀请码加入。";
  }

  if (!hasSelectedTeam.value) {
    return "先选择一个团队，再查看成员、邀请码或打开对应团队工具。";
  }

  if (canAccessAdminArea.value) {
    return "你当前拥有该团队的管理员权限，可以继续处理团队内成员、邀请码与设置。";
  }

  return "当前团队仅展示成员清单。";
});
</script>
