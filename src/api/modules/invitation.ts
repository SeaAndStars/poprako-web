/**
 * 文件用途：封装邀请（invitation）相关接口。
 */
import { httpClient } from "../http";
import type { IncludeQuery, PaginationQuery } from "../../types/common";
import type { InvitationInfo } from "../../types/domain";

/**
 * 邀请列表查询参数，对应 GET /invitations。
 */
export interface InvitationListQuery extends PaginationQuery, IncludeQuery {
  /** 所属团队 ID。 */
  team_id: string;
}

/**
 * 获取邀请列表请求类型。
 */
export type GetInvitationListRequest = InvitationListQuery;

/**
 * 创建邀请参数，对应 swagger 的 value.CreateInvitationArgs。
 */
export interface CreateInvitationArgs {
  /** 所属团队 ID。 */
  team_id: string;
  /** 被邀请人的 QQ。 */
  invitee_qq: string;
  /** 邀请角色位图（后端定义）。 */
  roles: number;
}

/**
 * 创建邀请请求类型。
 */
export type CreateInvitationRequest = CreateInvitationArgs;

/**
 * 更新邀请参数，对应 swagger 的 value.UpdateInvitationArgs。
 */
export interface UpdateInvitationArgs {
  /** 邀请 ID（可选，通常由 path 参数提供）。 */
  id?: string;
  /** 所属团队 ID。 */
  team_id: string;
  /** 邀请角色位图（后端定义）。 */
  roles: number;
}

/**
 * 更新邀请请求类型。
 */
export type UpdateInvitationRequest = UpdateInvitationArgs;

/**
 * 获取邀请列表响应类型。
 */
export type GetInvitationListResponse = InvitationInfo[];

/**
 * 创建邀请响应类型。
 */
export type CreateInvitationResponse = InvitationInfo;

/**
 * 更新邀请响应类型。
 */
export type UpdateInvitationResponse = void;

/**
 * 删除邀请响应类型。
 */
export type DeleteInvitationResponse = void;

/**
 * 获取邀请列表，对应 GET /invitations。
 * 请求类型：GetInvitationListRequest。
 * 返回类型：GetInvitationListResponse。
 */
export async function getInvitationList(
  invitationListQuery: GetInvitationListRequest,
): Promise<GetInvitationListResponse> {
  const invitationList = await httpClient.get<GetInvitationListResponse>(
    "/invitations",
    invitationListQuery,
  );

  return Array.isArray(invitationList) ? invitationList : [];
}

/**
 * 创建邀请，对应 POST /invitations。
 * 请求类型：CreateInvitationRequest。
 * 返回类型：CreateInvitationResponse。
 */
export async function createInvitation(
  createInvitationArgs: CreateInvitationRequest,
): Promise<CreateInvitationResponse> {
  return httpClient.post<CreateInvitationResponse, CreateInvitationRequest>(
    "/invitations",
    createInvitationArgs,
  );
}

/**
 * 更新邀请，对应 PUT /invitations/{invitation_id}。
 * 请求类型：UpdateInvitationRequest。
 * 返回类型：UpdateInvitationResponse。
 */
export async function updateInvitation(
  invitationID: string,
  updateInvitationArgs: UpdateInvitationRequest,
): Promise<UpdateInvitationResponse> {
  await httpClient.put<UpdateInvitationResponse, UpdateInvitationRequest>(
    `/invitations/${invitationID}`,
    updateInvitationArgs,
  );
}

/**
 * 删除邀请，对应 DELETE /invitations/{invitation_id}。
 * 请求类型：无。
 * 返回类型：DeleteInvitationResponse。
 */
export async function deleteInvitation(
  invitationID: string,
): Promise<DeleteInvitationResponse> {
  await httpClient.delete<DeleteInvitationResponse>(
    `/invitations/${invitationID}`,
  );
}
