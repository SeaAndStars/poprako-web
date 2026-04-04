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
                <div class="titlebar-profile-menu__status">
                  {{ titleBarProfile?.status }}
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
    title="编辑头像与资料"
    ok-text="保存资料"
    cancel-text="取消"
    :confirm-loading="profileSubmitting"
    @ok="handleProfileSave"
    @cancel="handleProfileModalCancel"
  >
    <div class="titlebar-profile-modal">
      <AvatarCropUpload
        :preview-url="titleBarProfile?.avatarUrl"
        :placeholder-text="profileInitial"
        preview-alt-text="Profile Avatar Preview"
        select-button-text="选择并裁切头像"
        reselect-button-text="重新选择并裁切头像"
        hint-text="支持常见图片格式。选图后会先进入 1:1 裁切，再通过预签名地址直传到对象存储。"
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
        当前后端资料更新接口是完整更新语义。只修改头像时可以不填密码；修改昵称或
        QQ 时，需要把当前登录密码一并提交。
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
        当前版本将基于已登录状态直接更新密码，并沿用现有昵称与 QQ 信息一同提交。
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
import {
  confirmUserAvatarUploaded,
  getCurrentUserProfile,
  reserveUserAvatar,
  updateUserProfile,
} from "../api/modules";
import {
  appendCacheBustQueryToUrl,
  resolveImageFileExtension,
  uploadFileToPresignedPutUrl,
} from "../api/objectStorage";
import type { UserInfo } from "../types/domain";
import { useAuthStore } from "../stores/auth";
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

  return titleBarProfile.value?.avatarUrl;
});

let cleanupMaximizeListener: (() => void) | undefined;

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
    return;
  }

  if (import.meta.env.DEV && !authStore.isLoggedIn) {
    avatarCacheBustToken.value = 0;
    currentUserProfile.value = null;
    titleBarProfile.value = {
      ...developmentPreviewProfile,
    };
    return;
  }

  if (!authStore.isLoggedIn) {
    avatarCacheBustToken.value = 0;
    currentUserProfile.value = null;
    titleBarProfile.value = null;
    return;
  }

  try {
    const nextCurrentUserProfile = await getCurrentUserProfile();
    currentUserProfile.value = nextCurrentUserProfile;
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
      const avatarContentType =
        selectedAvatarFile.value.type || "application/octet-stream";
      const avatarExtension = resolveImageFileExtension(
        selectedAvatarFile.value,
      );
      const reserveUserAvatarResult = await reserveUserAvatar(
        editableUserSnapshot.userID,
        {
          extension: avatarExtension,
          content_type: avatarContentType,
        },
      );

      await uploadFileToPresignedPutUrl(
        reserveUserAvatarResult.put_url,
        selectedAvatarFile.value,
        avatarContentType,
      );
      await confirmUserAvatarUploaded(editableUserSnapshot.userID);
      avatarCacheBustToken.value = Date.now();
    }

    await syncTitleBarProfile();
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
  () => titleBarProfile.value?.avatarUrl,
  () => {
    hasTitleBarAvatarLoadError.value = false;
  },
);

onBeforeUnmount(() => {
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
  width: 248px;
  border-radius: 14px;
  border: 1px solid var(--panel-border);
  background: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: blur(12px);
  padding: 10px;
}

:global(.titlebar-profile-menu__summary) {
  display: flex;
  align-items: center;
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
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:global(.titlebar-profile-menu__name) {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(.titlebar-profile-menu__status) {
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
