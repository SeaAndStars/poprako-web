<template>
  <a-modal
    :open="open"
    width="600px"
    title="编辑漫画项目"
    ok-text="保存修改"
    cancel-text="取消"
    :confirm-loading="submitting"
    @update:open="$emit('update:open', $event)"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-alert
      message="更新项目资料"
      description="你可以在这里更新项目名称、简介、作者、状态、默认岗位和封面。保存后详情页与列表页会自动刷新。"
      type="info"
      show-icon
      style="margin-bottom: 24px"
    />

    <a-form layout="vertical">
      <a-form-item label="项目名称" required>
        <a-input v-model:value="form.name" placeholder="请输入漫画项目名称" />
      </a-form-item>

      <a-form-item label="项目简介 (可选)">
        <a-textarea
          v-model:value="form.description"
          :auto-size="{ minRows: 2, maxRows: 4 }"
          placeholder="补充一下项目简介、连载说明或协作约定..."
        />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="作者 (可选)">
            <a-input
              v-model:value="form.author"
              placeholder="例如：尾田荣一郎"
            />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="状态 (可选)">
            <a-select
              v-model:value="form.status"
              allow-clear
              placeholder="选择项目状态"
              :options="WORKSET_STATUS_OPTIONS"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="项目封面 (可选)">
        <div class="workset-edit-modal__cover-preview">
          <div class="workset-edit-modal__cover-image">
            <a-image
              v-if="coverPreviewUrl"
              :src="coverPreviewUrl"
              :preview="false"
            />
            <div v-else class="workset-edit-modal__cover-placeholder">
              暂无封面
            </div>
          </div>

          <div class="workset-edit-modal__cover-meta">
            <div class="workset-edit-modal__cover-label">
              {{ coverPreviewLabel }}
            </div>
            <div class="workset-edit-modal__cover-hint">
              支持 jpg、png、webp。选择新图片后会在保存时直传并替换旧封面。
            </div>
          </div>
        </div>

        <a-upload-dragger
          class="workset-upload-dragger"
          accept="image/*"
          :multiple="false"
          :max-count="1"
          :before-upload="handleCoverBeforeUpload"
          :file-list="coverFileList"
          @remove="handleCoverRemove"
        >
          <p class="ant-upload-drag-icon">
            <InboxOutlined style="color: var(--brand-primary)" />
          </p>
          <p class="ant-upload-text">点击或拖拽新的封面图片到这里</p>
          <p class="ant-upload-hint">如果不选择新图片，会保留当前封面。</p>
        </a-upload-dragger>
      </a-form-item>

      <a-divider dashed />

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="默认翻译">
            <a-select
              v-model:value="form.translator_user_id"
              allow-clear
              show-search
              option-filter-prop="label"
              :loading="loadingMembers"
              placeholder="空缺 (缺省)"
              :options="translatorMemberOptions"
            />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="默认校对">
            <a-select
              v-model:value="form.proofreader_user_id"
              allow-clear
              show-search
              option-filter-prop="label"
              :loading="loadingMembers"
              placeholder="空缺 (缺省)"
              :options="proofreaderMemberOptions"
            />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="默认嵌字">
            <a-select
              v-model:value="form.typesetter_user_id"
              allow-clear
              show-search
              option-filter-prop="label"
              :loading="loadingMembers"
              placeholder="空缺 (缺省)"
              :options="typesetterMemberOptions"
            />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="默认审稿/监修">
            <a-select
              v-model:value="form.reviewer_user_id"
              allow-clear
              show-search
              option-filter-prop="label"
              :loading="loadingMembers"
              placeholder="空缺 (缺省)"
              :options="reviewerMemberOptions"
            />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { message } from "ant-design-vue";
import type { UploadFile, UploadProps } from "ant-design-vue";
import { InboxOutlined } from "@ant-design/icons-vue";

import {
  confirmWorksetCoverUploaded,
  getMemberList,
  reserveWorksetCover,
  updateWorkset,
} from "../../api/modules";
import {
  appendCacheBustQueryToUrl,
  resolveImageFileExtension,
  uploadFileToPresignedPutUrl,
} from "../../api/objectStorage";
import { useBlobAssetUrlCache } from "../../composables/useBlobAssetUrlCache";
import type { MemberInfo, WorksetInfo } from "../../types/domain";
import { WORKSET_STATUS_OPTIONS } from "./worksetStatus";

interface Props {
  open: boolean;
  workset?: WorksetInfo;
}

interface WorksetEditForm {
  name: string;
  description: string;
  author: string;
  status?: string;
  translator_user_id?: string;
  proofreader_user_id?: string;
  typesetter_user_id?: string;
  reviewer_user_id?: string;
}

type RoleKey =
  | "assigned_translator_at"
  | "assigned_proofreader_at"
  | "assigned_typesetter_at"
  | "assigned_reviewer_at";

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "updated"): void;
}>();

