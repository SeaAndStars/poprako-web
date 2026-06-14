<template>
  <div class="member-management-view">
    <MemberManagementHero />

    <main class="member-management-view__workspace">
      <MemberManagementMembersCard />
    </main>

    <MemberManagementModals />
  </div>
</template>

<script setup lang="ts">
/**
 * 文件用途：团队管理页。
 * 该页面统一管理邀请码、成员增删改以及当前账号通过邀请码加入其他团队的入口。
 */
import { onMounted } from "vue";
import { message } from "ant-design-vue";
import MemberManagementHero from "./member-management/MemberManagementHero.vue";
import MemberManagementMembersCard from "./member-management/MemberManagementMembersCard.vue";
import MemberManagementModals from "./member-management/MemberManagementModals.vue";
import { useMemberManagementStore } from "../stores/memberManagement";

const memberManagementStore = useMemberManagementStore();

onMounted(() => {
  void Promise.allSettled([
    memberManagementStore.refreshManagementData(false),
    memberManagementStore.ensureCurrentUserLoaded().catch((error) => {
      const errorMessage =
        error instanceof Error ? error.message : "当前用户信息加载失败";
      message.error(errorMessage);
    }),
  ]);
});
</script>

<style lang="scss" src="./member-management/memberManagement.scss"></style>
