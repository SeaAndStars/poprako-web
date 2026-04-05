<template>
  <div class="role-slot">
    <a-tooltip :title="hoverText" placement="top">
      <button
        type="button"
        class="role-badge"
        :class="badgeClassNames"
        :disabled="actionPending || !canPrimaryAction"
        @click="handlePrimaryAction"
      >
        <span class="role-icon">
          <CheckCircleFilled v-if="hasAssignedUser" />
          <ClockCircleFilled v-else-if="hasMyPendingRequest" />
          <ExclamationCircleFilled v-else />
        </span>
        <span class="role-copy">
          <span class="role-copy__top">
            <span class="role-name">{{ roleLabel }}</span>
            <span
              v-if="roleSlot.pending_request_count > 0"
              class="role-count"
              :class="{ 'is-highlight': canReviewRequests }"
            >
              {{ roleSlot.pending_request_count }}
            </span>
            <span v-if="actionText" class="role-action">{{ actionText }}</span>
          </span>
          <span class="role-copy__bottom">
            <span v-if="hasAssignedUser" class="role-occupants">
              <a-avatar
                v-for="occupant in displayOccupants"
                :key="occupant.id"
                :size="22"
                :src="resolveRoleOccupantAvatarUrl(occupant)"
              >
                {{ resolveRoleOccupantInitial(occupant) }}
              </a-avatar>
              <span v-if="extraOccupantCount > 0" class="role-occupants__more">
                +{{ extraOccupantCount }}
              </span>
            </span>
            <span class="role-occupant">{{ occupantSummary }}</span>
          </span>
        </span>
      </button>
    </a-tooltip>

    <div v-if="canOpenWorkspace || props.canManage" class="role-slot__utility">
      <a-tooltip
        v-if="canOpenWorkspace"
        :title="workspaceTooltip"
        placement="top"
      >
        <a-button
          type="text"
          size="small"
          class="role-slot__utility-btn"
          :disabled="actionPending"
          @click="handleWorkspaceClick"
        >
          <template #icon>
            <ReadOutlined v-if="workspaceMode === 'translate'" />
            <FileSearchOutlined v-else />
          </template>
        </a-button>
      </a-tooltip>
      <a-tooltip
        v-if="props.canManage"
        title="直接指定、改派或清空负责人"
        placement="top"
      >
        <a-button
          type="text"
          size="small"
          class="role-slot__utility-btn"
          :disabled="actionPending"
          @click="handleManageClick"
        >
          <template #icon><EditOutlined /></template>
        </a-button>
      </a-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  CheckCircleFilled,
  ClockCircleFilled,
  EditOutlined,
  ExclamationCircleFilled,
  FileSearchOutlined,
  ReadOutlined,
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";

import { createRoleRequest, withdrawRoleRequest } from "../../api/modules";
import { useAvatarDisplayUrl } from "../../composables/useAvatarDisplayUrl";
import type {
  UserInfo,
  WorksetBoardChapterInfo,
  WorksetBoardRoleSlotInfo,
} from "../../types/domain";

const TRANSLATOR_ROLE_VALUE = 2;

const props = defineProps<{
  roleLabel: string;
  roleValue: number;
  roleSlot: WorksetBoardRoleSlotInfo;
  chapter: WorksetBoardChapterInfo;
  currentUserId?: string;
  currentMemberRoleMask?: number;
  appliedTeamId?: string;
  defaultUser?: UserInfo;
  canReview?: boolean;
  canManage?: boolean;
  workspaceMode?: "translate" | "proofread";
}>();

const emit = defineEmits<{
  (event: "changed"): void;
  (event: "manage"): void;
  (event: "workspace"): void;
}>();

const actionPending = ref(false);
const { resolveUserAvatarUrl: resolveRoleOccupantAvatarUrl } =
  useAvatarDisplayUrl();

function resolveRoleOccupants(roleSlot: WorksetBoardRoleSlotInfo): UserInfo[] {
  const occupants = Array.isArray(roleSlot.occupants)
    ? roleSlot.occupants.filter((userInfo): userInfo is UserInfo =>
        Boolean(userInfo?.id),
      )
    : [];

  if (occupants.length > 0) {
    return occupants;
  }

  return roleSlot.occupant?.id ? [roleSlot.occupant] : [];
}

function resolveRoleOccupantInitial(userInfo: UserInfo): string {
  return (
    userInfo.name?.trim().charAt(0) || userInfo.id?.trim().charAt(0) || "?"
  );
}

function formatOccupantList(users: UserInfo[]): string {
  if (users.length === 0) {
    return "";
  }

  if (users.length <= 3) {
    return users
      .map((userInfo) => userInfo.name || userInfo.id || "未知成员")
      .join("、");
  }

  const previewNames = users
    .slice(0, 3)
    .map((userInfo) => userInfo.name || userInfo.id || "未知成员")
    .join("、");

  return `${previewNames} 等 ${users.length} 人`;
}

