/**
 * 文件用途：封装成员（member）相关接口。
 */
import { httpClient } from "../http";
import type { IncludeQuery, PaginationQuery } from "../../types/common";
import type { MemberInfo } from "../../types/domain";

/**
 * 成员列表查询参数，对应 GET /members。
 */
export interface MemberListQuery extends PaginationQuery, IncludeQuery {
  /** 所属团队 ID。 */
  team_id: string;
}

/**
 * 获取成员列表请求类型。
 */
export type GetMemberListRequest = MemberListQuery;

/**
 * 获取我的成员身份查询参数，对应 GET /members/mine。
 */
export type MyMemberListQuery = PaginationQuery & IncludeQuery;

/**
 * 获取我的成员身份请求类型。
 */
export type GetMyMembersRequest = MyMemberListQuery;

/**
 * 创建成员参数，对应 swagger 的 value.CreateMemberArgs。
 */
export interface CreateMemberArgs {
  /** 所属团队 ID。 */
  team_id: string;
  /** 用户 ID。 */
  user_id: string;
  /** 角色位图（后端定义）。 */
  roles: number;
}

/**
 * 创建成员请求类型。
 */
export type CreateMemberRequest = CreateMemberArgs;

/**
 * 创建成员结果，对应 swagger 的 value.CreateMemberResult。
 */
export interface CreateMemberResult {
  /** 新建成员 ID。 */
  member_id: string;
}

/**
 * 创建成员响应类型。
 */
export type CreateMemberResponse = CreateMemberResult;

/**
 * 通过邀请码加入团队参数，对应 swagger 的 value.JoinTeamArgs。
 */
export interface JoinTeamArgs {
  /** 邀请码。 */
  invitation_code: string;
}

/**
 * 加入团队请求类型。
 */
export type JoinTeamRequest = JoinTeamArgs;

/**
 * 更新成员角色参数，对应 swagger 的 value.UpdateMemberRoleArgs。
 */
export interface UpdateMemberRoleArgs {
  /** 成员 ID（可选，通常由 path 参数提供）。 */
  id?: string;
  /** 角色位图（后端定义）。 */
  roles: number;
}

/**
 * 更新成员角色请求类型。
 */
export type UpdateMemberRoleRequest = UpdateMemberRoleArgs;

/**
 * 获取成员列表响应类型。
 */
export type GetMemberListResponse = MemberInfo[];

/**
 * 获取我的成员身份响应类型。
 */
export type GetMyMembersResponse = MemberInfo[];

/**
 * 加入团队响应类型。
 */
export type JoinTeamResponse = void;

/**
 * 更新成员角色响应类型。
 */
export type UpdateMemberRoleResponse = void;

/**
 * 删除成员响应类型。
 */
export type DeleteMemberResponse = void;

/**
 * 获取成员列表，对应 GET /members。
 * 请求类型：GetMemberListRequest。
 * 返回类型：GetMemberListResponse。
 */
export async function getMemberList(
  memberListQuery: GetMemberListRequest,
): Promise<GetMemberListResponse> {
  const memberList = await httpClient.get<GetMemberListResponse>(
    "/members",
    memberListQuery,
  );

  return Array.isArray(memberList) ? memberList : [];
}

/**
 * 获取我的成员身份列表，对应 GET /members/mine。
 * 请求类型：GetMyMembersRequest。
 * 返回类型：GetMyMembersResponse。
 */
export async function getMyMembers(
  myMemberListQuery: GetMyMembersRequest = {
    offset: 0,
    limit: 20,
  },
): Promise<GetMyMembersResponse> {
  const memberList = await httpClient.get<GetMyMembersResponse>(
    "/members/mine",
    myMemberListQuery,
  );

  return Array.isArray(memberList) ? memberList : [];
}

/**
 * 创建成员，对应 POST /members。
 * 请求类型：CreateMemberRequest。
 * 返回类型：CreateMemberResponse。
 */
export async function createMember(
  createMemberArgs: CreateMemberRequest,
): Promise<CreateMemberResponse> {
  return httpClient.post<CreateMemberResponse, CreateMemberRequest>(
    "/members",
    createMemberArgs,
  );
}

/**
 * 通过邀请码加入团队，对应 POST /members/join。
 * 请求类型：JoinTeamRequest。
 * 返回类型：JoinTeamResponse。
 */
export async function joinTeam(
  joinTeamArgs: JoinTeamRequest,
): Promise<JoinTeamResponse> {
  await httpClient.post<JoinTeamResponse, JoinTeamRequest>(
    "/members/join",
    joinTeamArgs,
  );
}

/**
 * 更新成员角色，对应 PUT /members/{member_id}。
 * 请求类型：UpdateMemberRoleRequest。
 * 返回类型：UpdateMemberRoleResponse。
 */
export async function updateMemberRole(
  memberID: string,
  updateMemberRoleArgs: UpdateMemberRoleRequest,
): Promise<UpdateMemberRoleResponse> {
  const requestBody: UpdateMemberRoleRequest = {
    ...updateMemberRoleArgs,
    id: memberID,
  };

  await httpClient.put<UpdateMemberRoleResponse, UpdateMemberRoleRequest>(
    `/members/${memberID}`,
    requestBody,
  );
}

/**
 * 删除成员，对应 DELETE /members/{member_id}。
 * 请求类型：无。
 * 返回类型：DeleteMemberResponse。
 */
export async function deleteMember(
  memberID: string,
): Promise<DeleteMemberResponse> {
  await httpClient.delete<DeleteMemberResponse>(`/members/${memberID}`);
}
