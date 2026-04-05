<template>
  <div class="auth-page" :class="{ 'is-register-mode': isRegisterMode }">
    <div class="auth-page__ambient auth-page__ambient--left" />
    <div class="auth-page__ambient auth-page__ambient--right" />

    <section class="auth-shell">
      <aside class="auth-shell__visual">
        <div class="auth-shell__visual-scene" aria-hidden="true">
          <span class="scene-block scene-block--tall" />
          <span class="scene-block scene-block--wide" />
          <span class="scene-block scene-block--mid" />
          <span class="scene-road" />
        </div>

        <div class="auth-shell__visual-copy">
          <span class="auth-shell__visual-kicker">
            {{ isRegisterMode ? "已有账号？" : "还未注册？" }}
          </span>
          <h1 class="auth-shell__visual-title">
            {{ isRegisterMode ? "欢迎回来" : "立即加入" }}
          </h1>
          <p class="auth-shell__visual-text">
            {{
              isRegisterMode
                ? "回到你的工作区，继续处理漫画、协作和翻校流程。"
                : "创建 Poprako 账号后，你就可以通过邀请码加入汉化组并进入协作工作区。"
            }}
          </p>

          <a-button
            class="auth-shell__visual-switch"
            type="primary"
            @click="switchAuthMode(isRegisterMode ? 'login' : 'register')"
          >
            {{ isRegisterMode ? "去登录" : "去注册" }}
          </a-button>
        </div>
      </aside>

      <section class="auth-shell__panel">
        <Transition name="auth-panel" mode="out-in" appear>
          <div :key="authMode" class="auth-shell__panel-body">
            <header class="auth-shell__panel-header">
              <span class="auth-shell__panel-eyebrow">
                {{ isRegisterMode ? "Create Account" : "Poprako" }}
              </span>
              <h2 class="auth-shell__panel-title">
                {{ isRegisterMode ? "立即注册" : "欢迎回来" }}
              </h2>
              <p class="auth-shell__panel-desc">
                {{
                  isRegisterMode
                    ? "注册需要团队邀请码，成功后会自动进入工作区。"
                    : "使用 QQ 号和密码进入工作区。"
                }}
              </p>
            </header>

            <a-form
              v-if="!isRegisterMode"
              layout="vertical"
              :model="loginForm"
              class="auth-form"
              @finish="handleLoginSubmit"
            >
              <a-form-item
                label="QQ 号"
                name="qq"
                :rules="[{ required: true, message: '请输入 QQ 号' }]"
              >
                <a-input
                  v-model:value="loginForm.qq"
                  placeholder="请输入 QQ 号"
                />
              </a-form-item>

              <a-form-item
                label="密码"
                name="password"
                :rules="[{ required: true, message: '请输入密码' }]"
              >
                <a-input-password
                  v-model:value="loginForm.password"
                  placeholder="请输入密码"
                />
              </a-form-item>

              <a-form-item>
                <a-button
                  type="primary"
                  html-type="submit"
                  block
                  :loading="loginSubmitting"
                >
                  登录并进入工作区
                </a-button>
              </a-form-item>

              <a-form-item v-if="isDevelopmentMode">
                <a-button block @click="enterWorkspaceDirectly">
                  开发模式：直接进入工作区
                </a-button>
              </a-form-item>
            </a-form>

            <a-form
              v-else
              layout="vertical"
              :model="registerForm"
              class="auth-form"
              @finish="handleRegisterSubmit"
            >
              <a-form-item
                label="昵称"
                name="name"
                :rules="[{ required: true, message: '请输入昵称' }]"
              >
                <a-input
                  v-model:value="registerForm.name"
                  placeholder="2 到 20 个字"
                />
              </a-form-item>

              <a-form-item
                label="QQ 号"
                name="qq"
                :rules="[{ required: true, message: '请输入 QQ 号' }]"
              >
                <a-input
                  v-model:value="registerForm.qq"
                  placeholder="请输入 QQ 号"
                />
              </a-form-item>

              <a-form-item
                label="密码"
                name="password"
                :rules="[{ required: true, message: '请输入密码' }]"
              >
                <a-input-password
                  v-model:value="registerForm.password"
                  placeholder="6 到 30 个字符"
                />
              </a-form-item>

              <a-form-item
                label="邀请码"
                name="invitation_code"
                :rules="[{ required: true, message: '请输入邀请码' }]"
              >
                <a-input
                  v-model:value="registerForm.invitation_code"
                  placeholder="请输入团队邀请码"
                />
              </a-form-item>

              <a-form-item
                label="头像"
                required
                :validate-status="registerAvatarValidationStatus"
                :help="registerAvatarValidationMessage"
              >
                <AvatarCropUpload
                  :placeholder-text="registerAvatarPlaceholder"
                  preview-alt-text="Register Avatar Preview"
                  select-button-text="选择并裁切头像"
                  reselect-button-text="重新选择并裁切头像"
                  hint-text="通过邀请码注册必须上传头像，注册成功后会自动完成头像直传。"
                  crop-modal-title="裁切注册头像"
                  crop-hint-text="裁切框固定为 1:1，请让主体尽量落在圆形区域中。"
                  :reset-token="registerAvatarResetToken"
                  :disabled="registerSubmitting"
                  @file-change="handleRegisterAvatarFileChange"
                />
              </a-form-item>

              <a-form-item>
                <a-button
                  type="primary"
                  html-type="submit"
                  block
                  :loading="registerSubmitting"
                >
                  注册并进入工作区
                </a-button>
              </a-form-item>
            </a-form>
          </div>
        </Transition>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * 文件用途：登录/注册一体化认证页。
 * 该页面通过路由 /login 与 /register 切换模式，并使用单个响应式双栏布局承载说明区与当前表单。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message } from "ant-design-vue";
