<template>
  <a-modal
    :open="open"
    width="560px"
    title="新建章节并上传底图"
    ok-text="创建章节"
    cancel-text="取消"
    :confirm-loading="submitting"
    :mask-closable="!submitting"
    @update:open="$emit('update:open', $event)"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form layout="vertical">
      <a-form-item label="所属项目">
        <a-input disabled :value="comicTitle || '未选择项目'" />
      </a-form-item>

      <a-alert
        type="info"
        show-icon
        class="chapter-modal-alert"
        :message="chapterNumberAlert"
      />

      <div
        v-if="(props.defaultRoleSummaries || []).length > 0"
        class="chapter-default-role-panel"
      >
        <div class="chapter-default-role-panel__title">
          创建后会自动写入以下章节岗位；未配置的岗位会保持空缺，继续走申请流程。
        </div>

        <div class="chapter-default-role-panel__grid">
          <div
            v-for="summary in props.defaultRoleSummaries || []"
            :key="summary.key"
            class="chapter-default-role-panel__item"
          >
            <div class="chapter-default-role-panel__label">
              {{ summary.roleLabel }}
            </div>
            <div class="chapter-default-role-panel__value">
              {{ summary.assigneeName || "未配置默认负责人" }}
            </div>
          </div>
        </div>
      </div>

      <a-form-item label="第几话 (可选)">
        <a-input-number
          v-model:value="form.chapterNumber"
          :min="1"
          :precision="0"
          placeholder="留空则自动分配"
          style="width: 100%"
        />
        <div class="chapter-form-hint">
          留空则自动创建第
          {{ nextChapterNumber }}
          话；如需跳号，可手动指定新的未使用话数。已使用过的历史编号也不能复用。
        </div>
      </a-form-item>

      <a-form-item label="章节副标题" required>
        <a-input
          v-model:value="form.subtitle"
          placeholder="如 先行篇、夜谈、番外 01"
          :maxlength="80"
          show-count
        />
      </a-form-item>

      <a-form-item label="底图上传" required>
        <a-upload-dragger
          class="chapter-upload-dragger"
          accept=".jpg,.jpeg,.png,.webp"
          :multiple="true"
          :before-upload="handleBeforeUpload"
          :file-list="fileList"
          @remove="handleRemove"
        >
          <p class="ant-upload-drag-icon">
            <InboxOutlined style="color: var(--brand-primary)" />
          </p>
          <p class="ant-upload-text">点击或拖拽上传本话全部原始图片</p>
          <p class="ant-upload-hint">
            当前链路要求整批图片使用同一种扩展名，支持
            jpg、png、webp，上传时会按文件名自然排序。
          </p>
        </a-upload-dragger>

        <div v-if="selectedFileCount > 0" class="chapter-upload-summary">
          已选择 {{ selectedFileCount }} 张图片。
        </div>

        <div v-if="submitting" class="chapter-upload-progress">
          <div class="chapter-upload-progress__head">
            <span>上传进度</span>
            <strong>{{ uploadProgressPercent }}%</strong>
          </div>

          <a-progress
            status="active"
            :percent="uploadProgressPercent"
            :show-info="false"
          />

          <div class="chapter-upload-progress__hint">
            已完成 {{ uploadedFileCount }} / {{ selectedFileCount }} 张
            <span v-if="currentUploadingFileName">
              ，当前：{{ currentUploadingFileName }}
            </span>
          </div>
        </div>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { message } from "ant-design-vue";
import type { UploadFile, UploadProps } from "ant-design-vue";
import { InboxOutlined } from "@ant-design/icons-vue";

import {
  createChapter,
  reserveChapterPages,
  updatePage,
} from "../../api/modules";
import {
  resolveImageFileExtension,
  uploadFileToPresignedPutUrl,
} from "../../api/objectStorage";

interface Props {
  open: boolean;
  comicId?: string;
  comicTitle?: string;
  chapterCount?: number;
  defaultRoleSummaries?: Array<{
    key: string;
    roleLabel: string;
    assigneeName?: string;
  }>;
  nextChapterNumber?: number;
  usedChapterNumbers?: number[];
}