const roleOccupants = computed(() => resolveRoleOccupants(props.roleSlot));
const displayOccupants = computed(() => roleOccupants.value.slice(0, 3));
const extraOccupantCount = computed(() =>
  Math.max(roleOccupants.value.length - displayOccupants.value.length, 0),
);
const hasAssignedUser = computed(() => roleOccupants.value.length > 0);
const hasMyPendingRequest = computed(() =>
  Boolean(props.roleSlot.my_pending_request_id),
);
const allowsMultipleOccupants = computed(
  () => props.roleValue === TRANSLATOR_ROLE_VALUE,
);
const currentUserAssigned = computed(() => {
  if (!props.currentUserId) {
    return false;
  }

  return roleOccupants.value.some(
    (userInfo) => userInfo.id === props.currentUserId,
  );
});
const canApply = computed(() => {
  if (hasMyPendingRequest.value || currentUserAssigned.value) {
    return false;
  }

  if (!allowsMultipleOccupants.value && hasAssignedUser.value) {
    return false;
  }

  if (typeof props.currentMemberRoleMask !== "number") {
    return false;
  }

  return (props.currentMemberRoleMask & props.roleValue) !== 0;
});
const canWithdraw = computed(() => hasMyPendingRequest.value);
const canReviewRequests = computed(() => {
  return Boolean(props.canReview && props.roleSlot.pending_request_count > 0);
});
const canOpenWorkspace = computed(() => {
  return Boolean(props.workspaceMode && currentUserAssigned.value);
});
const canPrimaryOpenWorkspace = computed(() => {
  return canOpenWorkspace.value;
});
const canPrimaryAction = computed(() => {
  return canApply.value || canWithdraw.value || canPrimaryOpenWorkspace.value;
});

const actionText = computed(() => {
  if (canWithdraw.value) {
    return "撤回";
  }

  if (canApply.value) {
    return "申请";
  }

  if (canPrimaryOpenWorkspace.value) {
    return "进入";
  }

  return "";
});

const badgeClassNames = computed(() => ({
  assigned: hasAssignedUser.value,
  pending: hasMyPendingRequest.value,
  vacant: !hasAssignedUser.value && !hasMyPendingRequest.value,
  actionable: canPrimaryAction.value,
}));

const workspaceMode = computed(() => props.workspaceMode);

const occupantSummary = computed(() => {
  if (hasAssignedUser.value) {
    return formatOccupantList(roleOccupants.value);
  }

  if (hasMyPendingRequest.value) {
    return "已提交申请，等待审批";
  }

  if (props.defaultUser?.name) {
    return `默认负责人 ${props.defaultUser.name}`;
  }

  return "当前岗位空缺";
});

const workspaceTooltip = computed(() => {
  return props.workspaceMode === "proofread"
    ? "进入在线校对工作台"
    : "进入在线翻译工作台";
});

const displayChapterIndex = computed(() => {
  return typeof props.chapter.index === "number"
    ? props.chapter.index + 1
    : "?";
});

const hoverText = computed(() => {
  if (hasAssignedUser.value) {
    const occupantName = formatOccupantList(roleOccupants.value) || "未知成员";
    const pendingSuffix =
      props.roleSlot.pending_request_count > 0
        ? `，另有 ${props.roleSlot.pending_request_count} 个申请待审批`
        : "";
    const currentUserSuffix = currentUserAssigned.value
      ? "，你已在当前负责列表中"
      : "";
    const workspaceHint = canOpenWorkspace.value
      ? `，点击即可${props.workspaceMode === "proofread" ? "在线校对" : "在线翻译"}`
      : "";
    return `${props.roleLabel} 当前负责人：${occupantName}${currentUserSuffix}${pendingSuffix}${workspaceHint}`;
  }

  if (hasMyPendingRequest.value) {
    return `你已申请第 ${displayChapterIndex.value} 话的${props.roleLabel}岗位，等待审批`;
  }

  const defaultOwner = props.defaultUser?.name
    ? `，工作集默认负责人：${props.defaultUser.name}`
    : "";
  const applyHint = canApply.value ? "，点击即可提交申请" : "";
  return `${props.roleLabel} 当前空缺${defaultOwner}${applyHint}`;
});

async function handlePrimaryAction(): Promise<void> {
  if (actionPending.value || !canPrimaryAction.value) {
    return;
  }

  if (canPrimaryOpenWorkspace.value && !canApply.value && !canWithdraw.value) {
    emit("workspace");
    return;
  }

  actionPending.value = true;
  const messageKey = `role-action-${props.chapter.id}-${props.roleValue}`;

  try {
    if (canWithdraw.value && props.roleSlot.my_pending_request_id) {
      message.loading({
        content: `正在撤回第 ${displayChapterIndex.value} 话的${props.roleLabel}申请...`,
        key: messageKey,
      });

      await withdrawRoleRequest(props.roleSlot.my_pending_request_id);

      message.success({
        content: `已撤回第 ${displayChapterIndex.value} 话的${props.roleLabel}申请`,
        key: messageKey,
        duration: 2,
      });
      emit("changed");
      return;
    }

    if (!canApply.value) {
      return;
    }

    message.loading({
      content: `正在申请第 ${displayChapterIndex.value} 话的${props.roleLabel}岗位...`,
      key: messageKey,
    });

    await createRoleRequest({
      chapter_id: props.chapter.id,
      role: props.roleValue,
      applied_team_id: props.appliedTeamId,
    });

    message.success({
      content: `已提交第 ${displayChapterIndex.value} 话的${props.roleLabel}申请`,
      key: messageKey,
      duration: 2,
    });
    emit("changed");
  } catch (error: unknown) {
    message.error({
      content: error instanceof Error ? error.message : "岗位操作失败",
      key: messageKey,
    });
  } finally {
    actionPending.value = false;
  }
}

