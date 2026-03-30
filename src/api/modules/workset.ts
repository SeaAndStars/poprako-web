/**
 * 文件用途：封装工作集（workset）相关接口。
 */
import { httpClient } from "../http";
import type { IncludeQuery, PaginationQuery } from "../../types/common";
import type { WorksetInfo } from "../../types/domain";

/**
 * 工作集查询参数，对应 GET /worksets。
 */
export interface WorksetListQuery extends PaginationQuery, IncludeQuery {
  /** 所属团队 ID。 */
  team_id: string;
}

/**
 * 获取工作集列表请求类型。
 */
export type GetWorksetListRequest = WorksetListQuery;

/**
 * 创建工作集参数，对应 swagger 的 value.CreateWorksetArgs。
 */
export interface CreateWorksetArgs {
  /** 所属团队 ID。 */
  team_id: string;
  /** 工作集名称。 */
  name: string;
  /** 工作集描述。 */
  description?: string;
}

/**
 * 创建工作集请求类型。
 */
export type CreateWorksetRequest = CreateWorksetArgs;

/**
 * 创建工作集结果，对应 swagger 的 value.CreateWorksetResult。
 */
export interface CreateWorksetResult {
  /** 新建工作集 ID。 */
  id: string;
}

/**
 * 创建工作集响应类型。
 */
export type CreateWorksetResponse = CreateWorksetResult;

/**
 * 更新工作集参数，对应 swagger 的 value.UpdateWorksetArgs。
 */
export interface UpdateWorksetArgs {
  /** 工作集 ID（可选，通常由 path 参数提供）。 */
  id?: string;
  /** 工作集名称。 */
  name: string;
  /** 工作集描述。 */
  description?: string;
}

/**
 * 更新工作集请求类型。
 */
export type UpdateWorksetRequest = UpdateWorksetArgs;

/**
 * 获取工作集列表响应类型。
 */
export type GetWorksetListResponse = WorksetInfo[];

/**
 * 创建工作集响应类型。
 */
export type UpdateWorksetResponse = void;

/**
 * 删除工作集响应类型。
 */
export type DeleteWorksetResponse = void;

/**
 * 获取工作集列表，对应 GET /worksets。
 * 请求类型：GetWorksetListRequest。
 * 返回类型：GetWorksetListResponse。
 */
export async function getWorksetList(
  worksetListQuery: GetWorksetListRequest,
): Promise<GetWorksetListResponse> {
  return httpClient.get<GetWorksetListResponse>("/worksets", worksetListQuery);
}

/**
 * 创建工作集，对应 POST /worksets。
 * 请求类型：CreateWorksetRequest。
 * 返回类型：CreateWorksetResponse。
 */
export async function createWorkset(
  createWorksetArgs: CreateWorksetRequest,
): Promise<CreateWorksetResponse> {
  return httpClient.post<CreateWorksetResponse, CreateWorksetRequest>(
    "/worksets",
    createWorksetArgs,
  );
}

/**
 * 更新工作集，对应 PUT /worksets/{workset_id}。
 * 请求类型：UpdateWorksetRequest。
 * 返回类型：UpdateWorksetResponse。
 */
export async function updateWorkset(
  worksetID: string,
  updateWorksetArgs: UpdateWorksetRequest,
): Promise<UpdateWorksetResponse> {
  await httpClient.put<UpdateWorksetResponse, UpdateWorksetRequest>(
    `/worksets/${worksetID}`,
    updateWorksetArgs,
  );
}

/**
 * 删除工作集，对应 DELETE /worksets/{workset_id}。
 * 请求类型：无。
 * 返回类型：DeleteWorksetResponse。
 */
export async function deleteWorkset(
  worksetID: string,
): Promise<DeleteWorksetResponse> {
  await httpClient.delete<DeleteWorksetResponse>(`/worksets/${worksetID}`);
}
