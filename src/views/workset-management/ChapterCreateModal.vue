<template>
  <a-modal
    :open="open"
    width="520px"
    title="新建单话章节"
    ok-text="确认上传与创建"
    cancel-text="取消"
    :confirm-loading="submitting"
    @update:open="$emit('update:open', $event)"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form layout="vertical">
      <a-form-item label="所属漫画集">
        <!-- 仅展示只读的工作集名字 -->
        <a-input disabled :value="worksetName" />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="集数标题/编号" required>
            <a-input
              v-model:value="form.title"
              placeholder="如 第15.5话 终章前篇"
            />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item label="在工作集中的排序 (Index)" required>
            <a-input-number
              v-model:value="form.index"
              style="width: 100%"
              :min="1"
              placeholder="自动计算或手填"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="生肉图片上传 (必填)">
        <a-upload-dragger
          name="file"
          :multiple="true"
          :before-upload="beforeUpload"
          :fileList="fileList"
          action="javascript:void(0)"
          @remove="handleRemove"
        >
          <p class="ant-upload-drag-icon">
            <InboxOutlined style="color: var(--color-primary)" />
          </p>
          <p class="ant-upload-text">点击或将生肉原图拖拽到这里上传</p>
          <p class="ant-upload-hint">
            支持 jpg, png, webp 格式。上传完成前请保持窗口打开。
          </p>
        </a-upload-dragger>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from "vue";
import { message } from "ant-design-vue";
import { InboxOutlined } from "@ant-design/icons-vue";
// import { createChapter } from "../../api/modules"; (如果章节创建API已封装即可调用)

const props = defineProps<{
  open: boolean;
  worksetId: string;
  worksetName: string;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "created"): void;
}>();

const submitting = ref(false);
const fileList = ref<any[]>([]);

const form = reactive({
  title: "",
  index: 1,
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      form.title = "";
      form.index = 1; // 实际逻辑应获取当前章节总数 + 1
      fileList.value = [];
    }
  },
);

function beforeUpload(file: File) {
  fileList.value = [...fileList.value, file];
  return false; // 返回 false 阻止自动上传
}

function handleRemove(file: any) {
  const index = fileList.value.indexOf(file);
  const newFileList = fileList.value.slice();
  newFileList.splice(index, 1);
  fileList.value = newFileList;
}

async function handleSubmit() {
  if (!form.title.trim() || !form.index) {
    message.warning("请填写完整的单话标题和序号");
    return;
  }

  if (fileList.value.length === 0) {
    message.error("新建单话必须至少上传一张漫画原始图片。");
    return;
  }

  submitting.value = true;
  try {
    // 调用实际 API createChapter / upload files 等等...
    // 异步延时模拟
    await new Promise((resolve) => setTimeout(resolve, 800));

    message.success("工作集章节与底图创建成功！即将可被指派认领。");
    emit("update:open", false);
    emit("created");
  } catch (error: any) {
    message.error(error.message || "创建章节失败");
  } finally {
    submitting.value = false;
  }
}

function handleCancel() {
  emit("update:open", false);
}
</script>
