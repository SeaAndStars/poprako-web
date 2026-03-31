<template>
  <a-card class="local-project-card" :bordered="false">
    <template #title>
      <div class="local-project-card__title-row">
        <div class="local-project-card__title-block">
          <span class="local-project-card__title">{{ project.title }}</span>
          <span class="local-project-card__author">{{ project.author }}</span>
        </div>

        <a-tag v-if="active" color="processing">上次打开</a-tag>
      </div>
    </template>

    <div class="local-project-card__body">
      <p class="local-project-card__source" :title="project.source_label || ''">
        {{ project.source_label || "未记录来源目录" }}
      </p>

      <div class="local-project-card__metrics">
        <div class="local-project-card__metric-item">
          <span class="local-project-card__metric-value">{{ project.page_count }}</span>
          <span class="local-project-card__metric-label">页数</span>
        </div>
        <div class="local-project-card__metric-item">
          <span class="local-project-card__metric-value">{{ project.unit_count }}</span>
          <span class="local-project-card__metric-label">标记</span>
        </div>
        <div class="local-project-card__metric-item">
          <span class="local-project-card__metric-value">{{ project.translated_unit_count }}</span>
          <span class="local-project-card__metric-label">已翻译</span>
        </div>
        <div class="local-project-card__metric-item">
          <span class="local-project-card__metric-value">{{ project.proofread_unit_count }}</span>
          <span class="local-project-card__metric-label">已校对</span>
        </div>
      </div>

      <div class="local-project-card__progress-block">
        <div class="local-project-card__progress-row">
          <span>翻译进度</span>
          <span>{{ translatedProgressLabel }}</span>
        </div>
        <a-progress :percent="translatedProgressPercent" :show-info="false" />
      </div>

      <div class="local-project-card__progress-block">
        <div class="local-project-card__progress-row">
          <span>校对进度</span>
          <span>{{ proofreadProgressLabel }}</span>
        </div>
        <a-progress
          :percent="proofreadProgressPercent"
          status="active"
          :show-info="false"
        />
      </div>

      <div class="local-project-card__footer">
        <span class="local-project-card__timestamp">
          最近更新 {{ formattedUpdatedAt }}
        </span>

        <div class="local-project-card__actions">
          <a-button size="small" @click="emit('delete', project.id)">
            删除
          </a-button>
          <a-button type="primary" size="small" @click="emit('open', project.id)">
            进入翻译器
          </a-button>
        </div>
      </div>
    </div>
  </a-card>
</template>

<script setup lang="ts">
/**
 * 文件用途：渲染本地项目列表卡片。
 * 卡片集中展示项目统计和入口操作，供工作区列表复用。
 */
import { computed } from "vue";
import type { LocalProjectRecord } from "../../local-project/types";

const props = defineProps<{
  project: LocalProjectRecord;
  active?: boolean;
}>();

const emit = defineEmits<{
  (event: "open", projectID: string): void;
  (event: "delete", projectID: string): void;
}>();

/**
 * 计算百分比时统一兜底，避免除零。
 */
function resolveProgressPercent(completedCount: number, totalCount: number): number {
  if (totalCount <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((completedCount / totalCount) * 100));
}

const translatedProgressPercent = computed(() => {
  return resolveProgressPercent(
    props.project.translated_unit_count,
    props.project.unit_count,
  );
});

const proofreadProgressPercent = computed(() => {
  return resolveProgressPercent(
    props.project.proofread_unit_count,
    props.project.unit_count,
  );
});

const translatedProgressLabel = computed(() => {
  return `${props.project.translated_unit_count}/${props.project.unit_count}`;
});

const proofreadProgressLabel = computed(() => {
  return `${props.project.proofread_unit_count}/${props.project.unit_count}`;
});

const formattedUpdatedAt = computed(() => {
  const date = new Date(props.project.updated_at);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("zh-CN", { hour12: false });
});
</script>

<style scoped lang="scss">
.local-project-card {
  height: 100%;
  border-radius: 18px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  backdrop-filter: blur(16px) saturate(120%);
}

.local-project-card__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.local-project-card__title-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.local-project-card__title {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
}

.local-project-card__author {
  color: var(--text-muted);
  font-size: 13px;
}

.local-project-card__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.local-project-card__source {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}

.local-project-card__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.local-project-card__metric-item {
  min-width: 0;
  border-radius: 12px;
  padding: 10px 8px;
  background: color-mix(in srgb, var(--surface) 74%, transparent);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.local-project-card__metric-value {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
}

.local-project-card__metric-label {
  color: var(--text-muted);
  font-size: 11px;
}

.local-project-card__progress-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.local-project-card__progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-muted);
  font-size: 12px;
}

.local-project-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
}

.local-project-card__timestamp {
  color: var(--text-muted);
  font-size: 12px;
}

.local-project-card__actions {
  display: flex;
  gap: 8px;
}

:global(.local-project-card .ant-card-head) {
  border-bottom: 1px solid var(--table-border-color);
}

:global(.local-project-card .ant-progress-bg) {
  background: linear-gradient(
    90deg,
    var(--control-btn-primary-bg),
    var(--control-btn-primary-bg-hover)
  );
}

@media (max-width: 1200px) {
  .local-project-card__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .local-project-card__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .local-project-card__actions {
    justify-content: flex-end;
  }
}
</style>