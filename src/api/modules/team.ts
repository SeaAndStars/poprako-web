/**
 * 文件用途：封装团队（team）相关接口。
 */
import { httpClient } from "../http";
import type { PaginationQuery } from "../../types/common";
import type { TeamInfo } from "../../types/domain";

/**
 * 团队列表查询参数。
 */
export type TeamListQuery = PaginationQuery;

/**
 * 获取团队列表的请求类型。
 */
export type GetTeamListRequest = TeamListQuery;

/**
 * 创建团队参数，对应 swagger 的 value.CreateTeamArgs。
 */
export interface CreateTeamArgs {
  /** 团队名称。 */
  name: string;
  /** 团队简介。 */
  description?: string;
}

/**
 * 创建团队请求类型。
 */
export type CreateTeamRequest = CreateTeamArgs;

/**
 * 创建团队结果，对应 swagger 的 value.CreateTeamResult。
 */
export interface CreateTeamResult {
  /** 新建团队 ID。 */
  id: string;
}

/**
 * 创建团队响应类型。
 */
export type CreateTeamResponse = CreateTeamResult;

/**
 * 更新团队参数，对应 swagger 的 value.UpdateTeamArgs。
 */
export interface UpdateTeamArgs {
  /** 团队 ID（可选，通常由 path 参数提供）。 */
  id?: string;
  /** 团队名称。 */
  name: string;
  /** 团队简介。 */
  description?: string;
}

/**
 * 更新团队请求类型。
 */
export type UpdateTeamRequest = UpdateTeamArgs;

/**
 * 获取当前用户团队列表响应类型。
 */
export type GetMyTeamsResponse = TeamInfo[];

/**
 * 获取团队列表响应类型。
 */
export type GetTeamListResponse = TeamInfo[];

/**
 * 创建团队响应类型。
 */
export type UpdateTeamResponse = void;

/**
 * 删除团队响应类型。
 */
export type DeleteTeamResponse = void;

/**
 * 预留团队头像上传响应体，对应 value.ReserveTeamAvatarResult。
 */
export interface ReserveTeamAvatarResult {
  /** 头像 OSS Key。 */
  avatar_oss_key: string;
  /** 后端签发的预签名 PUT URL。 */
  put_url: string;
}

/**
 * 预留团队头像上传请求体。
 */
export interface ReserveTeamAvatarArgs {
  /**
   * 上传请求使用的 Content-Type，需要与后续 PUT 保持一致。
   */
  content_type: string;
}

/**
 * 预留团队头像上传响应类型。
 */
export type ReserveTeamAvatarResponse = ReserveTeamAvatarResult;

/**
 * 获取当前用户团队列表，对应 GET /teams/mine。
 * 请求类型：GetTeamListRequest。
 * 返回类型：GetMyTeamsResponse。
 */
export async function getMyTeams(
  teamListQuery: GetTeamListRequest = {
    offset: 0,
    limit: 20,
  },
): Promise<GetMyTeamsResponse> {
  const teamList = await httpClient.get<GetMyTeamsResponse>(
    "/teams/mine",
    teamListQuery,
  );
  return Array.isArray(teamList) ? teamList : [];
}

/**
 * 获取全部团队列表，对应 GET /teams。
 * 请求类型：GetTeamListRequest。
 * 返回类型：GetTeamListResponse。
 */
export async function getTeamList(
  teamListQuery: GetTeamListRequest,
): Promise<GetTeamListResponse> {
  return httpClient.get<GetTeamListResponse>("/teams", teamListQuery);
}

/**
 * 创建团队，对应 POST /teams。
 * 请求类型：CreateTeamRequest。
 * 返回类型：CreateTeamResponse。
 */
export async function createTeam(
  createTeamArgs: CreateTeamRequest,
): Promise<CreateTeamResponse> {
  return httpClient.post<CreateTeamResponse, CreateTeamRequest>(
    "/teams",
    createTeamArgs,
  );
}

/**
 * 更新团队信息，对应 PUT /teams/{team_id}。
 */
export async function updateTeam(
  teamID: string,
  updateTeamArgs: UpdateTeamRequest,
): Promise<UpdateTeamResponse> {
  await httpClient.put<UpdateTeamResponse, UpdateTeamRequest>(
    `/teams/${teamID}`,
    updateTeamArgs,
  );
}

/**
 * 删除团队，对应 DELETE /teams/{team_id}。
 */
export async function deleteTeam(teamID: string): Promise<DeleteTeamResponse> {
  await httpClient.delete<DeleteTeamResponse>(`/teams/${teamID}`);
}

/**
 * 预留团队头像上传，对应 POST /teams/{team_id}/avatar。
 */
export async function reserveTeamAvatar(
  teamID: string,
  reserveTeamAvatarArgs: ReserveTeamAvatarArgs,
): Promise<ReserveTeamAvatarResponse> {
  return httpClient.post<ReserveTeamAvatarResponse, ReserveTeamAvatarArgs>(
    `/teams/${teamID}/avatar`,
    reserveTeamAvatarArgs,
  );
}

/**
 * 确认团队头像上传完成，对应 POST /teams/{team_id}/avatar/confirm。
 */
export async function confirmTeamAvatarUploaded(teamID: string): Promise<void> {
  await httpClient.post<void>(`/teams/${teamID}/avatar/confirm`);
}
