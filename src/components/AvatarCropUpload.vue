<template>
  <div class="avatar-crop-upload">
    <div class="avatar-crop-upload__row">
      <img
        v-if="resolvedPreviewUrl"
        class="avatar-crop-upload__preview"
        :style="previewStyle"
        :src="resolvedPreviewUrl"
        :alt="previewAltText"
        @error="handlePreviewImageLoadError"
      />
      <span
        v-else
        class="avatar-crop-upload__preview avatar-crop-upload__preview--placeholder"
        :style="previewStyle"
      >
        {{ placeholderInitial }}
      </span>

      <div class="avatar-crop-upload__actions">
        <a-upload
          accept="image/*"
          :show-upload-list="false"
          :before-upload="handleBeforeUpload"
          :disabled="disabled"
        >
          <a-button :disabled="disabled">
            <template #icon>
              <UploadOutlined />
            </template>
            {{ selectedFile ? reselectButtonText : selectButtonText }}
          </a-button>
        </a-upload>

        <p v-if="hintText" class="avatar-crop-upload__hint">
          {{ hintText }}
        </p>
      </div>
    </div>

    <a-modal
      v-model:open="isCropModalOpen"
      :title="cropModalTitle"
      ok-text="使用裁切结果"
      cancel-text="取消"
      :confirm-loading="cropConfirming"
      :mask-closable="false"
      :destroy-on-close="true"
      :width="760"
      @ok="handleCropConfirm"
      @cancel="handleCropCancel"
    >
      <div class="avatar-crop-upload__cropper">
        <div class="avatar-crop-upload__cropper-layout">
          <div class="avatar-crop-upload__stage">
            <img
              v-if="cropSourceUrl"
              ref="cropImageRef"
              class="avatar-crop-upload__image"
              :src="cropSourceUrl"
              alt="Avatar Crop Source"
              @load="handleCropImageLoad"
            />
          </div>

          <aside class="avatar-crop-upload__live-side">
            <div
              ref="cropPreviewRef"
              class="avatar-crop-upload__live-preview"
            />
            <p class="avatar-crop-upload__live-hint">
              圆形区域会作为最终头像显示效果。
            </p>
          </aside>
        </div>

        <div class="avatar-crop-upload__toolbar">
          <a-space wrap>
            <a-button @click="handleZoom(-0.1)">
              <template #icon>
                <ZoomOutOutlined />
              </template>
              缩小
            </a-button>
            <a-button @click="handleZoom(0.1)">
              <template #icon>
                <ZoomInOutlined />
              </template>
              放大
            </a-button>
            <a-button @click="handleRotate(-90)">
              <template #icon>
                <RotateLeftOutlined />
              </template>
              左转
            </a-button>
            <a-button @click="handleRotate(90)">
              <template #icon>
                <RotateRightOutlined />
              </template>
              右转
            </a-button>
            <a-button @click="handleReset">
              <template #icon>
                <ReloadOutlined />
              </template>
              重置
            </a-button>
          </a-space>
        </div>

        <p class="avatar-crop-upload__hint">
          {{ cropHintText }}
        </p>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
/**
 * 文件用途：提供可复用的头像裁切与选择组件。
 * 该组件统一承载 antd Upload、1:1 裁切、圆形预览遮罩与裁切结果文件回传。
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import { message } from "ant-design-vue";
import type { UploadProps } from "ant-design-vue";
import {
  ReloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons-vue";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

interface Props {
  previewUrl?: string;
  placeholderText?: string;
  previewAltText?: string;
  selectButtonText?: string;
  reselectButtonText?: string;
  hintText?: string;
  cropModalTitle?: string;
  cropHintText?: string;
  resetToken?: number | string;
  previewSize?: number;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  previewUrl: "",
  placeholderText: "U",
  previewAltText: "Avatar Preview",
  selectButtonText: "选择并裁切头像",
  reselectButtonText: "重新选择并裁切头像",
  hintText: "支持常见图片格式。",
  cropModalTitle: "裁切头像",
  cropHintText: "裁切框固定为 1:1，请让主体尽量落在圆形区域中。",
  resetToken: 0,
  previewSize: 72,
  disabled: false,
});

const emit = defineEmits<{
  (event: "file-change", file: File | null): void;
}>();

const isCropModalOpen = ref(false);
const cropConfirming = ref(false);
const cropImageRef = ref<HTMLImageElement | null>(null);
const cropPreviewRef = ref<HTMLElement | null>(null);
const selectedFile = ref<File | null>(null);
const selectedPreviewUrl = ref("");
const cropSourceFile = ref<File | null>(null);
const cropSourceUrl = ref("");
const hasPreviewImageLoadError = ref(false);

let cropper: Cropper | null = null;

const resolvedPreviewUrl = computed(() => {
  if (hasPreviewImageLoadError.value) {
    return "";
  }

  return selectedPreviewUrl.value || props.previewUrl || "";
});

const placeholderInitial = computed(() => {
  return (props.placeholderText.trim().charAt(0) || "U").toUpperCase();
});

const previewStyle = computed<CSSProperties>(() => {
  const previewSize = `${props.previewSize}px`;

  return {
    width: previewSize,
    height: previewSize,
  } satisfies CSSProperties;
});

/**
 * 销毁当前裁切实例，避免重复初始化和内存泄漏。
 */