import AvatarCropUpload from "../components/AvatarCropUpload.vue";
import {
  loginUser,
  registerUser,
  type LoginUserArgs,
  type RegisterUserArgs,
} from "../api/modules";
import { uploadUserAvatar } from "../api/userAvatarUpload";
import { useAuthStore } from "../stores/auth";

type AuthMode = "login" | "register";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const loginSubmitting = ref(false);
const registerSubmitting = ref(false);
const registerAvatarFile = ref<File | null>(null);
const registerAvatarTouched = ref(false);
const registerAvatarResetToken = ref(0);
const isDevelopmentMode = import.meta.env.DEV;
const DEVELOPMENT_PREVIEW_SESSION_KEY = "poprako_dev_preview_mode";
const LOGIN_NO_SCROLL_CLASS_NAME = "login-no-scroll";

const loginForm = reactive<LoginUserArgs>({
  qq: "",
  password: "",
});

const registerForm = reactive<
  Required<
    Pick<RegisterUserArgs, "name" | "qq" | "password" | "invitation_code">
  >
>({
  name: "",
  qq: "",
  password: "",
  invitation_code: "",
});

const authMode = computed<AuthMode>(() => {
  return route.name === "register" ? "register" : "login";
});

const isRegisterMode = computed(() => authMode.value === "register");
const registerAvatarPlaceholder = computed(() => {
  const preferredText = registerForm.name.trim() || registerForm.qq.trim();
  return (preferredText.charAt(0) || "U").toUpperCase();
});
const registerAvatarValidationStatus = computed(() => {
  return registerAvatarTouched.value && !registerAvatarFile.value
    ? "error"
    : undefined;
});
const registerAvatarValidationMessage = computed(() => {
  return registerAvatarTouched.value && !registerAvatarFile.value
    ? "通过邀请码注册必须上传头像"
    : undefined;
});

/**
 * 设置开发模式直达开关。
 */
function setDevelopmentPreviewModeEnabled(enabled: boolean): void {
  if (!isDevelopmentMode) {
    return;
  }

  if (enabled) {
    window.sessionStorage.setItem(DEVELOPMENT_PREVIEW_SESSION_KEY, "1");
    return;
  }

  window.sessionStorage.removeItem(DEVELOPMENT_PREVIEW_SESSION_KEY);
}

