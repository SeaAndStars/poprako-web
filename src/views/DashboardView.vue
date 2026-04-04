<template>
  <div class="workspace-layout">
    <header class="workspace-header">
      <div class="workspace-header__left">
        <span class="workspace-header__title">翻校工作区</span>
        <span class="workspace-header__subtitle">
          Local Project Workspace
        </span>
      </div>

      <a-space>
        <a-button
          v-if="activeProject"
          type="default"
          @click="handleOpenProject(activeProject.id)"
        >
          继续上次项目
        </a-button>
        <a-button type="primary" @click="createModalOpen = true">
          新建本地项目
        </a-button>
      </a-space>
    </header>

    <main class="workspace-content">
      <section class="workspace-toolbar">
        <a-input
          v-model:value="searchKeyword"
          class="workspace-toolbar__search"
          placeholder="搜索项目标题或作者"
          allow-clear
        />

        <span class="workspace-toolbar__hint">
          {{ filteredProjects.length }} / {{ projects.length }} 个项目
        </span>
      </section>

      <a-row :gutter="16" class="summary-row">
        <a-col
          v-for="summaryCard in summaryCards"
          :key="summaryCard.label"
          :xs="24"
          :md="12"
          :xl="6"
        >
          <a-card class="summary-card" :bordered="false">
            <a-statistic
              :title="summaryCard.label"
              :value="summaryCard.value"
            />
          </a-card>
        </a-col>
      </a-row>

      <section
        v-if="filteredProjects.length > 0"
        class="workspace-project-grid"
      >
        <div
          v-for="projectRecord in filteredProjects"
          :key="projectRecord.id"
          class="workspace-project-grid__item"
        >
          <LocalProjectCard
            :project="projectRecord"
            :active="activeProject?.id === projectRecord.id"
            @open="handleOpenProject"
            @delete="handleDeleteProject"
          />
        </div>
      </section>

      <div v-else class="workspace-empty-state">
        <a-empty description="当前还没有本地翻校项目">
          <a-button type="primary" @click="createModalOpen = true">
            立即新建项目
          </a-button>
        </a-empty>
      </div>
    </main>

    <LocalProjectCreateModal
      :open="createModalOpen"
      @cancel="createModalOpen = false"
      @created="handleProjectCreated"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 文件用途：作为本地翻校项目工作区首页。
 * 页面负责展示项目列表、搜索过滤和新建项目入口，是翻译器的外层工作台。
 */
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Modal, message } from "ant-design-vue";
import { storeToRefs } from "pinia";
import LocalProjectCard from "../components/local-project/LocalProjectCard.vue";
import LocalProjectCreateModal from "../components/local-project/LocalProjectCreateModal.vue";
import { useLocalProjectsStore } from "../stores/localProjects";

const router = useRouter();
const localProjectsStore = useLocalProjectsStore();
const { projects, activeProject } = storeToRefs(localProjectsStore);

const createModalOpen = ref(false);
const searchKeyword = ref("");

/**
 * 根据标题与作者筛选项目。
 */
const filteredProjects = computed(() => {
  const normalizedKeyword = searchKeyword.value.trim().toLowerCase();

  if (!normalizedKeyword) {
    return projects.value;
  }

  return projects.value.filter((projectRecord) => {
    return (
      projectRecord.title.toLowerCase().includes(normalizedKeyword) ||
      projectRecord.author.toLowerCase().includes(normalizedKeyword)
    );
  });
});

/**
 * 首页摘要卡片。
 */
const summaryCards = computed(() => {
  const pageCount = projects.value.reduce((totalCount, projectRecord) => {
    return totalCount + projectRecord.page_count;
  }, 0);

  const unitCount = projects.value.reduce((totalCount, projectRecord) => {
    return totalCount + projectRecord.unit_count;
  }, 0);

  const translatedCount = projects.value.reduce((totalCount, projectRecord) => {
    return totalCount + projectRecord.translated_unit_count;
  }, 0);

  const proofreadCount = projects.value.reduce((totalCount, projectRecord) => {
    return totalCount + projectRecord.proofread_unit_count;
  }, 0);

  return [
    {
      label: "项目总数",
      value: projects.value.length,
    },
    {
      label: "总页数",
      value: pageCount,
    },
    {
      label: "总标记数",
      value: unitCount,
    },
    {
      label: "已校对 / 已翻译",
      value: `${proofreadCount}/${translatedCount}`,
    },
  ];
});

/**
 * 进入翻译器。
 */
function handleOpenProject(projectID: string): void {
  localProjectsStore.setActiveProject(projectID);
  void router.push(`/translator/${projectID}`);
}

/**
 * 新建成功后直接进入翻译器。
 */
function handleProjectCreated(projectID: string): void {
  createModalOpen.value = false;
  handleOpenProject(projectID);
}

/**
 * 删除项目前进行确认。
 */
function handleDeleteProject(projectID: string): void {
  const targetProject = projects.value.find(
    (projectRecord) => projectRecord.id === projectID,
  );

  if (!targetProject) {
    return;
  }

  Modal.confirm({
    title: "删除本地项目",
    content: `确认删除“${targetProject.title}”吗？web 端导入的图片缓存也会被一并清理。`,
    okText: "确认删除",
    cancelText: "取消",
    async onOk() {
      await localProjectsStore.deleteProject(projectID);
      message.success("项目已删除");
    },
  });
}
</script>

<style scoped lang="scss">
.workspace-layout {
  height: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.workspace-header {
  min-height: 56px;
  background: var(--dashboard-header-bg);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--dashboard-header-border);
  padding: 0 20px;
}

.workspace-header__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.workspace-header__title {
  font-size: 18px;
  font-weight: 700;
}

.workspace-header__subtitle {
  color: var(--text-muted);
  font-size: 12px;
}

.workspace-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px;
}

.workspace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}

.workspace-toolbar__search {
  width: min(460px, 100%);
}

.workspace-toolbar__hint {
  color: var(--text-muted);
  font-size: 13px;
}

.summary-row {
  margin-bottom: 16px;
}

.summary-card {
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--panel-border);
  backdrop-filter: blur(14px) saturate(118%);
}

.workspace-project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.workspace-project-grid__item {
  min-width: 0;
}

.workspace-empty-state {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:global(.workspace-layout .ant-card-head) {
  border-bottom: 1px solid var(--table-border-color);
}

:global(.workspace-layout .ant-card-head-title) {
  color: var(--text-primary);
}

:global(.workspace-layout .ant-statistic-title) {
  color: var(--text-muted);
}

:global(.workspace-layout .ant-statistic-content) {
  color: var(--text-primary);
}

@media (max-width: 960px) {
  .workspace-header {
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 12px;
    padding-top: 10px;
    padding-bottom: 10px;
  }

  .workspace-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-toolbar__search {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .workspace-header__subtitle {
    display: none;
  }

  .workspace-project-grid {
    grid-template-columns: 1fr;
  }
}

:global(html[data-theme="dark"]) {
  .summary-card {
    background: var(--panel-bg);
    color: var(--text-primary);
  }

  .workspace-header__title {
    color: var(--text-primary);
  }
}
</style>
