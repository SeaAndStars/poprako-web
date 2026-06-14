/**
 * 文件用途：工作集详情页岗位常量、工作流标签与纯展示工具函数。
 */

import type {
  UserInfo,
  WorksetBoardChapterInfo,
  WorksetBoardRoleSlotInfo,
} from "../types/domain";

/** 翻译岗位位掩码。 */
export const ROLE_TRANSLATOR = 2;
/** 校对岗位位掩码。 */
export const ROLE_PROOFREADER = 4;
/** 嵌字岗位位掩码。 */
export const ROLE_TYPESETTER = 8;
/** 审稿岗位位掩码。 */
export const ROLE_REVIEWER = 16;

/** 章节工作流阶段中文标签。 */
export const WORKFLOW_STAGE_LABELS: Record<string, string> = {
  created: "待上传",
  uploaded: "已上传",
  translating: "翻译中",
  translated: "已翻译",
  proofreading: "校对中",
  proofread: "已校对",
  typesetting: "嵌字中",
  typeset: "已嵌字",
  reviewed: "已审稿",
  published: "已发布",
};

/** 章节工作流阶段 Ant Design Tag 颜色。 */
export const WORKFLOW_STAGE_COLORS: Record<string, string> = {
  created: "default",
  uploaded: "blue",
  translating: "cyan",
  translated: "geekblue",
  proofreading: "purple",
  proofread: "magenta",
  typesetting: "orange",
  typeset: "gold",
  reviewed: "lime",
  published: "green",
};

/** 岗位申请审批抽屉入参。 */
export interface RoleReviewPayload {
  /** 目标章节。 */
  chapter: WorksetBoardChapterInfo;
}

/** 在线工作区入口模式。 */
export type RoleWorkspaceMode = "translate" | "proofread";

/**
 * 将章节序号格式化为展示用话数（从 1 起算）。
 */
export function displaySequence(index: number | undefined): string {
  if (typeof index !== "number") {
    return "?";
  }

  return String(index + 1);
}

/**
 * 将时间戳格式化为本地化日期时间字符串。
 */
export function formatTimestamp(rawTime: number | undefined): string {
  if (!rawTime) {
    return "-";
  }

  const normalizedTime = rawTime > 1_000_000_000_000 ? rawTime : rawTime * 1000;
  const date = new Date(normalizedTime);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("zh-CN", { hour12: false });
}

/**
 * 解析用户展示名称，缺省时回退到用户 ID 或占位文案。
 */
export function resolveUserDisplayName(
  user?: UserInfo,
  fallbackId?: string,
): string {
  return user?.name || fallbackId || "无指派";
}

/**
 * 解析章节工作流阶段中文标签。
 */
export function resolveWorkflowStageLabel(stage: string): string {
  return WORKFLOW_STAGE_LABELS[stage] || "处理中";
}

/**
 * 解析章节工作流阶段 Tag 颜色。
 */
export function resolveWorkflowTagColor(stage: string): string {
  return WORKFLOW_STAGE_COLORS[stage] || "default";
}

/**
 * 根据岗位位掩码解析中文岗位名称。
 */
export function resolveRoleLabel(roleValue: number): string {
  switch (roleValue) {
    case ROLE_TRANSLATOR:
      return "翻译";
    case ROLE_PROOFREADER:
      return "校对";
    case ROLE_TYPESETTER:
      return "嵌字";
    case ROLE_REVIEWER:
      return "审稿";
    default:
      return `岗位 ${roleValue}`;
  }
}

/**
 * 解析岗位槽位上的全部占用人（兼容单人与多人槽位）。
 */
export function resolveRoleSlotOccupants(
  roleSlot: WorksetBoardRoleSlotInfo | undefined,
): UserInfo[] {
  const occupants = Array.isArray(roleSlot?.occupants)
    ? roleSlot.occupants.filter((userInfo): userInfo is UserInfo =>
        Boolean(userInfo?.id),
      )
    : [];

  if (occupants.length > 0) {
    return occupants;
  }

  return roleSlot?.occupant?.id ? [roleSlot.occupant] : [];
}

/**
 * 判断岗位槽位是否已有占用人。
 */
export function hasRoleSlotOccupant(
  roleSlot: WorksetBoardRoleSlotInfo | undefined,
): boolean {
  return resolveRoleSlotOccupants(roleSlot).length > 0;
}

/**
 * 判断岗位是否允许多人同时占位。
 */
export function roleAllowsMultipleOccupants(roleValue: number): boolean {
  return roleValue === ROLE_TRANSLATOR || roleValue === ROLE_TYPESETTER;
}
