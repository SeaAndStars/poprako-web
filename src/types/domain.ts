/**
 * 文件用途：定义与 Swagger 领域对象对应的核心业务类型。
 */

import type { UnixTimestamp } from "./common";

/**
 * 用户信息，对应 swagger 的 value.UserInfo。
 */
export interface UserInfo {
  /** 用户唯一标识。 */
  id: string;
  /** 用户显示名（swagger 字段：name）。 */
  name: string;
  /** 用户绑定的 QQ 号码。 */
  qq: string;
  /** 用户头像 URL。 */
  avatar_url?: string;
  /** 头像是否已上传。 */
  is_avatar_uploaded?: boolean;
  /** 是否系统超级管理员。 */
  is_super_admin?: boolean;
  /** 创建时间。 */
  created_at?: UnixTimestamp;
  /** 更新时间。 */
  updated_at?: UnixTimestamp;

  /** 兼容旧前端字段：username。 */
  username?: string;
  /** 兼容旧前端字段：avatar。 */
  avatar?: string;
}

/**
 * 团队信息，对应 swagger 的 value.TeamInfo。
 */
export interface TeamInfo {
  /** 汉化组唯一标识。 */
  id: string;
  /** 汉化组名称。 */
  name: string;
  /** 汉化组头像 URL。 */
  avatar_url?: string;
  /** 头像是否已上传。 */
  is_avatar_uploaded?: boolean;
  /** 汉化组描述信息。 */
  description?: string;
  /** 汉化组创建时间。 */
  created_at?: UnixTimestamp;
  /** 汉化组更新时间。 */
  updated_at?: UnixTimestamp;

  /** 兼容旧前端字段：avatar。 */
  avatar?: string;
}

/**
 * 工作集信息，对应 swagger 的 value.WorksetInfo。
 */
export interface WorksetInfo {
  /** 工作集唯一标识。 */
  id: string;
  /** 所属汉化组 ID。 */
  team_id: string;
  /** 工作集名称。 */
  name: string;
  /** 工作集描述信息。 */
  description?: string;
  /** 工作集封面地址。 */
  cover_url?: string;
  /** 工作集封面是否已上传。 */
  is_cover_uploaded?: boolean;

  /** 默认岗位用户 ID。 */
  translator_user_id?: string;
  proofreader_user_id?: string;
  typesetter_user_id?: string;
  reviewer_user_id?: string;

  /** 工作集在团队内排序索引。 */
  index?: number;
  /** 该工作集包含漫画数量。 */
  comic_count?: number;
  /** 关联团队信息（includes 时可能返回）。 */
  team?: TeamInfo;
  /** 默认岗位用户信息（includes 时可能返回）。 */
  translator?: UserInfo;
  proofreader?: UserInfo;
  typesetter?: UserInfo;
  reviewer?: UserInfo;
  /** 创建时间。 */
  created_at?: UnixTimestamp;
  /** 更新时间。 */
  updated_at?: UnixTimestamp;
}

/**
 * 工作集详情页看板中的漫画切换选项。
 */
export interface WorksetBoardComicInfo {
  /** 漫画唯一标识。 */
  id: string;
  /** 在工作集中的排序索引。 */
  index: number;
  /** 漫画标题。 */
  title: string;
  /** 漫画作者。 */
  author: string;
  /** 漫画简介。 */
  description: string;
  /** 当前漫画的章节数。 */
  chapter_count: number;
  /** 最近活跃时间。 */
  last_active_at: UnixTimestamp;
}

/**
 * 工作集看板里的单个岗位槽位信息。
 */
export interface WorksetBoardRoleSlotInfo {
  /** 当前占位成员。 */
  occupant?: UserInfo;
  /** 占位时间。 */
  assigned_at?: UnixTimestamp;
  /** 当前岗位待审批申请数。 */
  pending_request_count: number;
  /** 当前登录用户自己的待审批申请 ID。 */
  my_pending_request_id?: string;
}

/**
 * 工作集看板里的章节行。
 */
