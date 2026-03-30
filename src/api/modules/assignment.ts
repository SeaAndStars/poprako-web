/**
 * 文件用途：封装章节分配（assignment）相关接口。
 */
import { httpClient } from "../http";
import type { IncludeQuery, PaginationQuery } from "../../types/common";
import type { AssignmentInfo } from "../../types/domain";

/**
 * 分配列表查询参数，对应 GET /assignments。
 */
export interface AssignmentListQuery extends PaginationQuery, IncludeQuery {
  /** 所属章节 ID。 */
  chapter_id: string;
}

/**
 * 获取分配列表请求类型。
 */
export type GetAssignmentListRequest = AssignmentListQuery;

/**
 * 获取我的分配请求类型。
 */
export type MyAssignmentListQuery = PaginationQuery & IncludeQuery;

/**
 * 获取我的分配请求类型。
 */
export type GetMyAssignmentsRequest = MyAssignmentListQuery;

/**
 * 创建分配参数，对应 swagger 的 value.CreateChapterAssignmentArgs。
 */
export interface CreateAssignmentArgs {
  /** 所属章节 ID。 */
  chapter_id: string;
  /** 被分配用户 ID。 */
  user_id: string;
  /** 分配角色位图（后端定义的整数）。 */
  role: number;
}

/**
 * 创建分配请求类型。
 */
export type CreateAssignmentRequest = CreateAssignmentArgs;

/**
 * 创建分配结果，对应 swagger 的 value.CreateChapterAssignmentResult。
 */
export interface CreateAssignmentResult {
  /** 新建分配记录 ID。 */
  id: string;
}

/**
 * 创建分配响应类型。
 */
export type CreateAssignmentResponse = CreateAssignmentResult;

/**
 * 更新分配参数，对应 swagger 的 value.UpdateAssignmentArgs。
 */
export interface UpdateAssignmentArgs {
  /** 分配 ID（可选，通常由 path 参数提供）。 */
  id?: string;
  /** 新角色位图（后端定义的整数）。 */
  role: number;
}

/**
 * 更新分配请求类型。
 */
export type UpdateAssignmentRequest = UpdateAssignmentArgs;

/**
 * 获取分配列表响应类型。
 */
export type GetAssignmentListResponse = AssignmentInfo[];

/**
 * 获取我的分配响应类型。
 */
export type GetMyAssignmentsResponse = AssignmentInfo[];

/**
 * 创建分配响应类型。
 */
export type UpdateAssignmentResponse = void;

/**
 * 删除分配响应类型。
 */
export type DeleteAssignmentResponse = void;

/**
 * 获取章节分配列表，对应 GET /assignments。
 * 请求类型：GetAssignmentListRequest。
 * 返回类型：GetAssignmentListResponse。
 */
export async function getAssignmentList(
  assignmentListQuery: GetAssignmentListRequest,
): Promise<GetAssignmentListResponse> {
  return httpClient.get<GetAssignmentListResponse>(
    "/assignments",
    assignmentListQuery,
  );
}

/**
 * 获取我的分配列表，对应 GET /assignments/mine。
 * 请求类型：GetMyAssignmentsRequest。
 * 返回类型：GetMyAssignmentsResponse。
 */
export async function getMyAssignments(
  myAssignmentListQuery: GetMyAssignmentsRequest = {
    offset: 0,
    limit: 20,
  },
): Promise<GetMyAssignmentsResponse> {
  const assignmentList = await httpClient.get<GetMyAssignmentsResponse>(
    "/assignments/mine",
    myAssignmentListQuery,
  );

  return Array.isArray(assignmentList) ? assignmentList : [];
}

/**
 * 创建分配记录，对应 POST /assignments。
 * 请求类型：CreateAssignmentRequest。
 * 返回类型：CreateAssignmentResponse。
 */
export async function createAssignment(
  createAssignmentArgs: CreateAssignmentRequest,
): Promise<CreateAssignmentResponse> {
  return httpClient.post<CreateAssignmentResponse, CreateAssignmentRequest>(
    "/assignments",
    createAssignmentArgs,
  );
}

/**
 * 更新分配角色，对应 PUT /assignments/{assignment_id}。
 * 请求类型：UpdateAssignmentRequest。
 * 返回类型：UpdateAssignmentResponse。
 */
export async function updateAssignment(
  assignmentID: string,
  updateAssignmentArgs: UpdateAssignmentRequest,
): Promise<UpdateAssignmentResponse> {
  await httpClient.put<UpdateAssignmentResponse, UpdateAssignmentRequest>(
    `/assignments/${assignmentID}`,
    updateAssignmentArgs,
  );
}

/**
 * 删除分配，对应 DELETE /assignments/{assignment_id}。
 * 请求类型：无。
 * 返回类型：DeleteAssignmentResponse。
 */
export async function deleteAssignment(
  assignmentID: string,
): Promise<DeleteAssignmentResponse> {
  await httpClient.delete<DeleteAssignmentResponse>(
    `/assignments/${assignmentID}`,
  );
}
