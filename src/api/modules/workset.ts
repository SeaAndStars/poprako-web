/**
 * 文件用途：封装工作集（workset）相关接口。
 */
import { httpClient } from "../http";
import type { IncludeQuery, PaginationQuery } from "../../types/common";
import type { WorksetBoardInfo, WorksetInfo } from "../../types/domain";

/**
 * 工作集查询参数，对应 GET /worksets。
 */
export interface WorksetListQuery extends PaginationQuery, IncludeQuery {
  /** 所属团队 ID。 */
  team_id: string;
  /** 模糊搜索关键字。 */
  search?: string;
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
  /** 工作集作者信息。 */
  author?: string;
  /** 工作集状态。 */
  status?: string;
  /** 默认翻译用户 ID。 */
  translator_user_id?: string;
  /** 默认校对用户 ID。 */
  proofreader_user_id?: string;
  /** 默认嵌字用户 ID。 */
  typesetter_user_id?: string;
  /** 默认审稿用户 ID。 */
  reviewer_user_id?: string;
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
  /** 工作集作者信息。 */
  author?: string;
  /** 工作集状态。 */
  status?: string;
  /** 默认翻译用户 ID。 */
  translator_user_id?: string;
  /** 默认校对用户 ID。 */
  proofreader_user_id?: string;
  /** 默认嵌字用户 ID。 */
  typesetter_user_id?: string;
  /** 默认审稿用户 ID。 */
  reviewer_user_id?: string;
}

/**
 * 获取工作集详情查询参数。
 */
export type GetWorksetByIDQuery = IncludeQuery;

/**
 * 获取工作集详情响应类型。
 */
export type GetWorksetByIDResponse = WorksetInfo;

/**
 * 获取工作集章节看板查询参数。
 */
export interface GetWorksetBoardQuery {
  /** 当前选中的漫画 ID。 */
  comic_id?: string;
}

/**
 * 获取工作集章节看板响应类型。
 */
export type GetWorksetBoardResponse = WorksetBoardInfo;

/**
 * 预留工作集封面请求体。
 */
export interface ReserveWorksetCoverArgs {
  /** 上传图片扩展名。 */
  extension?: string;
  /** 上传请求使用的 Content-Type。 */
  content_type?: string;
}

/**
 * 预留工作集封面结果。
 */
export interface ReserveWorksetCoverResult {
  /** 后端签发的预签名 PUT URL。 */
  put_url: string;
}

/**
 * 预留工作集封面响应类型。
 */
export type ReserveWorksetCoverResponse = ReserveWorksetCoverResult;

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
  const worksetList = await httpClient.get<GetWorksetListResponse>(
    "/worksets",
    worksetListQuery,
  );

  return Array.isArray(worksetList) ? worksetList : [];
}

/**
 * 获取工作集详情，对应 GET /worksets/{workset_id}。
 * 请求类型：GetWorksetByIDQuery。
 * 返回类型：GetWorksetByIDResponse。
 */
export async function getWorksetByID(
  worksetID: string,
  query?: GetWorksetByIDQuery,
): Promise<GetWorksetByIDResponse> {
  return httpClient.get<GetWorksetByIDResponse>(
    `/worksets/${worksetID}`,
    query,
  );
}

/**
 * 获取工作集章节看板，对应 GET /worksets/{workset_id}/board。
 * 请求类型：GetWorksetBoardQuery。
 * 返回类型：GetWorksetBoardResponse。
 */
export async function getWorksetBoard(
  worksetID: string,
  query?: GetWorksetBoardQuery,
): Promise<GetWorksetBoardResponse> {
  return httpClient.get<GetWorksetBoardResponse>(
    `/worksets/${worksetID}/board`,
    query,
  );
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
  const requestBody: UpdateWorksetRequest = {
    ...updateWorksetArgs,
    id: worksetID,
  };

  await httpClient.put<UpdateWorksetResponse, UpdateWorksetRequest>(
    `/worksets/${worksetID}`,
    requestBody,
  );
}

/**
 * 预留工作集封面，对应 POST /worksets/{workset_id}/cover。
 * 请求类型：ReserveWorksetCoverArgs。
 * 返回类型：ReserveWorksetCoverResponse。
 */
export async function reserveWorksetCover(
  worksetID: string,
  reserveWorksetCoverArgs: ReserveWorksetCoverArgs,
): Promise<ReserveWorksetCoverResponse> {
  return httpClient.post<ReserveWorksetCoverResponse, ReserveWorksetCoverArgs>(
    `/worksets/${worksetID}/cover`,
    reserveWorksetCoverArgs,
  );
}

/**
 * 确认工作集封面已上传，对应 POST /worksets/{workset_id}/cover/confirm。
 */
export async function confirmWorksetCoverUploaded(
  worksetID: string,
): Promise<void> {
  await httpClient.post<void>(`/worksets/${worksetID}/cover/confirm`);
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