/**
 * 在登录页与注册页之间切换。
 */
function switchAuthMode(nextMode: AuthMode): void {
  if (authMode.value === nextMode) {
    return;
  }

  if (nextMode !== "register") {
    resetRegisterAvatarSelection();
  }

  void router.push(nextMode === "register" ? "/register" : "/login");
}

/**
 * 重置注册页头像选择状态。
 */
function resetRegisterAvatarSelection(): void {
  registerAvatarFile.value = null;
  registerAvatarTouched.value = false;
  registerAvatarResetToken.value += 1;
}

/**
 * 接收注册页头像裁切组件回传的文件。
 */
function handleRegisterAvatarFileChange(nextAvatarFile: File | null): void {
  registerAvatarTouched.value = true;
  registerAvatarFile.value = nextAvatarFile;
}

/**
 * 处理登录提交。
 */
async function handleLoginSubmit(): Promise<void> {
  loginSubmitting.value = true;

  try {
    const loginUserResult = await loginUser(loginForm);
    authStore.setAccessToken(loginUserResult.access_token);
    setDevelopmentPreviewModeEnabled(false);
    message.success("登录成功，正在进入工作区");
    await router.push("/workspace");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "登录失败";
    message.error(errorMessage);
  } finally {
    loginSubmitting.value = false;
  }
}

/**
 * 处理注册提交。
 */
async function handleRegisterSubmit(): Promise<void> {
  const selectedRegisterAvatarFile = registerAvatarFile.value;
  if (!selectedRegisterAvatarFile) {
    registerAvatarTouched.value = true;
    message.warning("通过邀请码注册必须上传头像");
    return;
  }

  registerSubmitting.value = true;

  try {
    const registerUserResult = await registerUser({
      name: registerForm.name,
      qq: registerForm.qq,
      password: registerForm.password,
      invitation_code: registerForm.invitation_code,
    });

    authStore.setAccessToken(registerUserResult.access_token);

    try {
      await uploadUserAvatar(
        registerUserResult.user_id,
        selectedRegisterAvatarFile,
      );
    } catch {
      setDevelopmentPreviewModeEnabled(false);
      void authStore.refreshCurrentUserProfile().catch(() => null);
      message.warning("注册已完成，但头像还没有上传成功，请先补齐头像后继续");
      await router.push("/workspace");
      return;
    }

    setDevelopmentPreviewModeEnabled(false);
    resetRegisterAvatarSelection();
    void authStore.refreshCurrentUserProfile().catch(() => null);
    message.success("注册成功，正在进入工作区");
    await router.push("/workspace");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "注册失败";
    message.error(errorMessage);
  } finally {
    registerSubmitting.value = false;
  }
}

/**
 * 开发模式下允许从认证页直接进入工作区，便于快速联调。
 */
async function enterWorkspaceDirectly(): Promise<void> {
  if (!isDevelopmentMode) {
    return;
  }

  setDevelopmentPreviewModeEnabled(true);
  message.info("开发模式下已直接进入工作区");
  await router.push("/workspace");
}

onMounted(() => {
  document.documentElement.classList.add(LOGIN_NO_SCROLL_CLASS_NAME);
  document.body.classList.add(LOGIN_NO_SCROLL_CLASS_NAME);
});

onBeforeUnmount(() => {
  document.documentElement.classList.remove(LOGIN_NO_SCROLL_CLASS_NAME);
  document.body.classList.remove(LOGIN_NO_SCROLL_CLASS_NAME);
});
</script>

<style scoped lang="scss">
.auth-page {
  --auth-control-height: 36px;
  --auth-control-radius: 12px;
  --auth-control-padding-x: 14px;
  --auth-panel-body-height: 460px;
  position: relative;
  min-height: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
}

.auth-page__ambient {
  position: absolute;
  width: 420px;
  height: 420px;
  border-radius: 999px;
  filter: blur(52px);
  opacity: 0.72;
}

.auth-page__ambient--left {
  left: -140px;
  top: -120px;
  background: rgba(212, 157, 67, 0.26);
}

