<template>
  <a-modal
    :open="open"
    title="新建本地项目"
    ok-text="创建并进入"
    cancel-text="取消"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: !canSubmit }"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <div class="project-create-modal">
      <p class="project-create-modal__intro">
        选择本地图片目录后，会自动按文件顺序生成页面。Electron 客户端直接引用本地文件，web 端则写入浏览器本地存储。
      </p>

      <a-form layout="vertical">
        <a-form-item label="作者">
          <a-input
            v-model:value="author"
            placeholder="例如：海边校对组"
            :maxlength="40"
          />
        </a-form-item>

        <a-form-item label="项目标题">
          <a-input
            v-model:value="title"
            placeholder="例如：第 12 话翻校项目"
            :maxlength="80"
          />
        </a-form-item>

        <a-form-item label="图片目录">
          <div class="project-create-modal__picker-row">
            <a-input
              :value="selectedCollection?.source_label || ''"
              readonly
              placeholder="请选择图片目录"
            />
            <a-button :loading="selecting" @click="handleSelectCollection">
              选择目录
            </a-button>
          </div>
        </a-form-item>
      </a-form>

      <a-alert
        v-if="selectedCollection"
        type="success"
        show-icon
        :message="`已选中 ${selectedCollection.files.length} 张图片`"
        :description="buildSelectionDescription()"
      />

      <div v-if="selectedCollection" class="project-create-modal__preview">
        <div class="project-create-modal__preview-header">
          <span>页面预览</span>
          <span>
            {{ selectedCollection.files.length }} 页
          </span>
        </div>

        <div class="project-create-modal__preview-list">
          <div
            v-for="fileItem in previewFiles"
            :key="fileItem.name"
            class="project-create-modal__preview-item"
          >
            {{ fileItem.name }}
          </div>
        </div>

        <div
          v-if="selectedCollection.files.length > previewFiles.length"
          class="project-create-modal__preview-more"
        >
          其余 {{ selectedCollection.files.length - previewFiles.length }} 页将在创建后自动加入项目。
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 文件用途：提供“新建本地项目”弹窗。
 * 该组件负责采集作者、标题和图片目录，并在 web/client 双端转换为统一的本地项目数据。
 */
import { computed, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { storeToRefs } from "pinia";
import { storeWebProjectImageAsset } from "../../local-project/assets";
import {
  selectProjectImageCollection,
  type SelectedProjectImageCollection,
} from "../../local-project/picker";
import type { LocalProjectDraftPage } from "../../local-project/types";
import { useLocalProjectsStore } from "../../stores/localProjects";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (event: "cancel"): void;
  (event: "created", projectID: string): void;
}>();

const localProjectsStore = useLocalProjectsStore();
const { projects } = storeToRefs(localProjectsStore);

const author = ref("");
const title = ref("");
const selecting = ref(false);
const saving = ref(false);
const selectedCollection = ref<SelectedProjectImageCollection | null>(null);

/**
 * 仅展示前几项预览，避免长目录把弹窗撑满。
 */
const previewFiles = computed(() => {
  return selectedCollection.value?.files.slice(0, 10) ?? [];
});

/**
 * 表单完整时才允许提交。
 */
const canSubmit = computed(() => {
  return (
    author.value.trim().length > 0 &&
    title.value.trim().length > 0 &&
    (selectedCollection.value?.files.length ?? 0) > 0
  );
});

watch(
  () => props.open,
  (nextOpen) => {
    if (!nextOpen) {
      return;
    }

    // 使用最近项目作者作为默认值，减少重复输入。
    author.value = projects.value[0]?.author ?? "";
    title.value = "";
    selectedCollection.value = null;
  },
);

/**
 * 生成图片来源说明。
 */
function buildSelectionDescription(): string {
  if (!selectedCollection.value) {
    return "";
  }

  const sourceLabel =
    selectedCollection.value.source_kind === "electron-directory"
      ? "客户端原生目录"
      : "浏览器目录导入";

  return `${sourceLabel} · ${selectedCollection.value.source_label}`;
}

/**
 * 选择图片目录。
 */
async function handleSelectCollection(): Promise<void> {
  selecting.value = true;

  try {
    const nextCollection = await selectProjectImageCollection();

    if (!nextCollection) {
      message.info("未选择可用图片目录");
      return;
    }

    selectedCollection.value = nextCollection;
    message.success(`已选择 ${nextCollection.files.length} 张图片`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "读取图片目录失败";
    message.error(errorMessage);
  } finally {
    selecting.value = false;
  }
}

/**
 * 将选择结果转换为项目页面草稿。
 * web 端在这里把图片写入 IndexedDB；Electron 端只保留本地路径引用。
 */
async function buildDraftPages(): Promise<LocalProjectDraftPage[]> {
  if (!selectedCollection.value) {
    return [];
  }

  const draftPages: LocalProjectDraftPage[] = [];

  for (const fileItem of selectedCollection.value.files) {
    if (
      selectedCollection.value.source_kind === "electron-directory" &&
      fileItem.path
    ) {
      draftPages.push({
        name: fileItem.name,
        image_source: {
          kind: "electron-file",
          name: fileItem.name,
          path: fileItem.path,
        },
      });
      continue;
    }

    if (fileItem.file) {
      const assetID = await storeWebProjectImageAsset(fileItem.file);
      draftPages.push({
        name: fileItem.name,
        image_source: {
          kind: "web-asset",
          name: fileItem.name,
          asset_id: assetID,
        },
      });
    }
  }

  return draftPages;
}

/**
 * 提交创建。
 */
async function handleSubmit(): Promise<void> {
  if (!canSubmit.value) {
    message.warning("请先填写作者、标题并选择图片目录");
    return;
  }

  saving.value = true;

  try {
    const pages = await buildDraftPages();

    if (pages.length === 0) {
      message.warning("未识别到可导入的图片文件");
      return;
    }

    const nextProject = localProjectsStore.createProject({
      author: author.value.trim(),
      title: title.value.trim(),
      source_label: selectedCollection.value?.source_label,
      pages,
    });

    message.success("本地项目创建成功");
    emit("created", nextProject.id);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "创建本地项目失败";
    message.error(errorMessage);
  } finally {
    saving.value = false;
  }
}

/**
 * 关闭弹窗。
 */
function handleCancel(): void {
  emit("cancel");
}
</script>

<style scoped lang="scss">
.project-create-modal {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.project-create-modal__intro {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.6;
}

.project-create-modal__picker-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.project-create-modal__preview {
  border-radius: 14px;
  border: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel-bg) 82%, transparent);
  padding: 12px;
}

.project-create-modal__preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--text-muted);
}

.project-create-modal__preview-list {
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}

.project-create-modal__preview-item {
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 74%, transparent);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.4;
  word-break: break-all;
}

.project-create-modal__preview-more {
  margin-top: 10px;
  color: var(--text-muted);
  font-size: 12px;
}
</style>