function destroyCropper(): void {
  cropper?.destroy();
  cropper = null;
}

/**
 * 清空当前裁切来源图和临时实例。
 */
function clearCropSource(): void {
  destroyCropper();

  if (cropSourceUrl.value) {
    URL.revokeObjectURL(cropSourceUrl.value);
    cropSourceUrl.value = "";
  }

  cropSourceFile.value = null;
}

/**
 * 清理当前已选中的裁切结果预览。
 */
function clearSelectedFile(emitChange = true): void {
  if (selectedPreviewUrl.value) {
    URL.revokeObjectURL(selectedPreviewUrl.value);
    selectedPreviewUrl.value = "";
  }

  selectedFile.value = null;

  if (emitChange) {
    emit("file-change", null);
  }
}

/**
 * 应用新的头像文件，并生成本地预览。
 */
function applySelectedFile(nextFile: File): void {
  clearSelectedFile(false);
  selectedFile.value = nextFile;
  selectedPreviewUrl.value = URL.createObjectURL(nextFile);
  hasPreviewImageLoadError.value = false;
  emit("file-change", nextFile);
}

/**
 * 预览头像加载失败时回退到占位内容，避免显示破图图标。
 */
function handlePreviewImageLoadError(): void {
  hasPreviewImageLoadError.value = true;
}

/**
 * 使用 antd Upload 拦截原始图片文件，进入裁切流程。
 */
const handleBeforeUpload: UploadProps["beforeUpload"] = (rawFile) => {
  const nextFile = rawFile as File;

  if (!nextFile.type.startsWith("image/")) {
    message.warning("请选择图片文件作为头像");
    return false;
  }

  clearCropSource();
  cropSourceFile.value = nextFile;
  cropSourceUrl.value = URL.createObjectURL(nextFile);
  isCropModalOpen.value = true;
  return false;
};

/**
 * 图片载入后初始化裁切器，并把圆形预览同步到侧边预览区。
 */
function handleCropImageLoad(): void {
  nextTick(() => {
    if (!cropImageRef.value || !isCropModalOpen.value) {
      return;
    }

    destroyCropper();
    cropper = new Cropper(cropImageRef.value, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 1,
      background: false,
      guides: false,
      center: false,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      responsive: true,
      preview: cropPreviewRef.value ?? undefined,
    });
  });
}

/**
 * 从裁切器导出新的头像文件。
 */
async function buildCroppedAvatarFile(): Promise<File> {
  if (!cropper || !cropSourceFile.value) {
    throw new Error("当前没有可裁切的头像图片");
  }

  const croppedCanvas = cropper.getCroppedCanvas({
    width: 512,
    height: 512,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  });

  const sourceFile = cropSourceFile.value;
  const fallbackType = sourceFile.type || "image/png";
  const sourceNameWithoutExtension = sourceFile.name.replace(/\.[^.]+$/, "");

  return new Promise<File>((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("生成裁切头像失败，请重新选择图片"));
          return;
        }

        const normalizedBlobType = blob.type || fallbackType;
        const extension =
          normalizedBlobType === "image/jpeg"
            ? "jpg"
            : normalizedBlobType === "image/webp"
              ? "webp"
              : "png";

        resolve(
          new File(
            [blob],
            `${sourceNameWithoutExtension}-avatar.${extension}`,
            {
              type: normalizedBlobType,
              lastModified: Date.now(),
            },
          ),
        );
      },
      fallbackType,
      0.92,
    );
  });
}

/**
 * 确认使用当前裁切结果，并回传给父组件。
 */
