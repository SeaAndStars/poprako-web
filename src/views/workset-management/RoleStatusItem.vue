<template>
  <a-tooltip :title="hoverText" placement="top">
    <div
      class="role-badge"
      :class="[
        hasAssignedUser ? 'assigned' : 'unassigned',
        canApply ? 'can-apply' : '',
      ]"
      @click="handleApply"
      @mouseenter="hovering = true"
      @mouseleave="hovering = false"
    >
      <span class="role-icon">
        <CheckCircleFilled v-if="hasAssignedUser" />
        <ExclamationCircleFilled v-else />
      </span>
      <span class="role-name">{{ roleName }}</span>
      <span v-if="hovering && canApply && !hasAssignedUser" class="apply-text"
        >申请</span
      >
    </div>
  </a-tooltip>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  CheckCircleFilled,
  ExclamationCircleFilled,
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";

const props = defineProps<{
  roleName: string; // "翻译" | "嵌字" | "校对" | "审稿"
  roleId: string | null; // null if unassigned
  worksetRoleId: string | null; // the workset's global default person for this role
  chapter: any; // chapter object
}>();

const hovering = ref(false);

const hasAssignedUser = computed(() => {
  return !!props.roleId;
});

// 计算 hover 时的文字
const hoverText = computed(() => {
  if (hasAssignedUser.value) {
    return `当前${props.roleName}: 用户(${props.roleId})`;
    // TODO: look up real name from some map or store
  } else {
    return `${props.roleName} 空缺中，点击申请`;
  }
});

// 用户是否允许申请 (TODO: 应检查当前登录用户是否在目标全集的工作组成员中或者拥有此角色技能)
const canApply = computed(() => {
  // If the chapter role is already taken, they cannot apply
  if (hasAssignedUser.value) return false;

  // We enforce true for mockup. Real logic would be checking user's roles.
  // "同时具有该职位的人员可以申请担当"
  return true;
});

async function handleApply() {
  if (!canApply.value) return;

  // Mock API call
  try {
    message.loading({
      content: `正在申请【${props.roleName}】职位...`,
      key: "apply-role",
    });
    await new Promise((resolve) => setTimeout(resolve, 600));

    // For a real app, emit event to refresh the chapter listing via parent
    // emit('update', chapterId)
    message.success({
      content: `已成功申请分配为第${props.chapter.index}话的${props.roleName}！`,
      key: "apply-role",
      duration: 2,
    });
  } catch {
    message.error({
      content: `申请失败：权限不足或已被抢占`,
      key: "apply-role",
    });
  }
}
</script>

<style scoped lang="scss">
.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s ease;
  user-select: none;

  &.assigned {
    background: var(--color-primary-container, #e6f7ff);
    color: var(--color-primary, #1890ff);
    border: 1px solid var(--color-primary);

    .role-icon {
      color: var(--color-primary);
    }
  }

  &.unassigned {
    background: var(--color-error-container, #fff2f0);
    color: var(--color-error, #ff4d4f);
    border: 1px dashed var(--color-error);

    .role-icon {
      color: var(--color-error);
    }
  }

  &.can-apply:hover {
    cursor: pointer;
    background: var(--color-primary);
    color: var(--color-on-primary, #fff);
    border-color: var(--color-primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);

    .role-icon {
      color: var(--color-on-primary, #fff);
    }

    .apply-text {
      margin-left: 4px;
      font-weight: 700;
      animation: fadeIn 0.15s ease-in;
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateX(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
