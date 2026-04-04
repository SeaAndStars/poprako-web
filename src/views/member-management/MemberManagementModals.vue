<template>
  <a-modal
    v-model:open="isInvitationCenterModalOpen"
    title="邀请码中心"
    width="980px"
    :footer="null"
    @cancel="handleInvitationCenterModalCancel"
  >
    <MemberInvitationsCard />
  </a-modal>

  <a-modal
    v-model:open="isTeamSettingsModalOpen"
    title="团队设置"
    width="920px"
    :footer="null"
    @cancel="handleTeamSettingsModalCancel"
  >
    <MemberManagementSidebar />
  </a-modal>

  <a-modal
    v-model:open="isTeamCreateModalOpen"
    title="创建团队"
    ok-text="创建团队"
    cancel-text="取消"
    :confirm-loading="teamCreateSubmitting"
    @ok="handleTeamCreateModalSubmit"
    @cancel="handleTeamCreateModalCancel"
  >
    <div class="mm-modal-content">
      <a-form layout="vertical">
        <a-form-item label="团队名称">
          <a-input
            v-model:value="teamCreateForm.name"
            maxlength="40"
            show-count
            placeholder="请输入团队名称"
          />
        </a-form-item>

        <a-form-item label="团队简介">
          <a-textarea
            v-model:value="teamCreateForm.description"
            :auto-size="{ minRows: 4, maxRows: 6 }"
            maxlength="200"
            show-count
            placeholder="补充团队方向、风格或协作方式，方便成员识别。"
          />
        </a-form-item>
      </a-form>

      <a-alert
        type="info"
        show-icon
        message="创建成功后会自动切换到新团队，你可以继续打开邀请码中心、团队设置或直接维护成员。"
      />
    </div>
  </a-modal>

  <a-modal
    v-model:open="isJoinTeamModalOpen"
    title="加入团队"
    ok-text="立即加入"
    cancel-text="取消"
    :confirm-loading="joinSubmitting"
    @ok="handleJoinTeamSubmit"
    @cancel="handleJoinTeamModalCancel"
  >
    <div class="mm-modal-content">
      <a-form layout="vertical">
        <a-form-item label="邀请码">
          <a-input
            v-model:value="joinTeamForm.invitationCode"
            placeholder="请输入收到的邀请码"
          />
        </a-form-item>
      </a-form>

      <a-alert
        type="info"
        show-icon
        message="加入成功后，新的团队会自动出现在团队切换器中，并优先切换到刚加入的团队。"
      />
    </div>
  </a-modal>

  <a-modal
    v-model:open="isInvitationModalOpen"
    :title="invitationModalMode === 'create' ? '新建邀请码' : '编辑邀请码角色'"
    ok-text="保存"
    cancel-text="取消"
    :confirm-loading="invitationSubmitting"
    @ok="handleInvitationModalSubmit"
    @cancel="handleInvitationModalCancel"
  >
    <div class="mm-modal-content">
      <a-form layout="vertical">
        <a-form-item label="所属团队">
          <a-input :value="selectedTeamInfo?.name || '-'" disabled />
        </a-form-item>

        <a-form-item label="被邀请人 QQ">
          <a-input
            v-if="invitationModalMode === 'create'"
            v-model:value="invitationForm.inviteeQq"
            placeholder="请输入被邀请人的 QQ 号"
          />
          <a-input v-else :value="invitationForm.inviteeQq" disabled />
        </a-form-item>

        <a-form-item v-if="editingInvitationRecord" label="邀请码">
          <a-input :value="editingInvitationRecord.invitation_code" disabled />
        </a-form-item>

        <a-form-item label="授予角色">
          <a-checkbox-group
            v-model:value="invitationForm.roleMasks"
            :options="roleCheckboxOptions"
          />
        </a-form-item>
      </a-form>

      <a-alert
        type="info"
        show-icon
        message="创建时会直接生成可分享的邀请码；编辑时只会更新该邀请码的角色权限。"
      />
    </div>
  </a-modal>

  <a-modal
    v-model:open="isMemberModalOpen"
    :title="memberModalMode === 'create' ? '添加成员' : '编辑成员角色'"
    ok-text="保存"
    cancel-text="取消"
    :confirm-loading="memberSubmitting"
    @ok="handleMemberModalSubmit"
    @cancel="handleMemberModalCancel"
  >
    <div class="mm-modal-content">
      <a-form layout="vertical">
        <a-form-item label="所属团队">
          <a-input :value="selectedTeamInfo?.name || '-'" disabled />
        </a-form-item>

        <a-form-item label="用户 ID">
          <a-input
            v-model:value="memberForm.userID"
            :disabled="memberModalMode === 'edit'"
            placeholder="请输入目标用户的 user_id"
          />
        </a-form-item>

        <a-form-item label="授予角色">
          <a-checkbox-group
            v-model:value="memberForm.roleMasks"
            :options="roleCheckboxOptions"
          />
        </a-form-item>
      </a-form>

      <a-alert
        type="warning"
        show-icon
        message="当前后端没有用户搜索接口。如果你还不知道对方的 user_id，请优先创建邀请码给对方自行注册或加入。"
      />
    </div>
  </a-modal>

  <a-modal
    v-model:open="isTeamDeleteModalOpen"
    title="删除团队"
    ok-text="确认删除"
    cancel-text="取消"
    :confirm-loading="teamDeleteSubmitting"
    :ok-button-props="{ danger: true }"
    @ok="handleTeamDeleteModalSubmit"
    @cancel="handleTeamDeleteModalCancel"
  >
    <div class="mm-modal-content">
      <a-alert
        type="error"
        show-icon
        message="删除团队是不可逆操作。团队资料、邀请码和成员协作入口都会立即失效。"
      />

      <a-form layout="vertical">
        <a-form-item label="当前团队">
          <a-input :value="selectedTeamInfo?.name || '-'" disabled />
        </a-form-item>

        <a-form-item
          :label="`请输入团队名“${selectedTeamInfo?.name || ''}”以确认删除`"
        >
          <a-input
            v-model:value="teamDeleteForm.confirmationText"
            placeholder="请输入团队全名"
          />
        </a-form-item>
      </a-form>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import MemberInvitationsCard from "./MemberInvitationsCard.vue";
import MemberManagementSidebar from "./MemberManagementSidebar.vue";
import { useMemberManagementContext } from "./useMemberManagement";

const {
  isInvitationCenterModalOpen,
  isTeamSettingsModalOpen,
  isTeamCreateModalOpen,
  isJoinTeamModalOpen,
  isInvitationModalOpen,
  isMemberModalOpen,
  isTeamDeleteModalOpen,
  teamCreateSubmitting,
  invitationSubmitting,
  memberSubmitting,
  joinSubmitting,
  teamDeleteSubmitting,
  teamCreateForm,
  invitationModalMode,
  memberModalMode,
  editingInvitationRecord,
  teamDeleteForm,
  invitationForm,
  memberForm,
  joinTeamForm,
  roleCheckboxOptions,
  selectedTeamInfo,
  handleInvitationCenterModalCancel,
  handleTeamSettingsModalCancel,
  handleTeamCreateModalSubmit,
  handleTeamCreateModalCancel,
  handleJoinTeamSubmit,
  handleJoinTeamModalCancel,
  handleInvitationModalSubmit,
  handleInvitationModalCancel,
  handleMemberModalSubmit,
  handleMemberModalCancel,
  handleTeamDeleteModalSubmit,
  handleTeamDeleteModalCancel,
} = useMemberManagementContext();
</script>