const teamMembers = ref<MemberInfo[]>([]);
const loadingMembers = ref(false);
const submitting = ref(false);
const coverFile = ref<File | null>(null);
const coverFileList = ref<UploadFile[]>([]);
const coverObjectUrl = ref<string | undefined>(undefined);
const { resolveDisplayAssetUrl } = useBlobAssetUrlCache();

const form = reactive<WorksetEditForm>({
  name: "",
  description: "",
  author: "",
  status: undefined,
  translator_user_id: undefined,
  proofreader_user_id: undefined,
  typesetter_user_id: undefined,
  reviewer_user_id: undefined,
});

const translatorMembers = computed(() =>
  getMembersByRole("assigned_translator_at"),
);
const proofreaderMembers = computed(() =>
  getMembersByRole("assigned_proofreader_at"),
);
const typesetterMembers = computed(() =>
  getMembersByRole("assigned_typesetter_at"),
);
const reviewerMembers = computed(() =>
  getMembersByRole("assigned_reviewer_at"),
);
const translatorMemberOptions = computed(() =>
  buildMemberOptions(translatorMembers.value),
);
const proofreaderMemberOptions = computed(() =>
  buildMemberOptions(proofreaderMembers.value),
);
const typesetterMemberOptions = computed(() =>
  buildMemberOptions(typesetterMembers.value),
);
const reviewerMemberOptions = computed(() =>
  buildMemberOptions(reviewerMembers.value),
);
const currentCoverUrl = computed(() =>
  appendCacheBustQueryToUrl(
    props.workset?.cover_url,
    props.workset?.updated_at,
  ),
);
const coverPreviewUrl = computed(
  () =>
    coverObjectUrl.value ||
    resolveDisplayAssetUrl(currentCoverUrl.value, {
      fallbackToRawUrl: true,
    }),
);
const coverPreviewLabel = computed(() => {
  if (coverFile.value) {
    return "待上传的新封面";
  }

  if (currentCoverUrl.value) {
    return "当前封面";
  }

  return "暂无封面";
});

watch(
  () => coverFile.value,
  (nextFile, _previousFile, onCleanup) => {
    coverObjectUrl.value = undefined;

    if (!nextFile) {
      return;
    }

    const nextObjectUrl = URL.createObjectURL(nextFile);
    coverObjectUrl.value = nextObjectUrl;

    onCleanup(() => {
      URL.revokeObjectURL(nextObjectUrl);
    });
  },
);

watch(
  () => ({
    isOpen: props.open,
    worksetId: props.workset?.id,
    updatedAt: props.workset?.updated_at,
  }),
  async ({ isOpen }) => {
    if (!isOpen) {
      resetTransientState();
      return;
    }

    syncFormWithWorkset();
    await loadTeamMembers();
  },
);

function getMembersByRole(roleKey: RoleKey): MemberInfo[] {
  return teamMembers.value.filter((member) => Boolean(member[roleKey]));
}

function buildMemberOptionLabel(member: MemberInfo): string {
  const displayName = member.user?.name?.trim() || member.user_id;
  const qq = member.user?.qq?.trim();
  return qq ? `${displayName} · QQ ${qq}` : displayName;
}

function buildMemberOptions(members: MemberInfo[]) {
  return members.map((member) => ({
    label: buildMemberOptionLabel(member),
    value: member.user_id,
  }));
}

function syncFormWithWorkset(): void {
  form.name = props.workset?.name || "";
  form.description = props.workset?.description || "";
  form.author = props.workset?.author || "";
  form.status = props.workset?.status || undefined;
  form.translator_user_id = props.workset?.translator_user_id;
  form.proofreader_user_id = props.workset?.proofreader_user_id;
  form.typesetter_user_id = props.workset?.typesetter_user_id;
  form.reviewer_user_id = props.workset?.reviewer_user_id;
  resetTransientState();
}

function resetTransientState(): void {
  coverFile.value = null;
  coverFileList.value = [];
  coverObjectUrl.value = undefined;
}

async function loadTeamMembers(): Promise<void> {
  if (!props.workset?.team_id) {
    teamMembers.value = [];
    return;
  }

  loadingMembers.value = true;

  try {
    teamMembers.value = await getMemberList({
      team_id: props.workset.team_id,
      offset: 0,
      limit: 100,
      includes: ["user"],
    });
  } catch (error: unknown) {
    teamMembers.value = [];
    message.error(error instanceof Error ? error.message : "加载团队成员失败");
  } finally {
    loadingMembers.value = false;
  }
}

const handleCoverBeforeUpload: UploadProps["beforeUpload"] = (rawFile) => {
  coverFile.value = rawFile as File;
  coverFileList.value = [
    {
      uid: rawFile.uid,
      name: rawFile.name,
      status: "done",
      originFileObj: rawFile,
    },
  ];

  return false;
};

function handleCoverRemove(): boolean {
  resetTransientState();
  return true;
}

