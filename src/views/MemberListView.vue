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
import MemberManagementHero from "./member-management/MemberManagementHero.vue";
import MemberManagementMembersCard from "./member-management/MemberManagementMembersCard.vue";
import MemberManagementModals from "./member-management/MemberManagementModals.vue";
import {
  provideMemberManagement,
  useMemberManagement,
} from "./member-management/useMemberManagement";

const memberManagement = useMemberManagement();

provideMemberManagement(memberManagement);
</script>

<style lang="scss" src="./member-management/memberManagement.scss"></style>