function handleManageClick(): void {
  emit("manage");
}

function handleWorkspaceClick(): void {
  emit("workspace");
}
</script>

<style scoped lang="scss">
.role-slot {
  --role-assigned-border: color-mix(
    in srgb,
    var(--panel-border) 55%,
    #16a34a 45%
  );
  --role-assigned-bg: color-mix(in srgb, var(--panel-bg) 74%, #dcfce7 26%);
  --role-assigned-text: color-mix(
    in srgb,
    var(--text-primary) 18%,
    #166534 82%
  );
  --role-pending-border: color-mix(
    in srgb,
    var(--panel-border) 55%,
    #d97706 45%
  );
  --role-pending-bg: color-mix(in srgb, var(--panel-bg) 72%, #ffedd5 28%);
  --role-pending-text: color-mix(in srgb, var(--text-primary) 24%, #b45309 76%);
  --role-vacant-border: color-mix(
    in srgb,
    var(--panel-border) 92%,
    transparent
  );
  --role-vacant-bg: color-mix(in srgb, var(--panel-bg) 94%, #ffffff 6%);
  --role-vacant-text: var(--text-muted);
  --role-count-bg: color-mix(in srgb, var(--panel-border) 55%, transparent);
  --role-count-highlight-bg: color-mix(in srgb, #dc2626 14%, transparent);
  --role-count-highlight-text: #b91c1c;
  --role-review-link: color-mix(
    in srgb,
    var(--control-btn-primary-bg) 60%,
    #b91c1c 40%
  );
  --role-utility-text: color-mix(
    in srgb,
    var(--text-primary) 72%,
    var(--control-btn-primary-bg) 28%
  );

  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

:global(html[data-theme="dark"]) .role-slot {
  --role-assigned-bg: color-mix(in srgb, var(--panel-bg) 82%, #052e16 18%);
  --role-assigned-text: #86efac;
  --role-pending-bg: color-mix(in srgb, var(--panel-bg) 82%, #431407 18%);
  --role-pending-text: #fdba74;
  --role-vacant-bg: color-mix(in srgb, var(--panel-bg) 94%, #020617 6%);
  --role-count-highlight-text: #fca5a5;
  --role-review-link: #f87171;
  --role-utility-text: color-mix(in srgb, #dbeafe 76%, var(--text-primary) 24%);
}

.role-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 54px;
  padding: 10px 12px;
  border-radius: 18px;
  border: 1px solid transparent;
  background: transparent;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;

  &.assigned {
    border-color: var(--role-assigned-border);
    background: var(--role-assigned-bg);
    color: var(--role-assigned-text);
  }

  &.pending {
    border-color: var(--role-pending-border);
    background: var(--role-pending-bg);
    color: var(--role-pending-text);
  }

  &.vacant {
    border-color: var(--role-vacant-border);
    background: var(--role-vacant-bg);
    color: var(--role-vacant-text);
  }

  &.actionable:hover:not(:disabled) {
    cursor: pointer;
    transform: translateY(-1px);
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.12);
  }

  &:disabled {
    cursor: default;
    opacity: 1;
  }
}

.role-icon,
.role-count,
.role-action,
.role-copy__top,
.role-copy__bottom {
  display: inline-flex;
  align-items: center;
}

.role-copy {
  display: grid;
  gap: 4px;
  flex: 1 1 auto;
  min-width: 0;
}

.role-copy__top {
  gap: 6px;
  flex-wrap: wrap;
}

.role-copy__bottom {
  gap: 8px;
  min-width: 0;
  color: inherit;
  font-size: 12px;
  font-weight: 500;
}

.role-name {
  font-size: 13px;
  font-weight: 700;
}

.role-occupants {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.role-occupants :deep(.ant-avatar) {
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--panel-border) 70%, transparent);

  & + .ant-avatar {
    margin-inline-start: -6px;
  }
}

.role-occupants__more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  margin-inline-start: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.role-occupant {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-count {
  min-width: 18px;
  height: 18px;
  justify-content: center;
  border-radius: 999px;
  padding: 0 5px;
  background: var(--role-count-bg);
  font-size: 11px;
  line-height: 1;

  &.is-highlight {
    background: var(--role-count-highlight-bg);
    color: var(--role-count-highlight-text);
  }
}

.role-action {
  font-size: 12px;
  font-weight: 700;
}

.role-slot__utility {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.role-slot__utility-btn {
  color: var(--role-utility-text);
}
</style>