.auth-page__ambient--right {
  right: -140px;
  bottom: -120px;
  background: rgba(120, 138, 232, 0.24);
}

.auth-shell {
  position: relative;
  width: min(1120px, 100%);
  z-index: 1;
  min-height: min(600px, calc(100vh - 72px));
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  grid-template-areas: "visual panel";
  border-radius: 30px;
  overflow: hidden;
  border: 1px solid
    color-mix(in srgb, var(--panel-border, #d9c7a0) 68%, transparent);
  background: color-mix(in srgb, var(--surface, #fff) 86%, transparent);
  box-shadow: 0 28px 60px rgba(25, 30, 46, 0.16);
  backdrop-filter: blur(16px);
}

.auth-shell__visual {
  grid-area: visual;
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
  min-width: 0;
  padding: 32px 28px;
  background:
    linear-gradient(180deg, rgba(42, 33, 16, 0.18), rgba(18, 15, 11, 0.56)),
    radial-gradient(
      circle at 18% 16%,
      rgba(255, 235, 186, 0.34),
      transparent 32%
    ),
    linear-gradient(135deg, #8f7945 0%, #556f62 42%, #2d3f49 100%);
}

.auth-shell__panel {
  grid-area: panel;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: clamp(24px, 4vw, 44px);
  background: color-mix(in srgb, var(--panel-bg, #fff) 92%, transparent);
}

.auth-shell__visual-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.scene-block {
  position: absolute;
  bottom: 18%;
  border-radius: 16px 16px 0 0;
  background:
    linear-gradient(180deg, rgba(255, 245, 220, 0.1), transparent 22%),
    repeating-linear-gradient(
      90deg,
      rgba(23, 28, 31, 0.56) 0 12px,
      transparent 12px 38px
    ),
    linear-gradient(180deg, rgba(255, 195, 86, 0.72), rgba(98, 87, 44, 0.9));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.scene-block--tall {
  left: 12%;
  width: 26%;
  height: 62%;
}

.scene-block--wide {
  left: 36%;
  width: 38%;
  height: 48%;
  background:
    linear-gradient(180deg, rgba(255, 245, 220, 0.1), transparent 22%),
    repeating-linear-gradient(
      90deg,
      rgba(23, 28, 31, 0.54) 0 14px,
      transparent 14px 40px
    ),
    linear-gradient(180deg, rgba(211, 122, 74, 0.8), rgba(90, 50, 24, 0.92));
}

.scene-block--mid {
  right: 10%;
  width: 28%;
  height: 56%;
  background:
    linear-gradient(180deg, rgba(255, 245, 220, 0.12), transparent 22%),
    repeating-linear-gradient(
      90deg,
      rgba(23, 28, 31, 0.48) 0 12px,
      transparent 12px 34px
    ),
    linear-gradient(180deg, rgba(99, 157, 119, 0.84), rgba(34, 74, 57, 0.94));
}

.scene-road {
  position: absolute;
  left: 50%;
  bottom: -12%;
  width: 130%;
  height: 32%;
  background: linear-gradient(
    180deg,
    rgba(236, 201, 158, 0.78),
    rgba(118, 86, 49, 0.92)
  );
  transform: translateX(-50%) rotate(-9deg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.auth-shell__visual-copy {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 272px;
  color: #fff9f0;
}

.auth-shell__visual-kicker {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.86;
}

.auth-shell__visual-title {
  margin: 0;
  font-size: clamp(28px, 4vw, 38px);
  line-height: 1.08;
}

.auth-shell__visual-text {
  margin: 0;
  color: rgba(255, 249, 240, 0.84);
  font-size: 14px;
  line-height: 1.7;
}

.auth-shell__visual-switch {
  align-self: flex-start;
  margin-top: 10px;
}

:deep(.auth-shell__visual-switch.ant-btn) {
  min-width: 128px;
  height: var(--auth-control-height);
  padding-inline: 22px;
  border-radius: 999px;
  font-weight: 700;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    filter 0.2s ease;
}

:deep(.auth-shell__visual-switch.ant-btn-primary) {
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.2);
}

:deep(.auth-shell__visual-switch.ant-btn:hover) {
  transform: translateY(-1px);
}

.auth-shell__panel-body {
  width: min(456px, 100%);
  height: var(--auth-panel-body-height);
  max-height: var(--auth-panel-body-height);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.auth-page.is-register-mode .auth-shell__panel-body {
  height: auto;
  max-height: min(720px, calc(100vh - 160px));
  overflow: auto;
  padding-right: 4px;
}

.auth-shell__panel-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-bottom: 20px;
}

.auth-shell__panel-eyebrow {
  color: var(--text-muted, #746d63);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.auth-shell__panel-title {
  margin: 0;
  color: var(--text-primary, #2e261d);
  font-size: clamp(24px, 2.5vw, 34px);
  line-height: 1.1;
}

.auth-shell__panel-desc {
  margin: 0;
  color: var(--text-muted, #746d63);
  font-size: 14px;
  line-height: 1.65;
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.auth-panel-enter-active,
.auth-panel-leave-active {
  transition:
    opacity 0.24s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.24s ease;
}

.auth-panel-enter-from {
  opacity: 0;
  transform: translateY(18px);
  filter: blur(6px);
}

.auth-panel-leave-to {
  opacity: 0;
  transform: translateY(-12px);
  filter: blur(4px);
}

:deep(.auth-form .ant-form-item) {
  margin-bottom: 12px;
}

:deep(.auth-form .ant-form-item-label > label) {
  color: var(--text-muted, #746d63);
  font-weight: 700;
  font-size: 13px;
}

:deep(.auth-form .ant-input),
:deep(.auth-form .ant-input-affix-wrapper),
:deep(.auth-form .ant-btn) {
  height: var(--auth-control-height);
  min-height: var(--auth-control-height);
  border-radius: var(--auth-control-radius);
}

:deep(.auth-form .ant-input),
:deep(.auth-form .ant-input-affix-wrapper) {
  padding: 0 var(--auth-control-padding-x);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

:deep(.auth-form .ant-input-affix-wrapper .ant-input) {
  height: 100%;
  min-height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

:deep(.auth-form .ant-input-password-icon) {
  color: color-mix(in srgb, var(--text-muted, #746d63) 88%, transparent);
}

:deep(.auth-form .ant-btn) {
  font-weight: 700;
  box-shadow: none;
}

:deep(.auth-form .ant-btn .ant-btn-loading-icon) {
  display: inline-flex;
  align-items: center;
}

@media (max-width: 980px) {
  .auth-page {
    padding: 16px;
    --auth-panel-body-height: 440px;
  }

  .auth-shell {
    min-height: auto;
    grid-template-columns: 1fr;
    grid-template-areas:
      "panel"
      "visual";
  }

  .auth-shell__visual {
    min-height: 220px;
    padding: 24px 20px;
  }

  .auth-shell__panel {
    align-items: stretch;
    padding: 20px;
  }

  .auth-shell__panel-body,
  .auth-shell__panel-header,
  .auth-form {
    width: 100%;
  }

  .auth-page.is-register-mode .auth-shell__panel-body {
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }
}

@media (max-width: 640px) {
  .auth-page {
    padding: 12px;
    --auth-panel-body-height: 420px;
  }

  .auth-shell {
    border-radius: 24px;
  }

  .auth-shell__visual-copy {
    max-width: none;
  }

  .auth-shell__panel {
    padding: 18px;
  }

  .auth-shell__visual {
    min-height: 184px;
    padding: 20px 18px;
  }
}

:global(html[data-theme="dark"]) {
  .auth-shell {
    background: color-mix(in srgb, var(--panel-bg, #12161e) 92%, transparent);
    box-shadow: 0 28px 60px rgba(0, 0, 0, 0.36);
  }

  .auth-shell__panel {
    background: color-mix(in srgb, var(--panel-bg, #12161e) 94%, transparent);
  }

  .auth-shell__panel-eyebrow {
    color: var(--text-muted, #a9b2c2);
  }
}
</style>
