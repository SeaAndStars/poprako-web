<template>
  <section class="mm-admin-stack mm-admin-stack--settings">
    <a-card :bordered="false" class="mm-panel mm-panel--sidebar">
      <template #title>
        <div class="mm-section-heading">
          <div class="mm-section-heading__icon is-accent">
            <TeamOutlined />
          </div>
          <div>
            <span class="mm-section-heading__title">团队设置</span>
            <p class="mm-section-heading__subtitle">
              团队资料、头像与协作状态都集中在这里处理，不再占用主页面空间。
            </p>
          </div>
        </div>
      </template>

      <div v-if="selectedTeamInfo" class="mm-team-overview">
        <div class="mm-team-overview__header">
          <span class="mm-chip">Admin Only</span>
          <h2 class="mm-team-overview__title">{{ selectedTeamInfo.name }}</h2>
          <p class="mm-team-overview__description">
            {{
              selectedTeamInfo.description ||
              "暂无团队简介，建议补充一段便于成员快速识别。"
            }}
          </p>

          <div class="mm-team-overview__stats">
            <div class="mm-team-stat">
              <span class="mm-team-stat__label">团队成员</span>
              <strong class="mm-team-stat__value">{{ members.length }}</strong>
            </div>
            <div class="mm-team-stat">
              <span class="mm-team-stat__label">待处理邀请码</span>
              <strong class="mm-team-stat__value">{{
                pendingInvitationCount
              }}</strong>
            </div>
            <div class="mm-team-stat">
              <span class="mm-team-stat__label">管理员</span>
              <strong class="mm-team-stat__value">{{
                adminMemberCount
              }}</strong>
            </div>
            <div class="mm-team-stat">
              <span class="mm-team-stat__label">最近更新时间</span>
              <strong class="mm-team-stat__value mm-team-stat__value--small">
                {{ formatTimestamp(selectedTeamInfo.updated_at) }}
              </strong>
            </div>
          </div>
        </div>

        <div class="mm-team-overview__uploader">
          <AvatarCropUpload
            :preview-url="resolveTeamAvatarUrl(selectedTeamInfo)"
            :placeholder-text="selectedTeamInfo.name"
            preview-alt-text="团队头像预览"
            select-button-text="选择并裁切团队头像"
            reselect-button-text="重新选择并裁切团队头像"
            hint-text="支持常见图片格式。选图后先裁切，再通过预签名地址上传。"
            crop-modal-title="裁切团队头像"
            crop-hint-text="裁切框固定为 1:1，并使用圆形预览模拟最终头像效果。保存后会立即刷新缓存。"
            :reset-token="teamAvatarResetToken"
            @file-change="handleTeamAvatarFileChange"
          />

          <a-button
            type="primary"
            :loading="teamAvatarSubmitting"
            :disabled="selectedTeamAvatarFile === null"
            @click="handleTeamAvatarUpload"
          >
            保存团队头像
          </a-button>
        </div>

        <div class="mm-meta-list">
          <div class="mm-meta-list__item">
            <span class="mm-meta-list__label">创建时间</span>
            <span class="mm-meta-list__value">{{
              formatTimestamp(selectedTeamInfo.created_at)
            }}</span>
          </div>
          <div class="mm-meta-list__item">
            <span class="mm-meta-list__label">最近更新时间</span>
            <span class="mm-meta-list__value">{{
              formatTimestamp(selectedTeamInfo.updated_at)
            }}</span>
          </div>
        </div>
      </div>

      <a-empty v-else description="当前没有可管理的团队" />
    </a-card>

    <a-card :bordered="false" class="mm-panel mm-panel--danger">
      <template #title>
        <div class="mm-section-heading">
          <div class="mm-section-heading__icon is-danger">
            <DeleteOutlined />
          </div>
          <div>
            <span class="mm-section-heading__title">危险操作</span>
            <p class="mm-section-heading__subtitle">
              这里保留不可逆的团队级动作，请在完成成员迁移后再执行。
            </p>
          </div>
        </div>
      </template>

      <div class="mm-danger-zone">
        <a-alert
          type="error"
          show-icon
          message="删除团队后无法恢复，请先确认成员、邀请码和后续协作已全部迁移。"
        />

        <div class="mm-danger-zone__actions">
          <a-button danger block @click="openTeamDeleteModal">
            删除当前团队
          </a-button>
        </div>
      </div>
    </a-card>
  </section>
</template>

<script setup lang="ts">
import { DeleteOutlined, TeamOutlined } from "@ant-design/icons-vue";
import AvatarCropUpload from "../../components/AvatarCropUpload.vue";
import { useMemberManagementContext } from "./useMemberManagement";

const {
  members,
  selectedTeamInfo,
  pendingInvitationCount,
  adminMemberCount,
  teamAvatarResetToken,
  selectedTeamAvatarFile,
  teamAvatarSubmitting,
  formatTimestamp,
  resolveTeamAvatarUrl,
  handleTeamAvatarFileChange,
  handleTeamAvatarUpload,
  openTeamDeleteModal,
} = useMemberManagementContext();
</script>
