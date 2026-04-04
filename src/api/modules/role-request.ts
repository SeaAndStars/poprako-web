/**
 * 文件用途：封装章节岗位申请（role request）相关接口。
 */
import { httpClient } from "../http";
import type { IncludeQuery, PaginationQuery } from "../../types/common";
import type { RoleRequestInfo } from "../../types/domain";

/**
 * 岗位申请列表查询参数，对应 GET /role-requests。
 */
export interface RoleRequestListQuery extends PaginationQuery, IncludeQuery {
  /** 所属章节 ID。 */
  chapter_id: string;
  /** 申请状态过滤。 */
  status?: string;
}

/**
 * 获取章节岗位申请列表请求类型。
 */
export type GetRoleRequestListRequest = RoleRequestListQuery;

/**
 * 获取我的岗位申请查询参数，对应 GET /role-requests/mine。
 */
export interface MyRoleRequestListQuery extends PaginationQuery, IncludeQuery {
  /** 所属章节 ID，可选。 */
  chapter_id?: string;
  /** 申请状态过滤。 */
  status?: string;
}

/**
 * 获取我的岗位申请请求类型。
 */
export type GetMyRoleRequestsRequest = MyRoleRequestListQuery;

/**
 * 创建岗位申请参数。
 */
export interface CreateRoleRequestArgs {
  /** 所属章节 ID。 */
  chapter_id: string;
  /** 申请的岗位角色位图。 */
  role: number;
  /** 申请归属协作组 ID。 */
  applied_team_id?: string;
}

/**
 * 创建岗位申请请求类型。
 */
export type CreateRoleRequestRequest = CreateRoleRequestArgs;

/**
 * 创建岗位申请结果。
 */
export interface CreateRoleRequestResult {
  /** 新建岗位申请 ID。 */
  id: string;
}

/**
 * 创建岗位申请响应类型。
 */
export type CreateRoleRequestResponse = CreateRoleRequestResult;

/**
 * 审批岗位申请参数。
 */
export interface ReviewRoleRequestArgs {
  /** 审批结果，仅支持 approved 或 rejected。 */
  status: "approved" | "rejected";
  /** 拒绝理由。 */
  rejection_reason?: string;
}

/**
 * 审批岗位申请请求类型。
 */
export type ReviewRoleRequestRequest = ReviewRoleRequestArgs;

/**
 * 获取章节岗位申请列表响应类型。
 */
export type GetRoleRequestListResponse = RoleRequestInfo[];

/**
 * 获取我的岗位申请列表响应类型。
 */
export type GetMyRoleRequestsResponse = RoleRequestInfo[];

/**
 * 审批岗位申请响应类型。
 */
export type ReviewRoleRequestResponse = void;

/**
 * 撤回岗位申请响应类型。
 */
export type WithdrawRoleRequestResponse = void;

/**
 * 获取章节岗位申请列表，对应 GET /role-requests。
 * 请求类型：GetRoleRequestListRequest。
 * 返回类型：GetRoleRequestListResponse。
 */
export async function getRoleRequestList(
  query: GetRoleRequestListRequest,
): Promise<GetRoleRequestListResponse> {
  const requestList = await httpClient.get<GetRoleRequestListResponse>(
    "/role-requests",
    query,
  );

  return Array.isArray(requestList) ? requestList : [];
}

/**
 * 获取我的岗位申请列表，对应 GET /role-requests/mine。
 * 请求类型：GetMyRoleRequestsRequest。
 * 返回类型：GetMyRoleRequestsResponse。
 */
export async function getMyRoleRequests(
  query: GetMyRoleRequestsRequest = {
    offset: 0,
    limit: 20,
  },
): Promise<GetMyRoleRequestsResponse> {
  const requestList = await httpClient.get<GetMyRoleRequestsResponse>(
    "/role-requests/mine",
    query,
  );

  return Array.isArray(requestList) ? requestList : [];
}

/**
 * 创建岗位申请，对应 POST /role-requests。
 * 请求类型：CreateRoleRequestRequest。
 * 返回类型：CreateRoleRequestResponse。
 */
export async function createRoleRequest(
  body: CreateRoleRequestRequest,
): Promise<CreateRoleRequestResponse> {
  return httpClient.post<CreateRoleRequestResponse, CreateRoleRequestRequest>(
    "/role-requests",
    body,
  );
}

/**
 * 审批岗位申请，对应 PATCH /role-requests/{role_request_id}。
 * 请求类型：ReviewRoleRequestRequest。
 * 返回类型：ReviewRoleRequestResponse。
 */
export async function reviewRoleRequest(
  roleRequestID: string,
  body: ReviewRoleRequestRequest,
): Promise<ReviewRoleRequestResponse> {
  await httpClient.patch<ReviewRoleRequestResponse, ReviewRoleRequestRequest>(
    `/role-requests/${roleRequestID}`,
    body,
  );
}

/**
 * 撤回岗位申请，对应 DELETE /role-requests/{role_request_id}。
 * 请求类型：无。
 * 返回类型：WithdrawRoleRequestResponse。
 */
export async function withdrawRoleRequest(
  roleRequestID: string,
): Promise<WithdrawRoleRequestResponse> {
  await httpClient.delete<WithdrawRoleRequestResponse>(
    `/role-requests/${roleRequestID}`,
  );
}
