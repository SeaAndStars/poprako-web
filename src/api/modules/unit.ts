/**
 * 文件用途：封装页面单元（unit）相关接口。
 */
import { httpClient } from "../http";
import type { UnitInfo } from "../../types/domain";

/**
 * 获取 unit 列表查询参数，对应 GET /units。
 */
export interface UnitListQuery {
  /** 页面 ID。 */
  page_id: string;
}

/**
 * 获取 unit 列表请求类型。
 */
export type GetUnitListRequest = UnitListQuery;

/**
 * Unit 新增项，对应 swagger 的 value.UnitCreation。
 */
export interface UnitCreation {
  id?: string;
  page_id: string;
  index: number;
  x_coord: number;
  y_coord: number;
  is_bubble: boolean;
  is_proofread: boolean;
  translated_text?: string;
  proofread_text?: string;
  translator_comment?: string;
  proofreader_comment?: string;
  translator_id?: string;
  proofreader_id?: string;
}

/**
 * Unit Patch 项，对应 swagger 的 value.UnitPatch。
 */
export interface UnitPatch {
  id: string;
  page_id?: string | null;
  index?: number;
  x_coord?: number;
  y_coord?: number;
  is_bubble?: boolean;

  is_proofread?: boolean;
  translated_text?: string | null;
  proofread_text?: string | null;
  translator_comment?: string | null;
  proofreader_comment?: string | null;
  translator_id?: string | null;
  proofreader_id?: string | null;
}

/**
 * Unit 差异体，对应 swagger 的 value.UnitDiff。
 */
export interface UnitDiff {
  /** 需要删除的 unit ID 列表。 */
  delete?: string[];
  /** 需要新增的 unit 列表。 */
  insert?: UnitCreation[];
  /** 需要更新的 unit 列表。 */
  patch?: UnitPatch[];
}

/**
 * 保存页面 unit 参数，对应 swagger 的 value.SavePageUnitArgs。
 */
export interface SavePageUnitArgs {
  /** 页面 ID。 */
  page_id: string;
  /** unit 差异内容。 */
  unit_diff: UnitDiff;
}

/**
 * 保存页面 unit 请求类型。
 */
export type SavePageUnitRequest = SavePageUnitArgs;

/**
 * 获取 unit 列表响应类型。
 */
export type GetUnitListResponse = UnitInfo[];

/**
 * 保存页面 unit 响应类型。
 */
export type SavePageUnitResponse = void;

/**
 * 获取 unit 列表，对应 GET /units。
 * 请求类型：GetUnitListRequest。
 * 返回类型：GetUnitListResponse。
 */
export async function getUnitList(
  unitListQuery: GetUnitListRequest,
): Promise<GetUnitListResponse> {
  const unitList = await httpClient.get<GetUnitListResponse>(
    "/units",
    unitListQuery,
  );

  return Array.isArray(unitList) ? unitList : [];
}

/**
 * 保存页面 unit diff，对应 PUT /units。
 * 请求类型：SavePageUnitRequest。
 * 返回类型：SavePageUnitResponse。
 */
export async function savePageUnit(
  savePageUnitArgs: SavePageUnitRequest,
): Promise<SavePageUnitResponse> {
  await httpClient.put<SavePageUnitResponse, SavePageUnitRequest>(
    "/units",
    savePageUnitArgs,
  );
}