async function handleCropConfirm(): Promise<void> {
  cropConfirming.value = true;

  try {
    const croppedAvatarFile = await buildCroppedAvatarFile();
    applySelectedFile(croppedAvatarFile);
    isCropModalOpen.value = false;
    clearCropSource();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "头像裁切失败";
    message.error(errorMessage);
  } finally {
    cropConfirming.value = false;
  }
}

/**
 * 取消头像裁切，保留当前已确认的旧预览。
 */
function handleCropCancel(): void {
  isCropModalOpen.value = false;
  clearCropSource();
}

/**
 * 调整裁切图的缩放比例。
 */
function handleZoom(ratio: number): void {
  cropper?.zoom(ratio);
}

/**
 * 旋转裁切图。
 */
function handleRotate(degree: number): void {
  cropper?.rotate(degree);
}

/**
 * 重置裁切区域与图片姿态。
 */
function handleReset(): void {
  cropper?.reset();
}

watch(
  () => [selectedPreviewUrl.value, props.previewUrl],
  () => {
    hasPreviewImageLoadError.value = false;
  },
);

watch(
  () => props.resetToken,
  () => {
    clearSelectedFile(true);
    isCropModalOpen.value = false;
    clearCropSource();
  },
);

onBeforeUnmount(() => {
  clearSelectedFile(false);
  clearCropSource();
});
</script>

<style scoped lang="scss">
.avatar-crop-upload {
  width: 100%;
}

.avatar-crop-upload__row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar-crop-upload__preview,
.avatar-crop-upload__preview--placeholder {
  border-radius: 999px;
  flex-shrink: 0;
}

.avatar-crop-upload__preview {
  object-fit: cover;
  box-shadow: 0 10px 22px rgba(24, 32, 52, 0.12);
}

.avatar-crop-upload__preview--placeholder {
  display: grid;
  place-items: center;
  background: var(--titlebar-profile-placeholder-bg);
  color: var(--titlebar-profile-placeholder-text);
  font-size: 22px;
  font-weight: 700;
}

.avatar-crop-upload__actions {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.avatar-crop-upload__hint,
.avatar-crop-upload__live-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.avatar-crop-upload__cropper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.avatar-crop-upload__cropper-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 168px;
  gap: 16px;
  align-items: start;
}

.avatar-crop-upload__stage {
  height: clamp(300px, 52vh, 440px);
  max-height: 440px;
  border-radius: 18px;
  overflow: hidden;
  background: color-mix(in srgb, var(--panel-bg) 88%, #05070d 12%);
}

.avatar-crop-upload__image {
  display: block;
  max-width: 100%;
}

.avatar-crop-upload__live-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.avatar-crop-upload__live-preview {
  width: 132px;
  height: 132px;
  overflow: hidden;
  border-radius: 999px;
  border: 3px solid color-mix(in srgb, var(--accent, #7f92ff) 30%, #ffffff);
  box-shadow: 0 14px 32px rgba(30, 41, 66, 0.14);
  background: color-mix(in srgb, var(--surface) 90%, transparent);
}

.avatar-crop-upload__toolbar {
  display: flex;
  justify-content: center;
}

:global(.avatar-crop-upload .cropper-container) {
  width: 100% !important;
  height: 100% !important;
}

:global(.avatar-crop-upload .cropper-wrap-box),
:global(.avatar-crop-upload .cropper-canvas),
:global(.avatar-crop-upload .cropper-drag-box),
:global(.avatar-crop-upload .cropper-crop-box) {
  width: 100% !important;
  height: 100% !important;
}

:global(.avatar-crop-upload .cropper-view-box) {
  border-radius: 999px;
  outline: 0;
  box-shadow: 0 0 0 99999px rgba(6, 10, 20, 0.46);
}

:global(.avatar-crop-upload .cropper-face) {
  border-radius: 999px;
  background: transparent;
  opacity: 0.08;
}

:global(.avatar-crop-upload .cropper-center),
:global(.avatar-crop-upload .cropper-dashed) {
  display: none;
}

@media (max-width: 900px) {
  .avatar-crop-upload__cropper-layout {
    grid-template-columns: 1fr;
  }

  .avatar-crop-upload__live-side {
    flex-direction: row;
    justify-content: center;
  }

  .avatar-crop-upload__stage {
    height: min(46vh, 360px);
  }
}

@media (max-width: 640px) {
  .avatar-crop-upload__row {
    align-items: flex-start;
    flex-direction: column;
  }

  .avatar-crop-upload__live-side {
    flex-direction: column;
  }
}
</style>