interface ChapterCreateForm {
  subtitle: string;
  chapterNumber: number | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (event: "update:open", value: boolean): void;
  (event: "created"): void;
}>();

const submitting = ref(false);
const uploadProgressPercent = ref(0);
const uploadedFileCount = ref(0);
const currentUploadingFileName = ref<string | undefined>(undefined);
const selectedFiles = ref<Array<{ uid: string; file: File }>>([]);
const fileList = computed<UploadFile[]>(() => {
  return selectedFiles.value.map(({ uid, file }) => ({
    uid,
    name: file.name,
    status: "done",
  }));
});
const form = reactive<ChapterCreateForm>({
  subtitle: "",
  chapterNumber: null,
});

const nextChapterNumber = computed(
  () => props.nextChapterNumber ?? (props.chapterCount ?? 0) + 1,
);
const selectedFileCount = computed(() => selectedFiles.value.length);
const usedChapterNumberSet = computed(
  () => new Set((props.usedChapterNumbers || []).filter((item) => item > 0)),
);
const chapterNumberAlert = computed(() => {
  if (typeof form.chapterNumber === "number") {
    return `将按你指定的编号创建第 ${form.chapterNumber} 话；如果该编号历史上已使用过，后端会拒绝创建。`;
  }

  return `章节序号默认由后端分配，当前预计会创建第 ${nextChapterNumber.value} 话。`;
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm();
    }
  },
);

function sortSelectedUploadFiles(
  fileItems: Array<{ uid: string; file: File }>,
): Array<{ uid: string; file: File }> {
  return [...fileItems].sort((leftFile, rightFile) => {
    return leftFile.file.name.localeCompare(rightFile.file.name, "zh-CN", {
      numeric: true,
      sensitivity: "base",
    });
  });
}

const handleBeforeUpload: UploadProps["beforeUpload"] = (rawFile) => {
  const normalizedFile = rawFile as File;
  if (!resolveSupportedImageExtension(normalizedFile)) {
    message.error("仅支持 jpg、png、webp 图片");
    return false;
  }

  selectedFiles.value = sortSelectedUploadFiles([
    ...selectedFiles.value,
    {
      uid: rawFile.uid,
      file: normalizedFile,
    },
  ]);

  return false;
};

function handleRemove(targetFile: UploadFile): boolean {
  selectedFiles.value = selectedFiles.value.filter(
    (fileItem) => fileItem.uid !== targetFile.uid,
  );
  return true;
}

function handleCancel(): void {
  if (submitting.value) {
    return;
  }

  emit("update:open", false);
}

function resetForm(): void {
  form.subtitle = "";
  form.chapterNumber = null;
  selectedFiles.value = [];
  resetUploadProgress();
}

function resetUploadProgress(): void {
  uploadProgressPercent.value = 0;
  uploadedFileCount.value = 0;
  currentUploadingFileName.value = undefined;
}

function getSelectedFiles(): File[] {
  return sortSelectedUploadFiles(selectedFiles.value).map(
    (fileItem) => fileItem.file,
  );
}

function resolveSupportedImageExtension(file: File): string | null {
  const extension = resolveImageFileExtension(file);
  return extension === "jpg" || extension === "png" || extension === "webp"
    ? extension
    : null;
}

function buildImageContentType(file: File, extension: string): string {
  const normalizedType = file.type.trim().toLowerCase();
  if (normalizedType) {
    return normalizedType;
  }

  return extension === "jpg" ? "image/jpeg" : `image/${extension}`;
}

