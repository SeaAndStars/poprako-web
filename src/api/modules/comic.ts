/**
 * 文件用途：封装漫画（comic）相关接口。
 */
import { httpClient } from "../http";
import type { IncludeQuery, PaginationQuery } from "../../types/common";
import type { ComicInfo } from "../../types/domain";

/**
 * 漫画列表查询参数，对应 GET /comics。
 */
export interface ComicListQuery extends PaginationQuery, IncludeQuery {
  /** 所属工作集 ID。 */
  workset_id: string;
}

/**
 * 获取漫画列表请求类型。
 */
export type GetComicListRequest = ComicListQuery;

/**
 * 创建漫画参数，对应 swagger 的 value.CreateComicArgs。
 */
export interface CreateComicArgs {
  /** 所属工作集 ID。 */
  workset_id: string;
  /** 漫画标题。 */
  title: string;
  /** 漫画作者。 */
  author?: string;
  /** 漫画描述。 */
  description?: string;
}

/**
 * 创建漫画请求类型。
 */
export type CreateComicRequest = CreateComicArgs;

/**
 * 创建漫画结果，对应 swagger 的 value.CreateComicResult。
 */
export interface CreateComicResult {
  /** 新建漫画 ID。 */
  id: string;
}

/**
 * 创建漫画响应类型。
 */
export type CreateComicResponse = CreateComicResult;

/**
 * 更新漫画参数，对应 swagger 的 value.UpdateComicArgs。
 */
export interface UpdateComicArgs {
  /** 漫画 ID（可选，通常由 path 参数提供）。 */
  id?: string;
  /** 漫画标题。 */
  title: string;
  /** 漫画作者。 */
  author?: string;
  /** 漫画描述。 */
  description?: string;
}

/**
 * 更新漫画请求类型。
 */
export type UpdateComicRequest = UpdateComicArgs;

/**
 * 获取漫画列表响应类型。
 */
export type GetComicListResponse = ComicInfo[];

/**
 * 创建漫画响应类型。
 */
export type UpdateComicResponse = void;

/**
 * 删除漫画响应类型。
 */
export type DeleteComicResponse = void;

/**
 * 获取漫画列表，对应 GET /comics。
 * 请求类型：GetComicListRequest。
 * 返回类型：GetComicListResponse。
 */
export async function getComicList(
  comicListQuery: GetComicListRequest,
): Promise<GetComicListResponse> {
  return httpClient.get<GetComicListResponse>("/comics", comicListQuery);
}

/**
 * 创建漫画，对应 POST /comics。
 * 请求类型：CreateComicRequest。
 * 返回类型：CreateComicResponse。
 */
export async function createComic(
  createComicArgs: CreateComicRequest,
): Promise<CreateComicResponse> {
  return httpClient.post<CreateComicResponse, CreateComicRequest>(
    "/comics",
    createComicArgs,
  );
}

/**
 * 更新漫画，对应 PUT /comics/{comic_id}。
 * 请求类型：UpdateComicRequest。
 * 返回类型：UpdateComicResponse。
 */
export async function updateComic(
  comicID: string,
  updateComicArgs: UpdateComicRequest,
): Promise<UpdateComicResponse> {
  await httpClient.put<UpdateComicResponse, UpdateComicRequest>(
    `/comics/${comicID}`,
    updateComicArgs,
  );
}

/**
 * 删除漫画，对应 DELETE /comics/{comic_id}。
 * 请求类型：无。
 * 返回类型：DeleteComicResponse。
 */
export async function deleteComic(comicID: string): Promise<DeleteComicResponse> {
  await httpClient.delete<DeleteComicResponse>(`/comics/${comicID}`);
}
