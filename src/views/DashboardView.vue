<template>
  <div class="workspace-layout">
    <header class="workspace-header">
      <div class="workspace-header__left">
        <span class="workspace-header__title">翻校工作区</span>
        <span class="workspace-header__subtitle">
          Local Project &amp; Online Chapter Workspace
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
          placeholder="搜索本地项目、漫画标题或章节"
          allow-clear
        />

        <span class="workspace-toolbar__hint">
          {{ toolbarHint }}
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

      <section class="workspace-section">
        <div class="workspace-section__header">
          <div>
            <h2 class="workspace-section__title">在线参与章节</h2>
            <p class="workspace-section__description">
              你当前负责的翻译或校对章节会显示在这里，点击即可进入对应在线房间。
            </p>
          </div>
          <span class="workspace-section__count">
            {{ filteredOnlineParticipations.length }} /
            {{ onlineParticipations.length }} 话
          </span>
        </div>

        <a-spin :spinning="onlineAssignmentsLoading">
          <div
            v-if="filteredOnlineParticipations.length > 0"
            class="workspace-online-grid"
          >
            <a-card
              v-for="chapterEntry in filteredOnlineParticipations"
              :key="chapterEntry.chapterId"
              class="workspace-online-card"
              :bordered="false"
            >
              <div class="workspace-online-card__head">
                <div class="workspace-online-card__identity">
                  <span class="workspace-online-card__title">
                    {{ chapterEntry.comicTitle }}
                  </span>
                  <span class="workspace-online-card__chapter">
                    {{ chapterEntry.chapterLabel }}
                  </span>
                  <p
                    v-if="chapterEntry.chapterSubtitle"
                    class="workspace-online-card__subtitle"
                  >
                    {{ chapterEntry.chapterSubtitle }}
                  </p>
                  <p class="workspace-online-card__author">
                    {{ chapterEntry.comicAuthor || "作者未填写" }}
                  </p>
                </div>
                <span class="workspace-online-card__timestamp">
                  {{ formatParticipationTimestamp(chapterEntry.lastActiveAt) }}
                </span>
              </div>

              <div class="workspace-online-card__roles">
                <a-tag
                  v-for="role in chapterEntry.roles"
                  :key="role.mode"
                  :color="role.mode === 'translate' ? 'gold' : 'green'"
                >
                  {{ role.label }}
                </a-tag>
              </div>

              <div class="workspace-online-card__stats">
                <div class="workspace-online-card__stat">
                  <span class="workspace-online-card__stat-value">
                    {{ chapterEntry.pageCount }}
                  </span>
                  <span class="workspace-online-card__stat-label">页数</span>
                </div>
                <div class="workspace-online-card__stat">
                  <span class="workspace-online-card__stat-value">
                    {{ chapterEntry.totalUnitCount }}
                  </span>
                  <span class="workspace-online-card__stat-label">标记</span>
                </div>
                <div class="workspace-online-card__stat">
                  <span class="workspace-online-card__stat-value">
                    {{ chapterEntry.translatedUnitCount }}
                  </span>
                  <span class="workspace-online-card__stat-label">已翻</span>
                </div>
                <div class="workspace-online-card__stat">
                  <span class="workspace-online-card__stat-value">
                    {{ chapterEntry.proofreadUnitCount }}
                  </span>
                  <span class="workspace-online-card__stat-label">已校</span>
                </div>
              </div>

              <div class="workspace-online-card__progress-grid">
                <div class="workspace-online-card__progress-block is-translate">
                  <div class="workspace-online-card__progress-head">
                    <span>翻译进度</span>
                    <strong
                      >{{ chapterEntry.translatedProgressPercent }}%</strong
                    >
                  </div>
                  <a-progress
                    :percent="chapterEntry.translatedProgressPercent"
                    :show-info="false"
                    stroke-color="#d97706"
                  />
                  <div class="workspace-online-card__progress-foot">
                    <span>
                      {{ chapterEntry.translatedUnitCount }} /
                      {{ chapterEntry.totalUnitCount }}
                    </span>
                    <span
                      >待翻 {{ chapterEntry.pendingTranslateUnitCount }}</span
                    >
                  </div>
                </div>

                <div class="workspace-online-card__progress-block is-proofread">
                  <div class="workspace-online-card__progress-head">
                    <span>校对进度</span>
                    <strong
                      >{{ chapterEntry.proofreadProgressPercent }}%</strong
                    >
                  </div>
                  <a-progress
                    :percent="chapterEntry.proofreadProgressPercent"
                    :show-info="false"
                    stroke-color="#16a34a"
                  />
                  <div class="workspace-online-card__progress-foot">
                    <span>
                      {{ chapterEntry.proofreadUnitCount }} /
                      {{ chapterEntry.totalUnitCount }}
                    </span>
                    <span>
                      待校 {{ chapterEntry.pendingProofreadUnitCount }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="workspace-online-card__actions">
                <a-button
                  v-for="role in chapterEntry.roles"
                  :key="`${chapterEntry.chapterId}-${role.mode}`"
                  size="small"
                  :type="role.mode === 'translate' ? 'primary' : 'default'"
                  @click="handleOpenOnlineChapter(chapterEntry, role.mode)"
                >
                  进入{{ role.label }}
                </a-button>
              </div>
            </a-card>
          </div>

          <div v-else class="workspace-inline-empty">
            <a-empty :description="onlineParticipationEmptyText">
              <a-button
                v-if="onlineAssignmentsErrorMessage"
                @click="loadMyOnlineAssignments"
              >
                重新加载
              </a-button>
            </a-empty>
          </div>
        </a-spin>
      </section>

      <section class="workspace-section">
        <div class="workspace-section__header">
          <div>
            <h2 class="workspace-section__title">本地项目</h2>
            <p class="workspace-section__description">
              已缓存到当前浏览器的离线翻校项目会保留在这里。
            </p>
          </div>
          <span class="workspace-section__count">
            {{ filteredProjects.length }} / {{ projects.length }} 个项目
          </span>
        </div>

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
          <a-empty :description="localProjectEmptyText">
            <a-button type="primary" @click="createModalOpen = true">
              立即新建项目
            </a-button>
          </a-empty>
        </div>
      </section>
    </main>

    <LocalProjectCreateModal
      :open="createModalOpen"
      @cancel="createModalOpen = false"
      @created="handleProjectCreated"
    />
  </div>
</template>

<script setup lang="ts">
import LocalProjectCard from "../components/local-project/LocalProjectCard.vue";
import LocalProjectCreateModal from "../components/local-project/LocalProjectCreateModal.vue";
import { useDashboardView } from "./useDashboardView";

const {
  activeProject,
  createModalOpen,
  filteredOnlineParticipations,
  filteredProjects,
  formatParticipationTimestamp,
  handleDeleteProject,
  handleOpenOnlineChapter,
  handleOpenProject,
  handleProjectCreated,
  loadMyOnlineAssignments,
  localProjectEmptyText,
  onlineAssignmentsErrorMessage,
  onlineAssignmentsLoading,
  onlineParticipationEmptyText,
  onlineParticipations,
  projects,
  searchKeyword,
  summaryCards,
  toolbarHint,
} = useDashboardView();
</script>
<style src="./dashboardView.scss" lang="scss"></style>
