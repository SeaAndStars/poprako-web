<template>
  <div class="workset-detail-view">
    <div v-if="loadingBoard && !board" class="workset-detail-view__loading">
      <a-spin size="large" tip="正在加载工作集配置与章节进度..." />
    </div>

    <template v-else-if="board">
      <section class="workset-hero">
        <a-page-header
          class="workset-header"
          :title="board.workset.name || '工作集详情'"
          :sub-title="headerSubtitle"
          :back-icon="h(ArrowLeftOutlined)"
          @back="handleBack"
        >
          <template #avatar>
            <a-avatar
              shape="square"
              :size="72"
              :src="worksetCoverUrl"
              class="workset-cover"
            >
              {{ board.workset.name.slice(0, 1) }}
            </a-avatar>
          </template>

          <template #extra>
            <div class="workset-toolbar">
              <a-select
                v-if="comicOptions.length > 1"
                class="comic-switcher"
                :value="selectedComic?.id"
                :options="comicOptions"
                @change="handleComicChange"
              />

              <a-button @click="showWorksetEditModal = true">
                <template #icon><EditOutlined /></template>
                编辑项目
              </a-button>

              <a-button :loading="loadingBoard" @click="refreshBoard">
                刷新看板
              </a-button>

              <a-button
                type="primary"
                :disabled="!canCreateChapter"
                @click="showChapterModal = true"
              >
                <template #icon><PlusOutlined /></template>
                添加新话次/章节
              </a-button>
            </div>
          </template>

          <a-descriptions size="small" :column="3">
            <a-descriptions-item label="默认翻译">
              {{ resolveUserDisplayName(board.workset.translator) }}
            </a-descriptions-item>
            <a-descriptions-item label="默认嵌字">
              {{ resolveUserDisplayName(board.workset.typesetter) }}
            </a-descriptions-item>
            <a-descriptions-item label="默认校对">
              {{ resolveUserDisplayName(board.workset.proofreader) }}
            </a-descriptions-item>
            <a-descriptions-item label="默认审稿">
              {{ resolveUserDisplayName(board.workset.reviewer) }}
            </a-descriptions-item>
            <a-descriptions-item label="项目章节数">
              {{ selectedComic?.chapter_count ?? 0 }} 话
            </a-descriptions-item>
            <a-descriptions-item label="作者">
              {{ selectedComic?.author || "未填写" }}
            </a-descriptions-item>
            <a-descriptions-item label="所属团队">
              {{ board.workset.team?.name || board.workset.team_id }}
            </a-descriptions-item>
            <a-descriptions-item label="最近活跃">
              {{ formatTimestamp(selectedComic?.last_active_at) }}
            </a-descriptions-item>
            <a-descriptions-item label="项目简介">
              <span class="desc-text">
                {{ board.workset.description || "无介绍信息" }}
              </span>
            </a-descriptions-item>
          </a-descriptions>
        </a-page-header>

        <div class="workset-summary-grid">
          <article
            v-for="card in summaryCards"
            :key="card.key"
            class="workset-summary-card"
            :class="`is-${card.tone}`"
          >
            <div class="workset-summary-card__label">{{ card.label }}</div>
            <div class="workset-summary-card__value">{{ card.value }}</div>
            <div class="workset-summary-card__hint">{{ card.hint }}</div>
          </article>
        </div>
      </section>

      <a-spin :spinning="loadingBoard" tip="正在刷新章节看板...">
        <div class="detail-content">
          <a-empty v-if="!selectedComic" class="workset-empty-state">
            <template #description>
              当前项目尚未完成初始化，暂时无法创建章节
            </template>
            <div class="workset-empty-state__actions">
              <a-button @click="handleBack">返回上一页</a-button>
            </div>
          </a-empty>
          <template v-else-if="selectedComic">
            <section class="comic-focus-panel">
              <div>
                <div class="comic-focus-panel__eyebrow">
                  当前项目 {{ displaySequence(selectedComic.index) }}
                </div>
                <h2 class="comic-focus-panel__title">
                  {{ currentProjectTitle }}
                </h2>
                <div class="comic-focus-panel__meta">
                  <a-tag>{{ selectedComic.chapter_count }} 话</a-tag>
                  <a-tag v-if="selectedComic.author">
                    作者 {{ selectedComic.author }}
                  </a-tag>
                  <a-tag>
                    最近活跃 {{ formatTimestamp(selectedComic.last_active_at) }}
                  </a-tag>
                </div>
                <p class="comic-focus-panel__description">
                  {{ currentProjectDescription }}
                </p>
              </div>

              <div class="comic-focus-panel__stat-grid">
                <article
                  v-for="stat in selectedComicStats"
                  :key="stat.key"
                  class="comic-focus-panel__stat"
                >
                  <div class="comic-focus-panel__stat-label">
                    {{ stat.label }}
                  </div>
                  <div class="comic-focus-panel__stat-value">
                    {{ stat.value }}
                  </div>
                  <div class="comic-focus-panel__stat-hint">
                    {{ stat.hint }}
                  </div>
                </article>
              </div>
            </section>

            <a-empty
              v-if="board.chapters.length === 0"
              class="workset-empty-state"
            >
              <template #description>
                当前项目还没有章节，先创建第一话吧
              </template>
              <div class="workset-empty-state__actions">
                <a-button type="primary" @click="showChapterModal = true">
                  <template #icon><PlusOutlined /></template>
                  创建第一话
                </a-button>
              </div>
            </a-empty>

            <div v-else class="chapter-list">
              <article
                v-for="chapter in board.chapters"
                :key="chapter.id"
                class="chapter-card"
              >
                <div class="chapter-card__main">
                  <div class="chapter-card__header">
                    <div class="chapter-card__title-block">
                      <div class="chapter-card__title-row">
                        <div>
                          <h3 class="chapter-card__title">
                            第{{ displaySequence(chapter.index) }}话
                            <span class="chapter-card__subtitle">
                              {{ chapter.subtitle || "未命名章节" }}
                            </span>
                          </h3>
                          <div
                            v-if="chapter.can_review_role_requests"
                            class="chapter-card__title-actions"
                          >
                            <a-button
                              size="small"
                              @click="openChapterNumberEditor(chapter)"
                            >
                              编辑话数
                            </a-button>
                          </div>
                        </div>

                        <div class="chapter-card__tags">
                          <a-tag
                            :color="
                              resolveWorkflowTagColor(chapter.workflow_stage)
                            "
                          >
                            {{
                              resolveWorkflowStageLabel(chapter.workflow_stage)
                            }}
                          </a-tag>
                          <a-tag
                            v-if="chapter.pending_request_count > 0"
                            color="red"
                          >
                            待审批 {{ chapter.pending_request_count }}
                          </a-tag>
                        </div>
                      </div>

                      <div class="chapter-card__meta">
                        <span>
                          创建者
                          {{
                            resolveUserDisplayName(
                              chapter.creator,
                              chapter.creator_id,
                            )
                          }}
                        </span>
                        <span>{{ formatTimestamp(chapter.created_at) }}</span>
                      </div>

                      <div class="chapter-card__stats">
                        <article class="chapter-card__stat is-pages">
                          <div class="chapter-card__stat-label">页数</div>
                          <div class="chapter-card__stat-value">
                            {{ chapter.page_count }}
                          </div>
                        </article>
                        <article class="chapter-card__stat is-units">
                          <div class="chapter-card__stat-label">单元</div>
                          <div class="chapter-card__stat-value">
                            {{ chapter.total_unit_count }}
                          </div>
                        </article>
                        <article class="chapter-card__stat is-translated">
                          <div class="chapter-card__stat-label">已翻</div>
                          <div class="chapter-card__stat-value">
                            {{ chapter.translated_unit_count }}
                          </div>
                        </article>
                        <article class="chapter-card__stat is-proofread">
                          <div class="chapter-card__stat-label">已校</div>
                          <div class="chapter-card__stat-value">
                            {{ chapter.proofread_unit_count }}
                          </div>
                        </article>
                      </div>
                    </div>

                    <div class="chapter-card__progress-block">
                      <a-progress
                        type="circle"
                        :percent="chapter.progress_percent"
                        :width="76"
                      />
                    </div>
                  </div>

                  <div class="chapter-card__roles">
                    <RoleStatusItem
                      :role-slot="chapter.translator"
                      role-label="翻译"
                      :role-value="ROLE_TRANSLATOR"
                      :chapter="chapter"
                      :default-user="board.workset.translator"
                      :current-member-role-mask="currentMemberRoleMask"
                      :applied-team-id="board.workset.team_id"
                      :can-review="chapter.can_review_role_requests"
                      @changed="handleRoleChanged"
                    />
                    <RoleStatusItem
                      :role-slot="chapter.typesetter"
                      role-label="嵌字"
                      :role-value="ROLE_TYPESETTER"
                      :chapter="chapter"
                      :default-user="board.workset.typesetter"
                      :current-member-role-mask="currentMemberRoleMask"
                      :applied-team-id="board.workset.team_id"
                      :can-review="chapter.can_review_role_requests"
                      @changed="handleRoleChanged"
                    />
                    <RoleStatusItem
                      :role-slot="chapter.proofreader"
                      role-label="校对"
                      :role-value="ROLE_PROOFREADER"
                      :chapter="chapter"
                      :default-user="board.workset.proofreader"
                      :current-member-role-mask="currentMemberRoleMask"
                      :applied-team-id="board.workset.team_id"
                      :can-review="chapter.can_review_role_requests"
                      @changed="handleRoleChanged"
                    />
                    <RoleStatusItem
                      :role-slot="chapter.reviewer"
                      role-label="审稿"
                      :role-value="ROLE_REVIEWER"
                      :chapter="chapter"
                      :default-user="board.workset.reviewer"
                      :current-member-role-mask="currentMemberRoleMask"
                      :applied-team-id="board.workset.team_id"
                      :can-review="chapter.can_review_role_requests"
                      @changed="handleRoleChanged"
                    />
                  </div>

                  <div class="chapter-card__footer">
                    <div
                      v-if="
                        chapter.can_review_role_requests ||
                        canBatchApplyRoles(chapter)
                      "
                      class="chapter-card__footer-actions"
                    >
                      <a-button
                        v-if="chapter.can_review_role_requests"
                        size="small"
                        type="primary"
                        ghost
                        :disabled="chapter.pending_request_count === 0"
                        @click="handleRoleReview({ chapter })"
                      >
                        审批申请
                        <template v-if="chapter.pending_request_count > 0">
                          {{ chapter.pending_request_count }}
                        </template>
                      </a-button>
                      <a-button
                        v-if="canBatchApplyRoles(chapter)"
                        size="small"
                        :loading="batchApplyingChapterId === chapter.id"
                        @click="handleBatchApplyRoles(chapter)"
                      >
                        {{ resolveBatchApplyLabel(chapter) }}
                      </a-button>
                    </div>
                    <div class="chapter-card__progress-line">
                      <a-progress
                        :percent="chapter.progress_percent"
                        size="small"
                      />
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </template>
        </div>
      </a-spin>

      <ChapterCreateModal
        v-model:open="showChapterModal"
        :comic-id="selectedComic?.id"
        :comic-title="currentProjectTitle"
        :chapter-count="selectedComic?.chapter_count"
        :next-chapter-number="nextChapterNumber"
        :used-chapter-numbers="usedChapterNumbers"
        @created="handleChapterCreated"
      />

      <WorksetEditModal
        v-model:open="showWorksetEditModal"
        :workset="board.workset"
        @updated="handleWorksetUpdated"
      />

      <a-drawer
        :open="reviewDrawerOpen"
        width="480"
        placement="right"
        title="岗位申请审批"
        @close="handleReviewDrawerClose"
      >
        <template v-if="currentReviewChapter">
          <div class="review-drawer__summary">
            <h3 class="review-drawer__title">
              第{{ displaySequence(currentReviewChapter.index) }}话
              {{ currentReviewChapter.subtitle || "未命名章节" }}
            </h3>
            <p class="review-drawer__description">
              当前章节共有 {{ reviewRequests.length }} 条待审批申请
            </p>
          </div>

          <a-spin :spinning="reviewRequestsLoading" tip="正在加载岗位申请...">
            <a-empty
              v-if="!reviewRequestsLoading && reviewRequests.length === 0"
              description="当前章节暂无待审批申请"
            />

            <div v-else class="review-request-list">
              <article
                v-for="requestInfo in reviewRequests"
                :key="requestInfo.id"
                class="review-request-card"
              >
                <div class="review-request-card__header">
                  <div class="review-request-card__identity">
                    <a-avatar :src="resolveUserAvatarUrl(requestInfo.user)">
                      {{ requestInfo.user?.name?.slice(0, 1) || "?" }}
                    </a-avatar>
                    <div>
                      <div class="review-request-card__name">
                        {{
                          resolveUserDisplayName(
                            requestInfo.user,
                            requestInfo.user_id,
                          )
                        }}
                      </div>
                      <div class="review-request-card__meta">
                        申请岗位：{{ resolveRoleLabel(requestInfo.role) }}
                      </div>
                    </div>
                  </div>

                  <div class="review-request-card__time">
                    {{ formatTimestamp(requestInfo.requested_at) }}
                  </div>
                </div>

                <div class="review-request-card__body">
                  协作组：{{
                    requestInfo.applied_team_id || board.workset.team_id
                  }}
                </div>

                <div class="review-request-card__actions">
                  <a-button
                    danger
                    :loading="reviewSubmittingId === requestInfo.id"
                    @click="handleRoleRequestReview(requestInfo.id, 'rejected')"
                  >
                    拒绝
                  </a-button>
                  <a-button
                    type="primary"
                    :loading="reviewSubmittingId === requestInfo.id"
                    @click="handleRoleRequestReview(requestInfo.id, 'approved')"
                  >
                    通过
                  </a-button>
                </div>
              </article>
            </div>
          </a-spin>
        </template>
      </a-drawer>

      <a-modal
        :open="Boolean(currentEditableChapter)"
        title="编辑章节话数"
        ok-text="保存"
        cancel-text="取消"
        :confirm-loading="updatingChapterNumber"
        @ok="submitChapterNumberUpdate"
        @cancel="closeChapterNumberEditor"
      >
        <a-form layout="vertical">
          <a-form-item label="当前章节">
            <a-input
              :value="
                currentEditableChapter
                  ? `第${displaySequence(currentEditableChapter.index)}话 ${currentEditableChapter.subtitle || ''}`.trim()
                  : ''
              "
              disabled
            />
          </a-form-item>
          <a-form-item label="新的话数">
            <a-input-number
              v-model:value="editingChapterNumber"
              :min="1"
              :precision="0"
              style="width: 100%"
            />
          </a-form-item>
        </a-form>
      </a-modal>
    </template>

    <div v-else class="workset-detail-view__error">
      <a-empty description="无法加载该工作集详情" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { h } from "vue";
