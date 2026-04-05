<template>
  <header class="desktop-titlebar">
    <div class="desktop-titlebar__drag-region" @dblclick="handleToggleMaximize">
      <img
        class="desktop-titlebar__logo"
        :src="poprakoLogoURL"
        alt="Poprako Logo"
      />
      <span class="desktop-titlebar__title">Poprako</span>

      <a-dropdown
        v-if="showGlobalProfile && canManageProfile"
        placement="bottomRight"
        :trigger="['click']"
        :open="isProfileMenuOpen"
        overlay-class-name="titlebar-profile-dropdown"
        @openChange="handleProfileMenuOpenChange"
      >
        <button
          type="button"
          class="desktop-titlebar__profile-chip desktop-titlebar__profile-chip--interactive"
          aria-label="打开个人资料菜单"
          @click.stop
        >
          <img
            v-if="displayTitleBarAvatarUrl"
            class="desktop-titlebar__avatar"
            :src="displayTitleBarAvatarUrl"
            alt="Profile Avatar"
            @error="handleTitleBarAvatarLoadError"
          />
          <span v-else class="desktop-titlebar__avatar-placeholder">
            {{ profileInitial }}
          </span>

          <div class="desktop-titlebar__profile-text">
            <span class="desktop-titlebar__profile-name">{{
              titleBarProfile?.nickname
            }}</span>
            <span class="desktop-titlebar__profile-status">{{
              titleBarProfile?.status
            }}</span>
          </div>
        </button>

        <template #overlay>
          <div class="titlebar-profile-menu" @click.stop>
            <div class="titlebar-profile-menu__summary">
              <img
                v-if="displayTitleBarAvatarUrl"
                class="titlebar-profile-menu__avatar"
                :src="displayTitleBarAvatarUrl"
                alt="Profile Avatar"
                @error="handleTitleBarAvatarLoadError"
              />
              <span
                v-else
                class="titlebar-profile-menu__avatar titlebar-profile-menu__avatar--placeholder"
              >
                {{ profileInitial }}
              </span>

              <div class="titlebar-profile-menu__meta">
                <div class="titlebar-profile-menu__name">
                  {{ titleBarProfile?.nickname }}
                </div>
                <div class="titlebar-profile-menu__facts">
                  <div class="titlebar-profile-menu__fact">
                    <span class="titlebar-profile-menu__fact-label">QQ</span>
                    <span class="titlebar-profile-menu__fact-value">
                      {{ titleBarProfile?.qq || "-" }}
                    </span>
                  </div>
                  <div class="titlebar-profile-menu__fact">
                    <span class="titlebar-profile-menu__fact-label">UID</span>
                    <span
                      class="titlebar-profile-menu__fact-value titlebar-profile-menu__fact-value--mono"
                    >
                      {{ titleBarProfile?.id }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="titlebar-profile-menu__divider" />

            <div class="titlebar-profile-menu__actions">
              <button
                type="button"
                class="titlebar-profile-menu__action"
                @click="openProfileEditModal"
              >
                <span class="titlebar-profile-menu__action-left">
                  <UserOutlined class="titlebar-profile-menu__action-icon" />
                  <span>编辑头像与资料</span>
                </span>
              </button>

              <button
                type="button"
                class="titlebar-profile-menu__action"
                @click="openPasswordModal"
              >
                <span class="titlebar-profile-menu__action-left">
                  <LockOutlined class="titlebar-profile-menu__action-icon" />
                  <span>修改密码</span>
                </span>
              </button>

              <button
                type="button"
                class="titlebar-profile-menu__action titlebar-profile-menu__action--danger"
                @click="handleLogout"
              >
                <span class="titlebar-profile-menu__action-left">
                  <PoweroffOutlined
                    class="titlebar-profile-menu__action-icon"
                  />
                  <span>退出登录</span>
                </span>
              </button>
            </div>
          </div>
        </template>
      </a-dropdown>

      <div v-else-if="showGlobalProfile" class="desktop-titlebar__profile-chip">
        <img
          v-if="displayTitleBarAvatarUrl"
          class="desktop-titlebar__avatar"
          :src="displayTitleBarAvatarUrl"
          alt="Profile Avatar"
          @error="handleTitleBarAvatarLoadError"
        />
        <span v-else class="desktop-titlebar__avatar-placeholder">
          {{ profileInitial }}
        </span>

        <div class="desktop-titlebar__profile-text">
          <span class="desktop-titlebar__profile-name">{{
            titleBarProfile?.nickname
          }}</span>
          <span class="desktop-titlebar__profile-status">{{
            titleBarProfile?.status
          }}</span>
        </div>
      </div>
    </div>

    <div v-if="isDesktopEnvironment" class="desktop-titlebar__controls">
      <button
        type="button"
        class="desktop-titlebar__control"
        aria-label="Minimize window"
        title="最小化"
        @click="handleMinimize"
      >
        <span class="window-control-icon window-control-icon--minimize" />
      </button>

      <button
        type="button"
        class="desktop-titlebar__control"
        aria-label="Toggle maximize"
        title="最大化 / 恢复"
        @click="handleToggleMaximize"
      >
        <span
          v-if="!isMaximized"
          class="window-control-icon window-control-icon--maximize"
        />
        <span v-else class="window-control-icon window-control-icon--restore" />
      </button>

      <button
        type="button"
        class="desktop-titlebar__control desktop-titlebar__control--close"
        aria-label="Close window"
        title="关闭"
        @click="handleClose"
      >
        <span class="window-control-icon window-control-icon--close" />
      </button>
    </div>
  </header>

  <a-modal
    v-model:open="isProfileModalOpen"
    :title="profileModalTitle"
    :ok-text="profileModalOkText"
    cancel-text="取消"
    :confirm-loading="profileSubmitting"
    :mask-closable="!isAvatarCompletionRequired"
    :closable="!isAvatarCompletionRequired"
    :keyboard="!isAvatarCompletionRequired"
    :cancel-button-props="profileModalCancelButtonProps"
    @ok="handleProfileSave"
    @cancel="handleProfileModalCancel"
  >
    <div class="titlebar-profile-modal">
      <p
        v-if="isAvatarCompletionRequired"
        class="titlebar-profile-modal__hint titlebar-profile-modal__hint--warning"
      >
        当前账号还没有头像。继续使用前必须先上传头像并保存。
      </p>

      <AvatarCropUpload
        :preview-url="titleBarProfile?.avatarUrl"
        :placeholder-text="profileInitial"
        preview-alt-text="Profile Avatar Preview"
        select-button-text="选择并裁切头像"
        reselect-button-text="重新选择并裁切头像"
        :hint-text="profileAvatarHintText"
        crop-modal-title="裁切头像"
        crop-hint-text="裁切框固定为 1:1，并使用圆形预览遮罩模拟最终头像效果。保存后会立即刷新，不再继续显示旧缓存。"
        :reset-token="profileAvatarResetToken"
        @file-change="handleProfileAvatarFileChange"
      />

      <a-form layout="vertical">
        <a-form-item label="昵称">
          <a-input
            v-model:value="profileForm.name"
            placeholder="请输入 2 到 20 个字符的昵称"
          />
        </a-form-item>

        <a-form-item label="QQ 号">
          <a-input
            v-model:value="profileForm.qq"
            placeholder="请输入绑定的 QQ 号"
          />
        </a-form-item>

        <a-form-item label="当前密码">
          <a-input-password
            v-model:value="profileForm.currentPassword"
            placeholder="修改昵称或 QQ 时需要填写当前密码"
          />
        </a-form-item>
      </a-form>

      <p class="titlebar-profile-modal__hint">
        {{ profileModalHintText }}
      </p>
    </div>
  </a-modal>

  <a-modal
    v-model:open="isPasswordModalOpen"
    title="修改密码"
    ok-text="更新密码"
    cancel-text="取消"
    :confirm-loading="passwordSubmitting"
    @ok="handlePasswordSave"
    @cancel="handlePasswordModalCancel"
  >
    <div class="titlebar-profile-modal">
      <p class="titlebar-profile-modal__account">
        当前账号：{{ titleBarProfile?.nickname
        }}{{ titleBarProfile?.qq ? `（QQ ${titleBarProfile.qq}）` : "" }}
      </p>

      <a-form layout="vertical">
        <a-form-item label="新密码">
          <a-input-password
            v-model:value="passwordForm.newPassword"
            placeholder="请输入 6 到 30 个字符的新密码"
          />
        </a-form-item>

        <a-form-item label="确认新密码">
          <a-input-password
            v-model:value="passwordForm.confirmPassword"
            placeholder="请再次输入新密码"
          />
        </a-form-item>
      </a-form>

      <p class="titlebar-profile-modal__hint">
        当前版本会在已登录状态下直接提交新密码，其他资料字段保持不变。
      </p>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 文件用途：渲染 Electron 自定义标题栏。
 * 该组件用于全局标题栏，负责品牌展示、资料菜单与桌面窗口控制。
 */
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { message } from "ant-design-vue";
import {
  LockOutlined,
  PoweroffOutlined,
  UserOutlined,
} from "@ant-design/icons-vue";
import { useRoute, useRouter } from "vue-router";
import AvatarCropUpload from "./AvatarCropUpload.vue";
import { getCurrentUserProfile, updateUserProfile } from "../api/modules";
import { appendCacheBustQueryToUrl } from "../api/objectStorage";
import { useBlobAssetUrlCache } from "../composables/useBlobAssetUrlCache";
import type { UserInfo } from "../types/domain";
import { useAuthStore } from "../stores/auth";
import { uploadUserAvatar } from "../api/userAvatarUpload";
import poprakoLogoURL from "../assets/poprako-logo.svg";

interface TitleBarProfile {
  id: string;
  nickname: string;
  status: string;
  qq?: string;
  avatarUrl?: string;
}

interface ProfileEditFormState {
  name: string;
  qq: string;
  currentPassword: string;
}

interface PasswordEditFormState {
  newPassword: string;
  confirmPassword: string;
}

const DEVELOPMENT_PREVIEW_PROFILE_ID = "dev-preview";
const USER_PROFILE_UPDATED_EVENT = "poprako:user-profile-updated";

const desktopBridge = window.poprakoDesktop;
const windowControls = desktopBridge?.windowControls;
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isDesktopEnvironment = computed(() => Boolean(windowControls));
const isAuthRoute = computed(
  () => route.path === "/login" || route.path === "/register",
);
const showGlobalProfile = computed(
  () => !isAuthRoute.value && titleBarProfile.value !== null,
);
const canManageProfile = computed(
  () =>
    authStore.isLoggedIn &&
    titleBarProfile.value?.id !== DEVELOPMENT_PREVIEW_PROFILE_ID,
);
const isAvatarCompletionRequired = computed(() => {
  return Boolean(
    !isAuthRoute.value &&
    canManageProfile.value &&
    currentUserProfile.value?.is_avatar_uploaded === false,
  );
});
const isMaximized = ref(false);
const isProfileMenuOpen = ref(false);
const isProfileModalOpen = ref(false);
const isPasswordModalOpen = ref(false);
const profileSubmitting = ref(false);
const passwordSubmitting = ref(false);
const titleBarProfile = ref<TitleBarProfile | null>(null);
const currentUserProfile = ref<UserInfo | null>(null);
const selectedAvatarFile = ref<File | null>(null);
const avatarCacheBustToken = ref<number>(0);
const profileAvatarResetToken = ref(0);
const hasTitleBarAvatarLoadError = ref(false);
const { resolveDisplayAssetUrl } = useBlobAssetUrlCache();

const profileForm = reactive<ProfileEditFormState>({
  name: "",
  qq: "",
  currentPassword: "",
});

const passwordForm = reactive<PasswordEditFormState>({
  newPassword: "",
  confirmPassword: "",
});

const developmentPreviewProfile: Readonly<TitleBarProfile> = Object.freeze({
  id: DEVELOPMENT_PREVIEW_PROFILE_ID,
  nickname: "Developer",
  status: "Preview Mode",
  qq: "",
});

const profileInitial = computed(() =>
  (titleBarProfile.value?.nickname?.trim().charAt(0) || "D").toUpperCase(),
);

const displayTitleBarAvatarUrl = computed(() => {
  if (hasTitleBarAvatarLoadError.value) {
    return undefined;
  }

  return resolveDisplayAssetUrl(titleBarProfile.value?.avatarUrl, {
    fallbackToRawUrl: true,
  });
});
const profileModalTitle = computed(() => {
  return isAvatarCompletionRequired.value ? "上传头像后继续" : "编辑头像与资料";
});
const profileModalOkText = computed(() => {
  return isAvatarCompletionRequired.value ? "保存头像并继续" : "保存资料";
});
const profileModalCancelButtonProps = computed(() => {
  return isAvatarCompletionRequired.value
    ? {
        style: {
          display: "none",
        },
      }
    : undefined;
});
const profileAvatarHintText = computed(() => {
  return isAvatarCompletionRequired.value
    ? "当前账号缺少头像，必须先上传并保存后才能继续使用。"
    : "支持常见图片格式。选图后会先进入 1:1 裁切，再通过预签名地址直传到对象存储。";
});
const profileModalHintText = computed(() => {
  return isAvatarCompletionRequired.value
    ? "当前账号还没有头像。请先完成头像上传；如果同时修改昵称或 QQ，仍需填写当前密码。"
    : "只修改头像时可以不填密码；修改昵称或 QQ 时，仍需填写当前密码作为确认。";
});

let cleanupMaximizeListener: (() => void) | undefined;

async function handleExternalUserProfileUpdated(): Promise<void> {
  await syncTitleBarProfile();
}

function notifyUserProfileUpdated(): void {
  window.dispatchEvent(new CustomEvent(USER_PROFILE_UPDATED_EVENT));
}

/**
 * 释放当前选择头像生成的本地预览地址。
 */
function clearSelectedAvatarFile(): void {
  selectedAvatarFile.value = null;
}

/**
 * 重置头像裁切组件的内部选择状态。
 */
function resetProfileAvatarSelection(): void {
  clearSelectedAvatarFile();
  profileAvatarResetToken.value += 1;
}

/**
 * 接收头像裁切组件回传的文件。
 */
function handleProfileAvatarFileChange(nextAvatarFile: File | null): void {
  selectedAvatarFile.value = nextAvatarFile;
}

/**
 * 标题栏头像加载失败时回退到文字占位，避免显示破图图标。
 */
function handleTitleBarAvatarLoadError(): void {
  hasTitleBarAvatarLoadError.value = true;
}

/**
 * 使用最新用户数据回填资料弹层。
 */
function syncProfileEditForm(): void {
  profileForm.name =
    currentUserProfile.value?.name || titleBarProfile.value?.nickname || "";
  profileForm.qq =
    currentUserProfile.value?.qq || titleBarProfile.value?.qq || "";
  profileForm.currentPassword = "";
}

/**
 * 重置修改密码弹层的表单值。
 */
function resetPasswordForm(): void {
  passwordForm.newPassword = "";
  passwordForm.confirmPassword = "";
}

/**
 * 获取当前可编辑用户的稳定快照。
 */
function resolveEditableUserSnapshot(): {
  userID: string;
  name: string;
  qq: string;
} | null {
  if (!titleBarProfile.value || !canManageProfile.value) {
    return null;
  }

  return {
    userID: titleBarProfile.value.id,
    name: currentUserProfile.value?.name || titleBarProfile.value.nickname,
    qq: currentUserProfile.value?.qq || titleBarProfile.value.qq || "",
  };
}

/**
 * 同步标题栏用户信息。
 * 全局页面优先展示真实用户信息；开发免登录场景使用占位身份。
 */
async function syncTitleBarProfile(): Promise<void> {
  if (isAuthRoute.value) {
    avatarCacheBustToken.value = 0;
    currentUserProfile.value = null;
    titleBarProfile.value = null;
    authStore.clearCurrentUserProfile();
    return;
  }

  if (import.meta.env.DEV && !authStore.isLoggedIn) {
    avatarCacheBustToken.value = 0;
    currentUserProfile.value = null;
    titleBarProfile.value = {
      ...developmentPreviewProfile,
    };
    authStore.clearCurrentUserProfile();
    return;
  }

  if (!authStore.isLoggedIn) {
    avatarCacheBustToken.value = 0;
    currentUserProfile.value = null;
    titleBarProfile.value = null;
    authStore.clearCurrentUserProfile();
    return;
  }

  try {
    const nextCurrentUserProfile = await getCurrentUserProfile();
    currentUserProfile.value = nextCurrentUserProfile;
    authStore.setCurrentUserProfile(nextCurrentUserProfile);
    titleBarProfile.value = {
      id: nextCurrentUserProfile.id,
      nickname:
        nextCurrentUserProfile.name ||
        nextCurrentUserProfile.username ||
        "User",
      status: nextCurrentUserProfile.qq
        ? `QQ ${nextCurrentUserProfile.qq}`
        : "Online",
      qq: nextCurrentUserProfile.qq,
      avatarUrl: appendCacheBustQueryToUrl(
        nextCurrentUserProfile.avatar_url || nextCurrentUserProfile.avatar,
        avatarCacheBustToken.value || nextCurrentUserProfile.updated_at,
      ),
    };

    if (isProfileModalOpen.value) {
      syncProfileEditForm();
    }
  } catch {
    currentUserProfile.value = null;
    authStore.clearCurrentUserProfile();
    titleBarProfile.value = import.meta.env.DEV
      ? {
          ...developmentPreviewProfile,
        }
      : null;
  }
}

/**
 * 同步当前窗口最大化状态。
 */
async function syncMaximizeState(): Promise<void> {
  if (!windowControls) {
    return;
  }

  try {
    isMaximized.value = await windowControls.getMaximized();
  } catch {
    // 忽略状态读取错误，避免影响主页面渲染。
  }
}

/**
 * 响应头像下拉菜单开关。
 */
function handleProfileMenuOpenChange(nextOpen: boolean): void {
  if (!canManageProfile.value) {
    isProfileMenuOpen.value = false;
    return;
  }

  isProfileMenuOpen.value = nextOpen;
}

/**
 * 打开资料编辑弹层，并确保表单使用最新用户信息。
 */
async function openProfileEditModal(): Promise<void> {
  isProfileMenuOpen.value = false;
  await syncTitleBarProfile();
  syncProfileEditForm();
  resetProfileAvatarSelection();
  isProfileModalOpen.value = true;
}

/**
 * 打开密码修改弹层。
 */
async function openPasswordModal(): Promise<void> {
  if (isAvatarCompletionRequired.value) {
    message.warning("请先上传头像后再继续其他资料操作");
    await openProfileEditModal();
    return;
  }

  isProfileMenuOpen.value = false;
  await syncTitleBarProfile();
  resetPasswordForm();
  isPasswordModalOpen.value = true;
}

/**
 * 提交资料更新与头像上传。
 */
async function handleProfileSave(): Promise<void> {
  const editableUserSnapshot = resolveEditableUserSnapshot();

  if (!editableUserSnapshot) {
    message.error("当前用户资料尚未加载完成");
    return;
  }

  const normalizedName = profileForm.name.trim();
  const normalizedQq = profileForm.qq.trim();
  const normalizedCurrentPassword = profileForm.currentPassword.trim();
  const hasTextChanges =
    normalizedName !== editableUserSnapshot.name ||
    normalizedQq !== editableUserSnapshot.qq;
  const hasAvatarChanges = selectedAvatarFile.value !== null;

  if (isAvatarCompletionRequired.value && !selectedAvatarFile.value) {
    message.warning("当前账号必须先上传头像");
    return;
  }

  if (!hasTextChanges && !hasAvatarChanges) {
    message.info("当前没有需要保存的资料变更");
    return;
  }

  if (hasTextChanges) {
    if (normalizedName.length < 2 || normalizedName.length > 20) {
      message.warning("昵称长度需要在 2 到 20 个字符之间");
      return;
    }

    if (normalizedQq.length < 5 || normalizedQq.length > 20) {
      message.warning("QQ 号长度需要在 5 到 20 个字符之间");
      return;
    }

    if (
      normalizedCurrentPassword.length < 6 ||
      normalizedCurrentPassword.length > 30
    ) {
      message.warning("修改昵称或 QQ 时，请输入当前登录密码");
      return;
    }
  }

  profileSubmitting.value = true;

  try {
    if (hasTextChanges) {
      await updateUserProfile(editableUserSnapshot.userID, {
        name: normalizedName,
        qq: normalizedQq,
        password: normalizedCurrentPassword,
      });
    }

    if (selectedAvatarFile.value) {
      await uploadUserAvatar(
        editableUserSnapshot.userID,
        selectedAvatarFile.value,
      );
      avatarCacheBustToken.value = Date.now();
    }

    await syncTitleBarProfile();
    if (hasTextChanges || hasAvatarChanges) {
      notifyUserProfileUpdated();
    }
    resetProfileAvatarSelection();
    isProfileModalOpen.value = false;
    message.success("个人资料已更新");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "更新个人资料失败";
    message.error(errorMessage);
  } finally {
    profileSubmitting.value = false;
  }
}

/**
 * 提交密码更新。
 */
async function handlePasswordSave(): Promise<void> {
  const editableUserSnapshot = resolveEditableUserSnapshot();

  if (!editableUserSnapshot) {
    message.error("当前用户资料尚未加载完成");
    return;
  }

  const normalizedNewPassword = passwordForm.newPassword.trim();
  const normalizedConfirmPassword = passwordForm.confirmPassword.trim();

  if (normalizedNewPassword.length < 6 || normalizedNewPassword.length > 30) {
    message.warning("新密码长度需要在 6 到 30 个字符之间");
    return;
  }

  if (normalizedNewPassword !== normalizedConfirmPassword) {
    message.warning("两次输入的新密码不一致");
    return;
  }

  passwordSubmitting.value = true;

  try {
    await updateUserProfile(editableUserSnapshot.userID, {
      name: editableUserSnapshot.name,
      qq: editableUserSnapshot.qq,
      password: normalizedNewPassword,
    });
    await syncTitleBarProfile();
    isPasswordModalOpen.value = false;
    resetPasswordForm();
    message.success("密码已更新");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "修改密码失败";
    message.error(errorMessage);
  } finally {
    passwordSubmitting.value = false;
  }
}

/**
 * 关闭资料弹层时清理临时状态。
 */
function handleProfileModalCancel(): void {
  if (isAvatarCompletionRequired.value) {
    message.warning("请先上传头像并保存后继续");
    return;
  }

  isProfileModalOpen.value = false;
  resetProfileAvatarSelection();
  syncProfileEditForm();
}

/**
 * 关闭密码弹层时重置输入。
 */
function handlePasswordModalCancel(): void {
  isPasswordModalOpen.value = false;
  resetPasswordForm();
}

/**
 * 退出当前登录态并返回登录页。
 */
async function handleLogout(): Promise<void> {
  isProfileMenuOpen.value = false;
  isProfileModalOpen.value = false;
  isPasswordModalOpen.value = false;
  resetProfileAvatarSelection();
  resetPasswordForm();
  avatarCacheBustToken.value = 0;
  currentUserProfile.value = null;
  titleBarProfile.value = null;
  authStore.clearAccessToken();
  message.success("已退出当前账号");
  await router.push("/login");
}

/**
 * 处理窗口最小化。
 */
function handleMinimize(): void {
  windowControls?.minimize();
}

/**
 * 处理窗口最大化/还原。
 */
function handleToggleMaximize(): void {
  windowControls?.toggleMaximize();
}

/**
 * 处理窗口关闭。
 */
function handleClose(): void {
  windowControls?.close();
}

onMounted(async () => {
  window.addEventListener(
    USER_PROFILE_UPDATED_EVENT,
    handleExternalUserProfileUpdated,
  );

  if (!windowControls) {
    await syncTitleBarProfile();
    return;
  }

  await syncMaximizeState();
  await syncTitleBarProfile();
  cleanupMaximizeListener = windowControls.onMaximizeChanged(
    (nextMaximized) => {
      isMaximized.value = nextMaximized;
    },
  );
});

watch(
  () => [route.fullPath, authStore.isLoggedIn],
  () => {
    if (isAuthRoute.value) {
      isProfileMenuOpen.value = false;
      isProfileModalOpen.value = false;
      isPasswordModalOpen.value = false;
      resetProfileAvatarSelection();
      resetPasswordForm();
    }

    void syncTitleBarProfile();
  },
);

watch(
  () => isAvatarCompletionRequired.value,
  (isRequired, wasRequired) => {
    if (!isRequired) {
      return;
    }

    isProfileMenuOpen.value = false;
    isPasswordModalOpen.value = false;

    if (!isProfileModalOpen.value) {
      resetProfileAvatarSelection();
    }

    syncProfileEditForm();
    isProfileModalOpen.value = true;

    if (!wasRequired) {
      message.warning("当前账号还没有头像，请先上传头像后继续");
    }
  },
  {
    immediate: true,
  },
);

watch(
  () => displayTitleBarAvatarUrl.value,
  () => {
    hasTitleBarAvatarLoadError.value = false;
  },
);

onBeforeUnmount(() => {
  window.removeEventListener(
    USER_PROFILE_UPDATED_EVENT,
    handleExternalUserProfileUpdated,
  );
  cleanupMaximizeListener?.();
  clearSelectedAvatarFile();
});
</script>

<style scoped lang="scss">
/* 标题栏由上层容器承载，避免 fixed 覆盖全局提示层。 */
.desktop-titlebar {
  position: relative;
  width: 100%;
  height: var(--desktop-titlebar-height, 40px);
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  background: var(--titlebar-bg);
  border-bottom: 0;
  backdrop-filter: blur(12px);
  /*
   * 标题栏整体可拖拽，确保登录页也能通过顶栏拖动窗口。
   * 可点击区域（窗口控制按钮）通过 no-drag 单独排除。
   */
  -webkit-app-region: drag;
  user-select: none;
  -webkit-user-select: none;
}

.desktop-titlebar__drag-region {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  overflow: hidden;
}

:global(.application-shell--desktop) .desktop-titlebar__drag-region {
  /* 该区域保持为标题栏主可拖拽区。 */
  -webkit-app-region: inherit;
}

.desktop-titlebar__logo {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.desktop-titlebar__title {
  color: var(--titlebar-title);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desktop-titlebar__profile-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 300px;
  margin-left: 8px;
  padding: 2px 8px 2px 4px;
  border-radius: 999px;
  -webkit-app-region: no-drag;
}

.desktop-titlebar__profile-chip--interactive {
  border: 0;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.desktop-titlebar__profile-chip--interactive:hover,
.desktop-titlebar__profile-chip--interactive:focus-visible {
  background: color-mix(
    in srgb,
    var(--titlebar-control-hover) 82%,
    transparent
  );
  outline: none;
}

.desktop-titlebar__avatar,
.desktop-titlebar__avatar-placeholder {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  flex-shrink: 0;
}

.desktop-titlebar__avatar {
  object-fit: cover;
}

.desktop-titlebar__avatar-placeholder {
  display: grid;
  place-items: center;
  background: var(--titlebar-profile-placeholder-bg);
  color: var(--titlebar-profile-placeholder-text);
  font-size: 11px;
  font-weight: 700;
}

.desktop-titlebar__profile-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.1;
  gap: 2px;
}

.desktop-titlebar__profile-name {
  color: var(--titlebar-profile-name);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desktop-titlebar__profile-status {
  color: var(--titlebar-profile-status);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desktop-titlebar__controls {
  display: flex;
  align-items: stretch;
  -webkit-app-region: no-drag;
}

.desktop-titlebar__control {
  width: 42px;
  border: 0;
  margin: 0;
  padding: 0;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--titlebar-control);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.desktop-titlebar__control:hover {
  background: var(--titlebar-control-hover);
}

.desktop-titlebar__control--close:hover {
  background: var(--titlebar-close-hover);
  color: #ffffff;
}

.titlebar-profile-modal {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.titlebar-profile-modal__account,
.titlebar-profile-modal__hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.titlebar-profile-modal__hint--warning {
  color: #c66a15;
  font-weight: 600;
}

:global(.titlebar-profile-dropdown .ant-dropdown-menu) {
  display: none;
}

:global(.titlebar-profile-dropdown .ant-dropdown-arrow) {
  display: none;
}

:global(.titlebar-profile-dropdown) {
  overflow: visible;
}

:global(.titlebar-profile-menu) {
  width: min(340px, calc(100vw - 24px));
  border-radius: 14px;
  border: 1px solid var(--panel-border);
  background: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: blur(12px);
  padding: 10px;
}

:global(.titlebar-profile-menu__summary) {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 4px 4px 8px;
}

:global(.titlebar-profile-menu__avatar) {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
}

:global(.titlebar-profile-menu__avatar--placeholder) {
  display: grid;
  place-items: center;
  background: var(--titlebar-profile-placeholder-bg);
  color: var(--titlebar-profile-placeholder-text);
  font-size: 16px;
  font-weight: 700;
}

:global(.titlebar-profile-menu__meta) {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:global(.titlebar-profile-menu__name) {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

:global(.titlebar-profile-menu__facts) {
  display: grid;
  gap: 4px;
}

:global(.titlebar-profile-menu__fact) {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: start;
  column-gap: 8px;
}

:global(.titlebar-profile-menu__fact-label) {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

:global(.titlebar-profile-menu__fact-value) {
  min-width: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

:global(.titlebar-profile-menu__fact-value--mono) {
  font-family: "Cascadia Mono", "Consolas", monospace;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-all;
}

:global(.titlebar-profile-menu__divider) {
  height: 1px;
  margin: 0 2px 6px;
  background: var(--panel-border);
  opacity: 0.7;
}

:global(.titlebar-profile-menu__actions) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:global(.titlebar-profile-menu__action) {
  width: 100%;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

:global(.titlebar-profile-menu__action:hover) {
  background: var(--dashboard-sider-hover-bg);
}

:global(.titlebar-profile-menu__action-left) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:global(.titlebar-profile-menu__action-icon) {
  font-size: 14px;
}

:global(.titlebar-profile-menu__action--danger) {
  color: #ff7575;
}

.window-control-icon {
  display: inline-block;
  position: relative;
  color: currentColor;
}

.window-control-icon--minimize {
  width: 12px;
  border-top: 1.8px solid currentColor;
}

.window-control-icon--maximize {
  width: 10px;
  height: 10px;
  border: 1.6px solid currentColor;
}

.window-control-icon--restore {
  width: 9px;
  height: 7px;
  border: 1.6px solid currentColor;
}

.window-control-icon--restore::before {
  content: "";
  position: absolute;
  left: -4px;
  top: 3px;
  width: 9px;
  height: 7px;
  border: 1.6px solid currentColor;
  background: transparent;
}

.window-control-icon--close {
  width: 12px;
  height: 12px;
}

.window-control-icon--close::before,
.window-control-icon--close::after {
  content: "";
  position: absolute;
  left: 5px;
  top: 0;
  width: 1.8px;
  height: 12px;
  background: currentColor;
}

.window-control-icon--close::before {
  transform: rotate(45deg);
}

.window-control-icon--close::after {
  transform: rotate(-45deg);
}
</style>