export interface WorksetBoardChapterInfo {
  /** 章节唯一标识。 */
  id: string;
  /** 所属漫画 ID。 */
  comic_id: string;
  /** 章节序号。 */
  index: number;
  /** 章节副标题。 */
  subtitle: string;
  /** 页面总数。 */
  page_count: number;
  /** 总单元数。 */
  total_unit_count: number;
  /** 已翻译单元数。 */
  translated_unit_count: number;
  /** 已校对单元数。 */
  proofread_unit_count: number;
  /** 创建者用户 ID。 */
  creator_id: string;
  /** 创建者信息。 */
  creator?: UserInfo;
  /** 上传完成时间。 */
  uploaded_at?: UnixTimestamp;
  /** 开始翻译时间。 */
  transalating_at?: UnixTimestamp;
  /** 翻译完成时间。 */
  translated_at?: UnixTimestamp;
  /** 开始校对时间。 */
  proofreading_at?: UnixTimestamp;
  /** 校对完成时间。 */
  proofread_at?: UnixTimestamp;
  /** 开始嵌字时间。 */
  typesetting_at?: UnixTimestamp;
  /** 嵌字完成时间。 */
  typeset_at?: UnixTimestamp;
  /** 审稿完成时间。 */
  reviewed_at?: UnixTimestamp;
  /** 发布完成时间。 */
  published_at?: UnixTimestamp;
  /** 创建时间。 */
  created_at: UnixTimestamp;
  /** 更新时间。 */
  updated_at: UnixTimestamp;
  /** 当前流程阶段。 */
  workflow_stage: string;
  /** 章节进度百分比。 */
  progress_percent: number;
  /** 当前章节待审批申请总数。 */
  pending_request_count: number;
  /** 当前用户是否可以审批岗位申请。 */
  can_review_role_requests: boolean;
  /** 翻译岗位槽位。 */
  translator: WorksetBoardRoleSlotInfo;
  /** 校对岗位槽位。 */
  proofreader: WorksetBoardRoleSlotInfo;
  /** 嵌字岗位槽位。 */
  typesetter: WorksetBoardRoleSlotInfo;
  /** 审稿岗位槽位。 */
  reviewer: WorksetBoardRoleSlotInfo;
}

/**
 * 工作集详情页所需的章节看板数据。
 */
export interface WorksetBoardInfo {
  /** 工作集头部信息。 */
  workset: WorksetInfo;
  /** 当前工作集下的漫画切换选项。 */
  comic_options: WorksetBoardComicInfo[];
  /** 当前选中的漫画。 */
  selected_comic?: WorksetBoardComicInfo;
  /** 当前漫画下的章节看板行。 */
  chapters: WorksetBoardChapterInfo[];
}

/**
 * 漫画信息，对应 swagger 的 value.ComicInfo。
 */
export interface ComicInfo {
  /** 漫画唯一标识。 */
  id: string;
  /** 所属工作集 ID。 */
  workset_id: string;
  /** 漫画标题。 */
  title: string;

  /** 漫画作者。 */
  author?: string;
  /** 漫画简介。 */
  description?: string;
  /** 在工作集中的排序索引。 */
  index?: number;
  /** 已创建章节数。 */
  chapter_count?: number;
  /** 最近活跃时间。 */
  last_active_at?: UnixTimestamp;
  /** 创建者用户 ID。 */
  creator_id?: string;
  /** 关联创建者信息（includes 时可能返回）。 */
  creator?: UserInfo;
  /** 关联工作集信息（includes 时可能返回）。 */
  workset?: WorksetInfo;
  /** 创建时间。 */
  created_at?: UnixTimestamp;
  /** 更新时间。 */
  updated_at?: UnixTimestamp;

  /** 兼容旧前端字段：cover。 */
  cover?: string;
}

/**
 * 章节信息，对应 swagger 的 value.ChapterInfo。
 */
export interface ChapterInfo {
  /** 章节唯一标识。 */
  id: string;
  /** 所属漫画 ID。 */
  comic_id: string;
  /** 章节副标题。 */
  subtitle?: string;
  /** 章节序号。 */
  index?: number;

  /** 章节页面总数。 */
  page_count?: number;
  /** 总单元数量。 */
  total_unit_count?: number;
  /** 已翻译单元数量。 */
  translated_unit_count?: number;
  /** 已校对单元数量。 */
  proofread_unit_count?: number;

  /** 创建者用户 ID。 */
  creator_id?: string;
  /** 关联创建者（includes 时可能返回）。 */
  creator?: UserInfo;
  /** 关联漫画（includes 时可能返回）。 */
  comic?: ComicInfo;

  /** 各流程节点时间戳。 */
  transalating_at?: UnixTimestamp;
  proofreading_at?: UnixTimestamp;
  typesetting_at?: UnixTimestamp;
  uploaded_at?: UnixTimestamp;
  translated_at?: UnixTimestamp;
  reviewed_at?: UnixTimestamp;
  proofread_at?: UnixTimestamp;
  typeset_at?: UnixTimestamp;
  published_at?: UnixTimestamp;

  /** 创建时间。 */
  created_at?: UnixTimestamp;
  /** 更新时间。 */
  updated_at?: UnixTimestamp;

  /** 兼容旧前端字段：title。 */
  title?: string;
}

/**
 * 分配信息，对应 swagger 的 value.AssignmentInfo。
 */
export interface AssignmentInfo {
  /** 分配记录唯一标识。 */
  id: string;
  /** 所属章节 ID。 */
  chapter_id: string;
  /** 被分配用户 ID。 */
  user_id: string;
  /** 当前分工所属团队 ID。 */
  assigned_team_id?: string;

  /** 各角色分配时间戳。 */
  assigned_raw_provider_at?: UnixTimestamp;
  assigned_translator_at?: UnixTimestamp;
  assigned_reviewer_at?: UnixTimestamp;
  assigned_proofreader_at?: UnixTimestamp;
  assigned_typesetter_at?: UnixTimestamp;
  assigned_redrawer_at?: UnixTimestamp;
  assigned_publisher_at?: UnixTimestamp;