async function uploadCoverIfNeeded(): Promise<void> {
  if (!props.workset?.id || !coverFile.value) {
    return;
  }

  const extension = resolveImageFileExtension(coverFile.value);
  const contentType = coverFile.value.type.trim() || `image/${extension}`;
  const reserveResult = await reserveWorksetCover(props.workset.id, {
    extension,
    content_type: contentType,
  });

  await uploadFileToPresignedPutUrl(
    reserveResult.put_url,
    coverFile.value,
    contentType,
  );
  await confirmWorksetCoverUploaded(props.workset.id);
}

async function handleSubmit(): Promise<void> {
  if (!props.workset?.id) {
    message.error("无法定位当前工作集");
    return;
  }

  if (!form.name.trim()) {
    message.warning("请输入项目名称");
    return;
  }

  submitting.value = true;

  try {
    await updateWorkset(props.workset.id, {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      author: form.author.trim() || undefined,
      status: form.status,
      translator_user_id: form.translator_user_id,
      proofreader_user_id: form.proofreader_user_id,
      typesetter_user_id: form.typesetter_user_id,
      reviewer_user_id: form.reviewer_user_id,
    });

    try {
      await uploadCoverIfNeeded();
      message.success("漫画项目已更新");
    } catch (error: unknown) {
      message.warning(
        error instanceof Error
          ? `项目信息已保存，但封面上传失败：${error.message}`
          : "项目信息已保存，但封面上传失败",
      );
    }

    emit("update:open", false);
    emit("updated");
  } catch (error: unknown) {
    message.error(error instanceof Error ? error.message : "更新漫画项目失败");
  } finally {
    submitting.value = false;
  }
}

function handleCancel(): void {
  emit("update:open", false);
}
</script>

<style scoped lang="scss">
.workset-edit-modal__cover-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.workset-edit-modal__cover-image {
  overflow: hidden;
  flex: 0 0 108px;
  width: 108px;
  height: 144px;
  border: 1px solid var(--panel-border, rgba(15, 23, 42, 0.12));
  border-radius: 18px;
  background: color-mix(in srgb, var(--panel-bg, #ffffff) 90%, #0f172a 10%);
}

.workset-edit-modal__cover-image :deep(.ant-image),
.workset-edit-modal__cover-image :deep(.ant-image-img) {
  width: 100%;
  height: 100%;
}

.workset-edit-modal__cover-image :deep(.ant-image-img) {
  object-fit: cover;
}

.workset-edit-modal__cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--text-muted, #64748b);
  font-size: 13px;
  text-align: center;
}

.workset-edit-modal__cover-meta {
  display: grid;
  gap: 6px;
}

.workset-edit-modal__cover-label {
  color: var(--text-primary, #0f172a);
  font-weight: 600;
}

.workset-edit-modal__cover-hint {
  color: var(--text-muted, #64748b);
  font-size: 12px;
  line-height: 1.6;
}

:deep(.workset-upload-dragger.ant-upload-wrapper .ant-upload-drag) {
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

:deep(.workset-upload-dragger.ant-upload-wrapper:hover .ant-upload-drag),
:deep(.workset-upload-dragger.ant-upload-wrapper .ant-upload-drag-hover) {
  border-color: var(--control-btn-primary-border, #9b73f2);
  background: color-mix(
    in srgb,
    var(--panel-bg, #f8fafc) 80%,
    var(--control-btn-primary-border, #9b73f2) 20%
  );
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
}

:deep(.workset-upload-dragger.ant-upload-wrapper .ant-upload-btn) {
  padding: 24px 20px;
}

:deep(.workset-upload-dragger.ant-upload-wrapper .ant-upload-drag-icon) {
  margin-bottom: 10px;
}

:deep(.workset-upload-dragger.ant-upload-wrapper .ant-upload-text) {
  color: var(--text-primary, #0f172a);
  font-size: 14px;
  font-weight: 600;
}

:deep(.workset-upload-dragger.ant-upload-wrapper .ant-upload-hint) {
  color: var(--text-muted, #64748b);
  font-size: 12px;
  line-height: 1.7;
}

:deep(.workset-upload-dragger.ant-upload-wrapper .ant-upload-list-item) {
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

:deep(.workset-upload-dragger.ant-upload-wrapper .ant-upload-list-item-name),
:deep(
  .workset-upload-dragger.ant-upload-wrapper .ant-upload-list-item-actions
) {
  color: var(--text-primary, #0f172a);
}

:deep(
  .workset-upload-dragger.ant-upload-wrapper
    .ant-upload-list-item-card-actions-btn
) {
  color: var(--text-muted, #64748b);
}

:deep(
  .workset-upload-dragger.ant-upload-wrapper
    .ant-upload-list-item-card-actions-btn:hover
) {
  color: var(--text-primary, #0f172a);
}

@media (max-width: 640px) {
  .workset-edit-modal__cover-preview {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