import {
  ArrowLeftOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons-vue";

import ChapterCreateModal from "./ChapterCreateModal.vue";
import RoleStatusItem from "./RoleStatusItem.vue";
import WorksetEditModal from "./WorksetEditModal.vue";
import { useWorksetDetailView } from "./useWorksetDetailView";

const {
  batchApplyingChapterId,
  board,
  canCreateChapter,
  canBatchApplyRoles,
  closeChapterNumberEditor,
  comicOptions,
  currentEditableChapter,
  currentProjectDescription,
  currentMemberRoleMask,
  currentProjectTitle,
  currentReviewChapter,
  displaySequence,
  editingChapterNumber,
  formatTimestamp,
  handleBack,
  handleBatchApplyRoles,
  handleChapterCreated,
  handleComicChange,
  openChapterNumberEditor,
  handleReviewDrawerClose,
  handleWorksetUpdated,
  handleRoleChanged,
  handleRoleRequestReview,
  handleRoleReview,
  headerSubtitle,
  loadingBoard,
  nextChapterNumber,
  refreshBoard,
  resolveBatchApplyLabel,
  resolveRoleLabel,
  resolveUserAvatarUrl,
  resolveUserDisplayName,
  resolveWorkflowStageLabel,
  resolveWorkflowTagColor,
  reviewRequests,
  reviewDrawerOpen,
  reviewRequestsLoading,
  reviewSubmittingId,
  ROLE_PROOFREADER,
  ROLE_REVIEWER,
  ROLE_TRANSLATOR,
  ROLE_TYPESETTER,
  selectedComic,
  selectedComicStats,
  showChapterModal,
  showWorksetEditModal,
  submitChapterNumberUpdate,
  summaryCards,
  updatingChapterNumber,
  usedChapterNumbers,
  worksetCoverUrl,
} = useWorksetDetailView();
</script>

<style lang="scss" src="./worksetDetailView.scss"></style>