async function handleSubmit(): Promise<void> {
  if (!props.comicId) {
    message.error("当前项目尚未初始化，无法创建章节");
    return;
  }

  const subtitle = form.subtitle.trim();
  if (!subtitle) {
    message.warning("请输入章节副标题");
    return;
  }

  const chapterNumber = form.chapterNumber;
  if (chapterNumber !== null) {
    if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
      message.warning("章节话数必须是大于 0 的整数");
      return;
    }

    if (usedChapterNumberSet.value.has(chapterNumber)) {
      message.error(`第 ${chapterNumber} 话已存在或已被使用，请更换编号`);
      return;
    }
  }

  const selectedFiles = getSelectedFiles();
  if (selectedFiles.length === 0) {
    message.error("新建章节必须至少上传一张图片");
    return;
  }

  const extensions = selectedFiles.map((file) =>
    resolveSupportedImageExtension(file),
  );
  if (extensions.some((extension) => !extension)) {
    message.error("存在不受支持的图片格式，请仅上传 jpg、png、webp");
    return;
  }

  const normalizedExtensions = extensions.filter(
    (extension): extension is string => Boolean(extension),
  );
  const uniqueExtensions = new Set(normalizedExtensions);
  if (uniqueExtensions.size !== 1) {
    message.error("当前后端要求整批底图使用同一种扩展名，请统一后再上传");
    return;
  }

  submitting.value = true;
  resetUploadProgress();
  const messageKey = "create-chapter-upload";

  try {
    message.loading({
      content: "正在创建章节并上传底图...",
      key: messageKey,
      duration: 0,
    });

    const createdChapter = await createChapter({
      comic_id: props.comicId,
      subtitle,
      index: chapterNumber === null ? undefined : chapterNumber - 1,
    });

    const reserveResult = await reserveChapterPages({
      chapter_id: createdChapter.id,
      page_count: selectedFiles.length,
      extension: normalizedExtensions[0],
    });

    if (reserveResult.creations.length !== selectedFiles.length) {
      throw new Error("页面预留数量与上传文件数量不一致");
    }

    const totalUploadBytes = selectedFiles.reduce(
      (totalBytes, file) => totalBytes + (file.size || 0),
      0,
    );
    let completedUploadBytes = 0;

    for (const [index, pageCreation] of reserveResult.creations.entries()) {
      const file = selectedFiles[index];
      const contentType = buildImageContentType(file, normalizedExtensions[0]);
      const fileSize = file.size || 0;

      currentUploadingFileName.value = file.name;

      await uploadFileToPresignedPutUrl(
        pageCreation.put_url,
        file,
        contentType,
        {
          onProgress: ({ loaded }) => {
            const currentUploadedBytes = completedUploadBytes + loaded;
            uploadProgressPercent.value = totalUploadBytes
              ? Math.min(
                  100,
                  Math.round((currentUploadedBytes / totalUploadBytes) * 100),
                )
              : 0;
          },
        },
      );

      completedUploadBytes += fileSize;
      uploadedFileCount.value = index + 1;
      uploadProgressPercent.value = totalUploadBytes
        ? Math.min(
            100,
            Math.round((completedUploadBytes / totalUploadBytes) * 100),
          )
        : 100;

      await updatePage(pageCreation.page_id, { is_uploaded: true });
    }

    currentUploadingFileName.value = undefined;
    uploadProgressPercent.value = 100;

    message.success({
      content: `第 ${chapterNumber ?? nextChapterNumber.value} 话已创建，并完成 ${selectedFiles.length} 张底图上传`,
      key: messageKey,
      duration: 2,
    });

    emit("update:open", false);
    emit("created");
  } catch (error: unknown) {
    message.error({
      content: error instanceof Error ? error.message : "创建章节失败",
      key: messageKey,
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.chapter-modal-alert {
  margin-bottom: 16px;
}

.chapter-upload-summary {
  margin-top: 12px;
  color: var(--text-muted, #64748b);
  font-size: 12px;
}

.chapter-upload-progress {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid
    color-mix(in srgb, var(--panel-border, #dbe5f0) 82%, transparent);
  border-radius: 12px;
  background: color-mix(
    in srgb,
    var(--panel-bg, #f8fafc) 92%,
    var(--surface, white) 8%
  );
}

.chapter-upload-progress__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: var(--text-primary, #0f172a);
  font-size: 13px;
}

.chapter-upload-progress__hint {
  margin-top: 10px;
  color: var(--text-muted, #64748b);
  font-size: 12px;
  line-height: 1.6;
}

.chapter-default-role-panel {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid
    color-mix(in srgb, var(--panel-border, #dbe5f0) 82%, transparent);
  border-radius: 12px;
  background: color-mix(
    in srgb,
    var(--panel-bg, #f8fafc) 90%,
    var(--surface, white) 10%
  );
}

.chapter-default-role-panel__title {
  color: var(--text-muted, #475569);
  font-size: 12px;
  line-height: 1.6;
}

.chapter-default-role-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.chapter-default-role-panel__item {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid
    color-mix(in srgb, var(--panel-border, #dbe5f0) 60%, transparent);
  background: color-mix(
    in srgb,
    var(--surface, white) 84%,
    var(--panel-bg, #f8fafc) 16%
  );
}

.chapter-default-role-panel__label {
  color: var(--text-muted, #64748b);
  font-size: 12px;
}

.chapter-default-role-panel__value {
  margin-top: 4px;
  color: var(--text-primary, #0f172a);
  font-size: 13px;
  font-weight: 600;
}

.chapter-form-hint {
  margin-top: 8px;
  color: var(--text-muted, #64748b);
  font-size: 12px;
  line-height: 1.6;
}

:deep(.chapter-upload-dragger.ant-upload-wrapper .ant-upload-drag) {
  border-radius: 14px;
  border-color: color-mix(
    in srgb,
    var(--panel-border, #dbe5f0) 78%,
    transparent
  );
  background: color-mix(
    in srgb,
    var(--panel-bg, #f8fafc) 90%,
    var(--surface, white) 10%
  );
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

:deep(.chapter-upload-dragger.ant-upload-wrapper:hover .ant-upload-drag),
:deep(.chapter-upload-dragger.ant-upload-wrapper .ant-upload-drag-hover) {
  border-color: var(--control-btn-primary-border, #9b73f2);
  background: color-mix(
    in srgb,
    var(--panel-bg, #f8fafc) 80%,
    var(--control-btn-primary-border, #9b73f2) 20%
  );
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
}

:deep(.chapter-upload-dragger.ant-upload-wrapper .ant-upload-btn) {
  padding: 24px 20px;
}

:deep(.chapter-upload-dragger.ant-upload-wrapper .ant-upload-drag-icon) {
  margin-bottom: 10px;
}

:deep(.chapter-upload-dragger.ant-upload-wrapper .ant-upload-text) {
  color: var(--text-primary, #0f172a);
  font-size: 14px;
  font-weight: 600;
}

:deep(.chapter-upload-dragger.ant-upload-wrapper .ant-upload-hint) {
  color: var(--text-muted, #64748b);
  font-size: 12px;
  line-height: 1.7;
}

:deep(.chapter-upload-dragger.ant-upload-wrapper .ant-upload-list-item) {
  margin-top: 10px;
  border-radius: 10px;
  border: 1px solid
    color-mix(in srgb, var(--panel-border, #dbe5f0) 72%, transparent);
  background: color-mix(
    in srgb,
    var(--panel-bg, #f8fafc) 92%,
    var(--surface, white) 8%
  );
}

:deep(.chapter-upload-dragger.ant-upload-wrapper .ant-upload-list-item-name),
:deep(
  .chapter-upload-dragger.ant-upload-wrapper .ant-upload-list-item-actions
) {
  color: var(--text-primary, #0f172a);
}

:deep(
  .chapter-upload-dragger.ant-upload-wrapper
    .ant-upload-list-item-card-actions-btn
) {
  color: var(--text-muted, #64748b);
}

:deep(
  .chapter-upload-dragger.ant-upload-wrapper
    .ant-upload-list-item-card-actions-btn:hover
) {
  color: var(--text-primary, #0f172a);
}

@media (max-width: 640px) {
  .chapter-default-role-panel__grid {
    grid-template-columns: 1fr;
  }
}
</style>
