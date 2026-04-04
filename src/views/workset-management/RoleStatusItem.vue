<template>
  <div class="role-slot">
    <a-tooltip :title="hoverText" placement="top">
      <button
        type="button"
        class="role-badge"
        :class="badgeClassNames"
        :disabled="actionPending || !canInteract"
        @click="handlePrimaryAction"
      >
        <span class="role-icon">
          <CheckCircleFilled v-if="hasAssignedUser" />
          <ClockCircleFilled v-else-if="hasMyPendingRequest" />
          <ExclamationCircleFilled v-else />
        </span>
        <span class="role-name">{{ roleLabel }}</span>
        <span
          v-if="roleSlot.pending_request_count > 0"
          class="role-count"
          :class="{ 'is-highlight': canReviewRequests }"
        >
          {{ roleSlot.pending_request_count }}
        </span>
        <span v-if="actionText" class="role-action">{{ actionText }}</span>
      </button>
    </a-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  CheckCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";

import { createRoleRequest, withdrawRoleRequest } from "../../api/modules";
import type {
  UserInfo,
  WorksetBoardChapterInfo,
  WorksetBoardRoleSlotInfo,
} from "../../types/domain";

const props = defineProps<{
  roleLabel: string;
  roleValue: number;
  roleSlot: WorksetBoardRoleSlotInfo;
  chapter: WorksetBoardChapterInfo;
  currentMemberRoleMask?: number;
  appliedTeamId?: string;
  defaultUser?: UserInfo;
  canReview?: boolean;
}>();

const emit = defineEmits<{
  (event: "changed"): void;
}>();

const actionPending = ref(false);

const hasAssignedUser = computed(() => Boolean(props.roleSlot.occupant?.id));
const hasMyPendingRequest = computed(() =>
  Boolean(props.roleSlot.my_pending_request_id),
);
const canApply = computed(() => {
  if (hasAssignedUser.value || hasMyPendingRequest.value) {
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
const canInteract = computed(() => canApply.value || canWithdraw.value);

const actionText = computed(() => {
  if (canWithdraw.value) {
    return "撤回";
  }

  if (canApply.value) {
    return "申请";
  }

  return "";
});

const badgeClassNames = computed(() => ({
  assigned: hasAssignedUser.value,
  pending: hasMyPendingRequest.value,
  vacant: !hasAssignedUser.value && !hasMyPendingRequest.value,
  actionable: canInteract.value,
}));

const displayChapterIndex = computed(() => {
  return typeof props.chapter.index === "number"
    ? props.chapter.index + 1
    : "?";
});

const hoverText = computed(() => {
  if (hasAssignedUser.value) {
    const occupantName =
      props.roleSlot.occupant?.name ||
      props.roleSlot.occupant?.id ||
      "未知成员";
    const pendingSuffix =
      props.roleSlot.pending_request_count > 0
        ? `，另有 ${props.roleSlot.pending_request_count} 个申请待审批`
        : "";
    return `${props.roleLabel} 当前负责人：${occupantName}${pendingSuffix}`;
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
  if (actionPending.value || !canInteract.value) {
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

  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

:global(html[data-theme="dark"]) .role-slot {
  --role-assigned-bg: color-mix(in srgb, var(--panel-bg) 82%, #052e16 18%);
  --role-assigned-text: #86efac;
  --role-pending-bg: color-mix(in srgb, var(--panel-bg) 82%, #431407 18%);
  --role-pending-text: #fdba74;
  --role-vacant-bg: color-mix(in srgb, var(--panel-bg) 94%, #020617 6%);
  --role-count-highlight-text: #fca5a5;
  --role-review-link: #f87171;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
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
    opacity: 0.92;
  }
}

.role-icon,
.role-count,
.role-action {
  display: inline-flex;
  align-items: center;
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
</style>
