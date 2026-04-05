/**
 * 文件用途：封装章节（chapter）相关接口。
 */
import { httpClient } from "../http";
import type {
  IncludeQuery,
  PaginationQuery,
  WorkflowStatus,
} from "../../types/common";
import type { ChapterInfo } from "../../types/domain";

/**
 * 章节列表查询参数，对应 GET /chapters。
 */
export interface ChapterListQuery extends PaginationQuery, IncludeQuery {
  /** 所属漫画 ID。 */
  comic_id: string;
}

/**
 * 获取章节列表请求类型。
 */
export type GetChapterListRequest = ChapterListQuery;

/**
 * 创建章节参数，对应 swagger 的 value.CreateChapterArgs。
 */
export interface CreateChapterArgs {
  /** 所属漫画 ID。 */
  comic_id: string;
  /** 章节副标题。 */
  subtitle: string;

  /** 可选自定义章节索引，0-based；前端“第 x 话”等于该值加一。 */
  index?: number;

  /** 兼容旧请求字段：章节标题。 */
  title?: string;
}

/**
 * 创建章节请求类型。
 */
export type CreateChapterRequest = CreateChapterArgs;

/**
 * 创建章节结果，对应 swagger 的 value.CreateChapterResult。
 */
export interface CreateChapterResult {
  /** 新建章节 ID。 */
  id: string;
}

/**
 * 创建章节响应类型。
 */
export type CreateChapterResponse = CreateChapterResult;

/**
 * 更新章节参数，对应 swagger 的 value.UpdateChapterArgs。
 */
export interface UpdateChapterArgs {
  /** 章节 ID（可选，通常由 path 参数提供）。 */
  chapter_id?: string;
  /** 新章节副标题。 */
  subtitle?: string;
  /** 新章节索引，0-based。 */
  index?: number;

  /** 流程状态更新。 */
  translate_status?: WorkflowStatus;
  review_status?: WorkflowStatus;
  proofread_status?: WorkflowStatus;
  typeset_status?: WorkflowStatus;
  upload_status?: WorkflowStatus;
  publish_status?: WorkflowStatus;
}

/**
 * 更新章节请求类型。
 */
export type UpdateChapterRequest = UpdateChapterArgs;

/**
 * 获取章节列表响应类型。
 */
export type GetChapterListResponse = ChapterInfo[];

/**
 * 创建章节响应类型。
 */
export type UpdateChapterResponse = void;

/**
 * 导出章节译稿响应类型。
 */
export type ExportChapterManuscriptResponse = Blob;

/**
 * 删除章节响应类型。
 */
export type DeleteChapterResponse = void;

/**
 * 获取章节列表，对应 GET /chapters。
 * 请求类型：GetChapterListRequest。
 * 返回类型：GetChapterListResponse。
 */
export async function getChapterList(
  chapterListQuery: GetChapterListRequest,
): Promise<GetChapterListResponse> {
  return httpClient.get<GetChapterListResponse>("/chapters", chapterListQuery);
}

/**
 * 创建章节，对应 POST /chapters。
 * 请求类型：CreateChapterRequest。
 * 返回类型：CreateChapterResponse。
 */
export async function createChapter(
  createChapterArgs: CreateChapterRequest,
): Promise<CreateChapterResponse> {
  return httpClient.post<CreateChapterResponse, CreateChapterRequest>(
    "/chapters",
    createChapterArgs,
  );
}

/**
 * 更新章节，对应 PATCH /chapters/{chapter_id}。
 * 请求类型：UpdateChapterRequest。
 * 返回类型：UpdateChapterResponse。
 */
export async function updateChapter(
  chapterID: string,
  updateChapterArgs: UpdateChapterRequest,
): Promise<UpdateChapterResponse> {
  await httpClient.patch<UpdateChapterResponse, UpdateChapterRequest>(
    `/chapters/${chapterID}`,
    updateChapterArgs,
  );
}

/**
 * 删除章节，对应 DELETE /chapters/{chapter_id}。
 * 请求类型：无。
 * 返回类型：DeleteChapterResponse。
 */
export async function deleteChapter(
  chapterID: string,
): Promise<DeleteChapterResponse> {
  await httpClient.delete<DeleteChapterResponse>(`/chapters/${chapterID}`);
}

/**
 * 导出章节译稿，对应 GET /chapters/{chapter_id}/manuscript.txt。
 */
export async function exportChapterManuscript(
  chapterID: string,
): Promise<ExportChapterManuscriptResponse> {
  return httpClient.getBlob(`/chapters/${chapterID}/manuscript.txt`);
}
