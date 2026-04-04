<template>
  <div v-if="workset" class="workset-detail-view">
    <a-page-header
      class="workset-header"
      :title="workset.name || '加载工作集...'"
      :sub-title="`在 ${currentTeam?.name} 团队下的独立漫画项目`"
      :backIcon="h(ArrowLeftOutlined)"
      @back="router.back()"
    >
      <template #extra>
        <a-button
          type="primary"
          :disabled="!canCreateChapter"
          @click="showChapterModal = true"
        >
          <template #icon><PlusOutlined /></template>
          添加新话次/章节
        </a-button>
      </template>

      <a-descriptions size="small" :column="3">
        <a-descriptions-item label="默认翻译">{{
          workset.translator_user_id
            ? getMemberName(workset.translator_user_id)
            : "无指派"
        }}</a-descriptions-item>
        <a-descriptions-item label="默认嵌字">{{
          workset.typesetter_user_id
            ? getMemberName(workset.typesetter_user_id)
            : "无指派"
        }}</a-descriptions-item>
        <a-descriptions-item label="默认校对">{{
          workset.proofreader_user_id
            ? getMemberName(workset.proofreader_user_id)
            : "无指派"
        }}</a-descriptions-item>
        <a-descriptions-item label="默认审稿">{{
          workset.reviewer_user_id
            ? getMemberName(workset.reviewer_user_id)
            : "无指派"
        }}</a-descriptions-item>
        <a-descriptions-item label="章节数"
          >共 {{ chapters.length }} 话</a-descriptions-item
        >
        <a-descriptions-item label="简述简介">
          <span class="desc-text">{{
            workset.description || "无介绍信息"
          }}</span>
        </a-descriptions-item>
      </a-descriptions>
    </a-page-header>

    <div class="detail-content">
      <a-list
        item-layout="vertical"
        size="large"
        :data-source="chapters"
        :loading="loadingChapters"
      >
        <template #renderItem="{ item }">
          <a-list-item key="item.title" class="chapter-card">
            <a-list-item-meta
              :description="'发布于 ' + (item.created_at || '刚刚')"
            >
              <template #title>
                <div class="chapter-title-row">
                  <a :href="item.href" class="chapter-title"
                    >第{{ item.index || "?" }}话 - {{ item.title }}</a
                  >

                  <div class="roles-status-row">
                    <RoleStatusItem
                      roleName="翻译"
                      :roleId="item.translator_id"
                      :worksetRoleId="workset.translator_user_id"
                      :chapter="item"
                    />
                    <RoleStatusItem
                      roleName="嵌字"
                      :roleId="item.typesetter_id"
                      :worksetRoleId="workset.typesetter_user_id"
                      :chapter="item"
                    />
                    <RoleStatusItem
                      roleName="校对"
                      :roleId="item.proofreader_id"
                      :worksetRoleId="workset.proofreader_user_id"
                      :chapter="item"
                    />
                    <RoleStatusItem
                      roleName="审稿"
                      :roleId="item.reviewer_id"
                      :worksetRoleId="workset.reviewer_user_id"
                      :chapter="item"
                    />
                  </div>
                </div>
              </template>
              <template #avatar
                ><a-avatar
                  shape="square"
                  size="large"
                  :src="item.avatar"
                  icon="🖼"
                  style="
                    backgroundcolor: var(--color-surface-variant);
                    color: var(--color-on-surface);
                  "
              /></template>
            </a-list-item-meta>
            {{ item.content }}

            <template #extra>
              <a-progress
                type="circle"
                :percent="item.progress || 0"
                :width="60"
              />
            </template>
          </a-list-item>
        </template>
      </a-list>
    </div>

    <!-- 弹窗 -->
    <ChapterCreateModal
      v-model:open="showChapterModal"
      :worksetId="route.params.id as string"
      :worksetName="workset.name"
      @created="loadChapters"
    />
  </div>
  <div v-else style="padding: 40px; text-align: center">
    <a-spin size="large" tip="正在加载工作集配置与章节进度..." />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, h } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PlusOutlined, ArrowLeftOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import ChapterCreateModal from "./ChapterCreateModal.vue";
import RoleStatusItem from "./RoleStatusItem.vue"; // 我们稍后独立出一个小组件专门渲染悬浮态

const route = useRoute();
const router = useRouter();

// 存储
const workset = ref<any>(null);
const chapters = ref<any[]>([]);
const members = ref<any[]>([]);
const currentTeam = ref<any>(null);

const loadingChapters = ref(false);
const showChapterModal = ref(false);

const canCreateChapter = computed(() => {
  return Boolean(route.query.teamId);
});

onMounted(() => {
  loadWorksetDetail();
  loadChapters();
  // 也可以顺便加载成员列表来把 User ID 翻译成名子
  loadTeamMembers();
});

async function loadTeamMembers() {
  // getMemberList(authStore.currentTeamId)
  members.value = [];
}

function getMemberName(id: string) {
  const m = members.value.find((u) => u.id === id);
  return m ? m.username : "系统成员(未知)";
}

async function loadWorksetDetail() {
  try {
    // 假设 api 就是找个单一 workset 描述, 或通过过滤
    const id = route.params.id;
    // const res = await getWorksetList({ team_id: currentTeam, ... })
    // workset.value = res.items.find(w => w.id === id);

    // 模拟数据
    workset.value = {
      id,
      name: `测试工作集 ID: ${id}`,
      description:
        "这是一个为了补齐章节悬浮指派而存在的工作视图，点开可以看到章节进度。",
      translator_user_id: "user-22",
      typesetter_user_id: null,
      proofreader_user_id: "user-33",
      reviewer_user_id: null,
    };
    currentTeam.value = { name: "测试翻译组" };
  } catch {
    message.error("无法加载该工作集详情");
  }
}

async function loadChapters() {
  loadingChapters.value = true;
  try {
    // const res = await getChapter({ workset_id: ... });

    // Mock
    setTimeout(() => {
      chapters.value = [
        {
          id: 101,
          title: "初见相逢",
          index: 1,
          translator_id: "user-22",
          typesetter_id: null,
          proofreader_id: "user-33",
          reviewer_id: "user-99",
          progress: 100,
          created_at: "2026-03-01 10:00",
        },
        {
          id: 102,
          title: "深夜逃亡与新的契约",
          index: 2,
          translator_id: "user-22",
          typesetter_id: null,
          proofreader_id: null,
          reviewer_id: null,
          progress: 35,
          created_at: "2026-03-05 18:22",
        },
        {
          id: 103,
          title: "未命名草稿",
          index: 3,
          translator_id: null,
          typesetter_id: null,
          proofreader_id: null,
          reviewer_id: null,
          progress: 0,
          created_at: "刚刚",
        },
      ];
      loadingChapters.value = false;
    }, 600);
  } catch {
    loadingChapters.value = false;
  }
}
</script>

<style scoped lang="scss">
.workset-detail-view {
  background: var(--color-surface);
  border-radius: 8px;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;

  .workset-header {
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-surface-dim);
    margin-bottom: 20px;
    padding-bottom: 16px;
    padding-top: 16px;

    .desc-text {
      color: var(--color-on-surface-variant);
      max-width: 400px;
      display: inline-block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .detail-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 24px 24px;
    background: var(--color-surface-container-low);

    .chapter-card {
      background: var(--color-surface);
      margin-bottom: 16px;
      padding: 16px 24px;
      border-radius: 12px;
      border: 1px solid var(--color-outline-variant);

      .chapter-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .chapter-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-on-surface);
        }

        .roles-status-row {
          display: flex;
          gap: 12px;
        }
      }
    }
  }
}
</style>
