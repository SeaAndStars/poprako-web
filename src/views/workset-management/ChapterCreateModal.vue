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
          {{
            nextChapterNumber
          }}
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
          accept=".jpg,.jpeg,.png,.webp"
          :multiple="true"
          :before-upload="handleBeforeUpload"
          :file-list="fileList"
          @remove="handleRemove"
        >
          <p class="ant-upload-drag-icon">
            <InboxOutlined style="color: var(--color-primary)" />
          </p>
          <p class="ant-upload-text">点击或拖拽上传本话全部原始图片</p>
          <p class="ant-upload-hint">
            当前链路要求整批图片使用同一种扩展名，支持 jpg、png、webp。
          </p>
        </a-upload-dragger>

        <div v-if="selectedFileCount > 0" class="chapter-upload-summary">
          已选择 {{ selectedFileCount }} 张图片。
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

const handleBeforeUpload: UploadProps["beforeUpload"] = (rawFile) => {
  const normalizedFile = rawFile as File;
  if (!resolveSupportedImageExtension(normalizedFile)) {
    message.error("仅支持 jpg、png、webp 图片");
    return false;
  }

  selectedFiles.value = [
    ...selectedFiles.value,
    {
      uid: rawFile.uid,
      file: normalizedFile,
    },
  ];

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
}

function getSelectedFiles(): File[] {
  return selectedFiles.value.map((fileItem) => fileItem.file);
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

    for (const [index, pageCreation] of reserveResult.creations.entries()) {
      const file = selectedFiles[index];
      const contentType = buildImageContentType(file, normalizedExtensions[0]);

      await uploadFileToPresignedPutUrl(
        pageCreation.put_url,
        file,
        contentType,
      );
      await updatePage(pageCreation.page_id, { is_uploaded: true });
    }

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
  color: var(--color-on-surface-variant, #64748b);
  font-size: 12px;
}

.chapter-form-hint {
  margin-top: 8px;
  color: var(--color-on-surface-variant, #64748b);
  font-size: 12px;
  line-height: 1.6;
}
</style>