  /** 关联章节（includes 时可能返回）。 */
  chapter?: ChapterInfo;
  /** 关联用户（includes 时可能返回）。 */
  user?: UserInfo;
  /** 创建时间。 */
  created_at?: UnixTimestamp;
  /** 更新时间。 */
  updated_at?: UnixTimestamp;

  /** 兼容旧前端字段：role。 */
  role?: string | number;
}

/**
 * 岗位申请信息。
 */
export interface RoleRequestInfo {
  /** 申请记录唯一标识。 */
  id: string;
  /** 所属章节 ID。 */
  chapter_id: string;
  /** 关联章节信息。 */
  chapter?: ChapterInfo;
  /** 申请人用户 ID。 */
  user_id: string;
  /** 申请人用户信息。 */
  user?: UserInfo;
  /** 申请岗位角色位图。 */
  role: number;
  /** 当前申请状态。 */
  status: string;
  /** 申请归属协作组 ID。 */
  applied_team_id?: string;
  /** 申请时间。 */
  requested_at: UnixTimestamp;
  /** 审批人用户 ID。 */
  reviewed_by?: string;
  /** 审批人用户信息。 */
  reviewed_by_user?: UserInfo;
  /** 审批时间。 */
  reviewed_at?: UnixTimestamp;
  /** 拒绝理由。 */
  rejection_reason?: string;
  /** 创建时间。 */
  created_at: UnixTimestamp;
  /** 更新时间。 */
  updated_at: UnixTimestamp;
}

/**
 * 邀请信息，对应 swagger 的 value.InvitationInfo。
 */
export interface InvitationInfo {
  /** 邀请唯一标识。 */
  id: string;
  /** 邀请码。 */
  invitation_code: string;
  /** 被邀请者 QQ。 */
  invitee_qq: string;
  /** 邀请人用户 ID。 */
  invitor_id: string;
  /** 邀请人信息（includes 时可能返回）。 */
  invitor?: UserInfo;
  /** 是否仍可用。 */
  pending: boolean;
  /** 角色位图（后端定义）。 */
  roles: number;
  /** 创建时间。 */
  created_at?: UnixTimestamp;
}

/**
 * 成员信息，对应 swagger 的 value.MemberInfo。
 */
export interface MemberInfo {
  /** 成员记录唯一标识。 */
  id: string;
  /** 所属团队 ID。 */
  team_id: string;
  /** 用户 ID。 */
  user_id: string;
  /** 角色位图（后端定义）。 */
  roles: number;

  /** 关联团队（includes 时可能返回）。 */
  team?: TeamInfo;
  /** 关联用户（includes 时可能返回）。 */
  user?: UserInfo;

  /** 各角色分配时间戳。 */
  assigned_raw_provider_at?: UnixTimestamp;
  assigned_translator_at?: UnixTimestamp;
  assigned_reviewer_at?: UnixTimestamp;
  assigned_proofreader_at?: UnixTimestamp;
  assigned_typesetter_at?: UnixTimestamp;
  assigned_admin_at?: UnixTimestamp;
  assigned_publisher_at?: UnixTimestamp;

  /** 创建时间。 */
  created_at?: UnixTimestamp;
  /** 更新时间。 */
  updated_at?: UnixTimestamp;
}

/**
 * 页面信息，对应 swagger 的 value.PageInfo。
 */
export interface PageInfo {
  /** 页面唯一标识。 */
  id: string;
  /** 所属章节 ID。 */
  chapter_id: string;
  /** 页面索引。 */
  index: number;
  /** 页面图片 URL。 */
  image_url?: string;

  /** 创建者用户 ID。 */
  creator_id?: string;
  /** 关联创建者（includes 时可能返回）。 */
  creator?: UserInfo;

  /** 单元统计。 */
  total_unit_count?: number;
  translated_unit_count?: number;
  proofread_unit_count?: number;

  /** 创建时间。 */
  created_at?: UnixTimestamp;
  /** 更新时间。 */
  updated_at?: UnixTimestamp;
}

/**
 * Unit 信息，对应 swagger 的 value.UnitInfo。
 */
export interface UnitInfo {
  /** Unit 唯一标识。 */
  id: string;
  /** 所属页面 ID。 */
  page_id: string;
  /** 排序索引。 */
  index: number;

  /** 坐标信息。 */
  x_coord: number;
  y_coord: number;

  /** 文本与状态信息。 */
  is_bubble: boolean;
  is_proofread: boolean;
  translated_text?: string;
  proofread_text?: string;
  translator_comment?: string;
  proofreader_comment?: string;
  translator_id?: string;
  proofreader_id?: string;
  /** 实时协作版本号。 */
  revision?: number;
  /** 最近编辑者用户 ID。 */
  last_edited_by?: string;
  /** 最近编辑时间。 */
  last_edited_at?: UnixTimestamp;
}
