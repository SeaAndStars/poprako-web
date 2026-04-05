/**
 * 文件用途：封装页面（page）相关接口。
 */
import { httpClient } from "../http";
import type { IncludeQuery, PaginationQuery } from "../../types/common";
import type { PageInfo } from "../../types/domain";

/**
 * 页面列表查询参数，对应 GET /pages。
 */
export interface PageListQuery extends PaginationQuery, IncludeQuery {
  /** 所属章节 ID。 */
  chapter_id: string;
}

/**
 * 获取页面列表请求类型。
 */
export type GetPageListRequest = PageListQuery;

/**
 * 预留章节页面参数，对应 swagger 的 value.ReserveChapterPagesArgs。
 */
export interface ReserveChapterPagesArgs {
  /** 所属章节 ID。 */
  chapter_id: string;
  /** 预留页面数量。 */
  page_count: number;
  /** 上传文件扩展名。 */
  extension: string;
}

/**
 * 预留章节页面请求类型。
 */
export type ReserveChapterPagesRequest = ReserveChapterPagesArgs;

/**
 * 单页预留结果，对应 swagger 的 value.PageCreationResult。
 */
export interface PageCreationResult {
  /** 页面 ID。 */
  page_id: string;
  /** 该页面上传用预签名 URL。 */
  put_url: string;
}

/**
 * 预留章节页面结果，对应 swagger 的 value.ReserveChapterPagesResult。
 */
export interface ReserveChapterPagesResult {
  /** 逐页预留结果列表。 */
  creations: PageCreationResult[];
}

/**
 * 预留章节页面响应类型。
 */
export type ReserveChapterPagesResponse = ReserveChapterPagesResult;

/**
 * 更新页面参数，对应 swagger 的 value.UpdatePageArgs。
 */
export interface UpdatePageArgs {
  /** 页面 ID（可选，通常由 path 参数提供）。 */
  id?: string;
  /** 页面文件是否已上传。 */
  is_uploaded: boolean;
}

/**
 * 更新页面请求类型。
 */
export type UpdatePageRequest = UpdatePageArgs;

/**
 * 获取页面列表响应类型。
 */
export type GetPageListResponse = PageInfo[];

/**
 * 更新页面响应类型。
 */
export type UpdatePageResponse = void;

/**
 * 确认页面翻译完成响应类型。
 */
export type CompletePageTranslationResponse = void;

/**
 * 回退页面翻译完成响应类型。
 */
export type RevertPageTranslationCompletionResponse = void;

/**
 * 删除章节页面响应类型。
 */
export type DeleteChapterPagesResponse = void;

/**
 * 获取页面列表，对应 GET /pages。
 * 请求类型：GetPageListRequest。
 * 返回类型：GetPageListResponse。
 */
export async function getPageList(
  pageListQuery: GetPageListRequest,
): Promise<GetPageListResponse> {
  const pageList = await httpClient.get<GetPageListResponse>(
    "/pages",
    pageListQuery,
  );

  return Array.isArray(pageList) ? pageList : [];
}

/**
 * 预留章节页面，对应 POST /pages。
 * 请求类型：ReserveChapterPagesRequest。
 * 返回类型：ReserveChapterPagesResponse。
 */
export async function reserveChapterPages(
  reserveChapterPagesArgs: ReserveChapterPagesRequest,
): Promise<ReserveChapterPagesResponse> {
  return httpClient.post<
    ReserveChapterPagesResponse,
    ReserveChapterPagesRequest
  >("/pages", reserveChapterPagesArgs);
}

/**
 * 更新页面，对应 PUT /pages/{page_id}。
 * 请求类型：UpdatePageRequest。
 * 返回类型：UpdatePageResponse。
 */
export async function updatePage(
  pageID: string,
  updatePageArgs: UpdatePageRequest,
): Promise<UpdatePageResponse> {
  await httpClient.put<UpdatePageResponse, UpdatePageRequest>(
    `/pages/${pageID}`,
    updatePageArgs,
  );
}

/**
 * 确认页面翻译完成，对应 POST /pages/{page_id}/translation-completion。
 */
export async function completePageTranslation(
  pageID: string,
): Promise<CompletePageTranslationResponse> {
  await httpClient.post<CompletePageTranslationResponse>(
    `/pages/${pageID}/translation-completion`,
  );
}

/**
 * 回退页面翻译完成，对应 DELETE /pages/{page_id}/translation-completion。
 */
export async function revertPageTranslationCompletion(
  pageID: string,
): Promise<RevertPageTranslationCompletionResponse> {
  await httpClient.delete<RevertPageTranslationCompletionResponse>(
    `/pages/${pageID}/translation-completion`,
  );
}

/**
 * 删除章节下所有页面，对应 DELETE /pages/{chapter_id}。
 * 请求类型：无。
 * 返回类型：DeleteChapterPagesResponse。
 */
export async function deleteChapterPages(
  chapterID: string,
): Promise<DeleteChapterPagesResponse> {
  await httpClient.delete<DeleteChapterPagesResponse>(`/pages/${chapterID}`);
}
