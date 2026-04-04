<template>
  <a-modal
    :open="open"
    width="560px"
    title="新建漫画项目"
    ok-text="确认创建"
    cancel-text="取消"
    :confirm-loading="submitting"
    @update:open="$emit('update:open', $event)"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-alert
      message="项目封面与默认岗位"
      description="创建后系统会同步生成同名漫画，你可以直接进入章节管理。默认翻译、嵌字、校对和审稿负责人都可以先留空；如果选择封面，系统会在创建后自动直传。"
      type="info"
      show-icon
      style="margin-bottom: 24px"
    />

    <a-form layout="vertical">
      <a-form-item label="项目名称" required>
        <a-input
          v-model:value="form.name"
          placeholder="请输入你要创建的漫画项目名称"
        />
      </a-form-item>

      <a-form-item label="简介 (可选)">
        <a-textarea
          v-model:value="form.description"
          :auto-size="{ minRows: 2, maxRows: 4 }"
          placeholder="简单描述一下这个工作集的用途或连载信息..."
        />
      </a-form-item>

      <a-form-item label="封面 (可选)">
        <a-upload-dragger
          accept="image/*"
          :multiple="false"
          :max-count="1"
          :before-upload="handleCoverBeforeUpload"
          :file-list="coverFileList"
          @remove="handleCoverRemove"
        >
          <p class="ant-upload-drag-icon">
            <InboxOutlined style="color: var(--color-primary)" />
          </p>
          <p class="ant-upload-text">点击或拖拽封面图片到这里</p>
          <p class="ant-upload-hint">支持 jpg、png、webp，创建后会自动上传。</p>
        </a-upload-dragger>
      </a-form-item>

      <a-divider dashed />

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="翻译">
            <a-select
              v-model:value="form.translator_user_id"
              allow-clear
              placeholder="空缺 (缺省)"
            >
              <a-select-option
                v-for="member in translatorMembers"
                :key="member.user_id"
                :value="member.user_id"
              >
                {{ member.user?.name || member.user_id }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="校对">
            <a-select
              v-model:value="form.proofreader_user_id"
              allow-clear
              placeholder="空缺 (缺省)"
            >
              <a-select-option
                v-for="member in proofreaderMembers"
                :key="member.user_id"
                :value="member.user_id"
              >
                {{ member.user?.name || member.user_id }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="嵌字">
            <a-select
              v-model:value="form.typesetter_user_id"
              allow-clear
              placeholder="空缺 (缺省)"
            >
              <a-select-option
                v-for="member in typesetterMembers"
                :key="member.user_id"
                :value="member.user_id"
              >
                {{ member.user?.name || member.user_id }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="审稿/监修">
            <a-select
              v-model:value="form.reviewer_user_id"
              allow-clear
              placeholder="空缺 (缺省)"
            >
              <a-select-option
                v-for="member in reviewerMembers"
                :key="member.user_id"
                :value="member.user_id"
              >
                {{ member.user?.name || member.user_id }}
              </a-select-option>
            </a-select>
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
  createWorkset,
  getMemberList,
  reserveWorksetCover,
} from "../../api/modules";
import {
  resolveImageFileExtension,
  uploadFileToPresignedPutUrl,
} from "../../api/objectStorage";
import type { MemberInfo } from "../../types/domain";

interface Props {
  open: boolean;
  teamId?: string;
}

interface WorksetCreateForm {
  name: string;
  description: string;
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
  (e: "created"): void;
}>();

const teamMembers = ref<MemberInfo[]>([]);
const submitting = ref(false);
const coverFile = ref<File | null>(null);
const coverFileList = ref<UploadFile[]>([]);

const form = reactive<WorksetCreateForm>({
  name: "",
  description: "",
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

watch(
  () => ({ isOpen: props.open, teamId: props.teamId }),
  async ({ isOpen, teamId }) => {
    if (!isOpen) {
      return;
    }

    resetForm();

    if (!teamId) {
      teamMembers.value = [];
      return;
    }

    try {
      teamMembers.value = await getMemberList({
        team_id: teamId,
        offset: 0,
        limit: 100,
        includes: ["user"],
      });
    } catch (error: unknown) {
      teamMembers.value = [];
      message.error(
        error instanceof Error ? error.message : "加载团队成员失败",
      );
    }
  },
);

function getMembersByRole(roleKey: RoleKey): MemberInfo[] {
  return teamMembers.value.filter((member) => Boolean(member[roleKey]));
}

function resetForm(): void {
  form.name = "";
  form.description = "";
  form.translator_user_id = undefined;
  form.proofreader_user_id = undefined;
  form.typesetter_user_id = undefined;
  form.reviewer_user_id = undefined;
  coverFile.value = null;
  coverFileList.value = [];
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
  coverFile.value = null;
  coverFileList.value = [];
  return true;
}

async function uploadCoverIfNeeded(worksetID: string): Promise<void> {
  if (!coverFile.value) {
    return;
  }

  const extension = resolveImageFileExtension(coverFile.value);
  const contentType = coverFile.value.type.trim() || `image/${extension}`;
  const reserveResult = await reserveWorksetCover(worksetID, {
    extension,
    content_type: contentType,
  });

  await uploadFileToPresignedPutUrl(
    reserveResult.put_url,
    coverFile.value,
    contentType,
  );
  await confirmWorksetCoverUploaded(worksetID);
}

async function handleSubmit() {
  if (!props.teamId) {
    message.error("请先选择一个确定的团队");
    return;
  }

  if (!form.name.trim()) {
    message.warning("请输入工作集名称");
    return;
  }

  submitting.value = true;

  try {
    const createdWorkset = await createWorkset({
      team_id: props.teamId,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      translator_user_id: form.translator_user_id,
      proofreader_user_id: form.proofreader_user_id,
      typesetter_user_id: form.typesetter_user_id,
      reviewer_user_id: form.reviewer_user_id,
    });

    try {
      await uploadCoverIfNeeded(createdWorkset.id);
      message.success("漫画项目创建成功！");
    } catch (error: unknown) {
      message.warning(
        error instanceof Error
          ? `漫画项目已创建，但封面上传失败：${error.message}`
          : "漫画项目已创建，但封面上传失败",
      );
    }

    emit("update:open", false);
    emit("created");
  } catch (error: unknown) {
    message.error(error instanceof Error ? error.message : "创建漫画项目失败");
  } finally {
    submitting.value = false;
  }
}

function handleCancel() {
  emit("update:open", false);
}
</script>
