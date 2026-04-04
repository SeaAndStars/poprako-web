/**
 * 文件用途：定义本地翻校项目的数据模型。
 * 该模型不依赖远端 Swagger 结构，专门服务于 web/client 双端可运行的本地项目工作区。
 */

/**
 * Electron 客户端下的页面图片来源。
 * 直接引用本地文件路径，避免重复复制大体积图片资源。
 */
export interface ElectronProjectImageSource {
  kind: "electron-file";
  /** 页面展示名称，通常为相对路径。 */
  name: string;
  /** 客户端可直接访问的绝对文件路径。 */
  path: string;
}

/**
 * web 端页面图片来源。
 * 图片二进制被转存到 IndexedDB，仅在元数据中保留 asset_id 进行关联。
 */
export interface WebProjectImageSource {
  kind: "web-asset";
  /** 页面展示名称，通常为原始文件名或相对路径。 */
  name: string;
  /** IndexedDB 资源键。 */
  asset_id: string;
}

/**
 * 页面图片来源联合类型。
 */
export type LocalProjectImageSource =
  | ElectronProjectImageSource
  | WebProjectImageSource;

/**
 * 本地项目中的单页标记单元。
 * 字段命名尽量贴近现有后端 UnitInfo，便于后续做双向迁移。
 */
export interface LocalProjectUnit {
  id: string;
  /** 当前页内的 1-based 顺序号。 */
  index: number;
  /** 归一化横坐标，范围为 0 到 1。 */
  x_coord: number;
  /** 归一化纵坐标，范围为 0 到 1。 */
  y_coord: number;
  /** 归一化框宽，范围为 0 到 1。 */
  box_width_ratio: number;
  /** 归一化框高，范围为 0 到 1。 */
  box_height_ratio: number;
  /** 是否为框内文本。 */
  is_bubble: boolean;
  /** 是否已完成校对。 */
  is_proofread: boolean;
  /** 翻译文本。 */
  translated_text: string;
  /** 校对文本。 */
  proofread_text: string;
  /** 翻译备注。 */
  translator_comment: string;
  /** 校对备注。 */
  proofreader_comment: string;
  /** 本地协作版本号，用于标记最近一次改动。 */
  revision: number;
  /** 最近编辑者显示名。 */
  last_edited_by?: string;
  /** 最近编辑时间，统一使用 Unix 毫秒时间戳。 */
  last_edited_at?: number;
}

export const MIN_LOCAL_PROJECT_UNIT_BOX_WIDTH_RATIO = 0.04;
export const MIN_LOCAL_PROJECT_UNIT_BOX_HEIGHT_RATIO = 0.04;
export const MAX_LOCAL_PROJECT_UNIT_BOX_WIDTH_RATIO = 0.9;
export const MAX_LOCAL_PROJECT_UNIT_BOX_HEIGHT_RATIO = 0.9;

type LocalProjectUnitGeometryCompatible = Omit<
  LocalProjectUnit,
  | "box_width_ratio"
  | "box_height_ratio"
  | "revision"
  | "last_edited_by"
  | "last_edited_at"
> &
  Partial<
    Pick<
      LocalProjectUnit,
      | "box_width_ratio"
      | "box_height_ratio"
      | "revision"
      | "last_edited_by"
      | "last_edited_at"
    >
  >;

/**
 * 为不同类型的文本框提供默认尺寸。
 * 框内文本通常更大，框外说明文本保持更紧凑的默认框。
 */
export function getDefaultLocalProjectUnitBoxSize(
  isBubble: boolean,
): Pick<LocalProjectUnit, "box_width_ratio" | "box_height_ratio"> {
  if (isBubble) {
    return {
      box_width_ratio: 0.18,
      box_height_ratio: 0.1,
    };
  }

  return {
    box_width_ratio: 0.14,
    box_height_ratio: 0.08,
  };
}

/**
 * 将值限制在指定归一化区间内。
 */
function clampNormalizedValue(
  rawValue: number,
  minValue: number,
  maxValue: number,
): number {
  if (!Number.isFinite(rawValue)) {
    return minValue;
  }

  return Math.max(minValue, Math.min(maxValue, rawValue));
}

/**
 * 为新旧数据统一补齐并修正文本框几何信息。
 * 旧项目没有尺寸字段时，会按框内/框外类型回填默认尺寸。
 */
export function normalizeLocalProjectUnitGeometry(
  projectUnit: LocalProjectUnitGeometryCompatible,
): LocalProjectUnit {
  const defaultBoxSize = getDefaultLocalProjectUnitBoxSize(
    projectUnit.is_bubble,
  );
  const boxWidthRatio = clampNormalizedValue(
    projectUnit.box_width_ratio ?? defaultBoxSize.box_width_ratio,
    MIN_LOCAL_PROJECT_UNIT_BOX_WIDTH_RATIO,
    MAX_LOCAL_PROJECT_UNIT_BOX_WIDTH_RATIO,
  );
  const boxHeightRatio = clampNormalizedValue(
    projectUnit.box_height_ratio ?? defaultBoxSize.box_height_ratio,
    MIN_LOCAL_PROJECT_UNIT_BOX_HEIGHT_RATIO,
    MAX_LOCAL_PROJECT_UNIT_BOX_HEIGHT_RATIO,
  );
  const normalizedRevision = Number.isFinite(projectUnit.revision)
    ? Math.max(1, Math.trunc(projectUnit.revision ?? 1))
    : 1;

  return {
    ...projectUnit,
    x_coord: clampNormalizedValue(
      projectUnit.x_coord,
      boxWidthRatio / 2,
      1 - boxWidthRatio / 2,
    ),
    y_coord: clampNormalizedValue(
      projectUnit.y_coord,
      boxHeightRatio / 2,
      1 - boxHeightRatio / 2,
    ),
    box_width_ratio: boxWidthRatio,
    box_height_ratio: boxHeightRatio,
    revision: normalizedRevision,
    last_edited_by: projectUnit.last_edited_by?.trim() || undefined,
    last_edited_at:
      typeof projectUnit.last_edited_at === "number" &&
      Number.isFinite(projectUnit.last_edited_at)
        ? projectUnit.last_edited_at
        : undefined,
  };
}

/**
 * 本地项目页面结构。
 */
export interface LocalProjectPage {
  id: string;
  /** 页面顺序，1-based。 */
  index: number;
  /** 页面显示名称。 */
  name: string;
  /** 页面图片来源。 */
  image_source: LocalProjectImageSource;
  /** 当前页的所有标记单元。 */
  units: LocalProjectUnit[];
}

/**
 * 本地项目主体结构。
 */
export interface LocalProjectRecord {
  id: string;
  title: string;
  author: string;
  /** 来源说明，用于在列表卡片中提示项目来自哪个目录。 */
  source_label?: string;
  /** 当前项目最后停留的页码索引，0-based。 */
  last_page_index: number;
  /** 项目统计字段，全部由页面与单元派生。 */
  page_count: number;
  unit_count: number;
  translated_unit_count: number;
  proofread_unit_count: number;
  inbox_unit_count: number;
  outbox_unit_count: number;
  /** 创建时间与更新时间统一使用 ISO 字符串。 */
  created_at: string;
  updated_at: string;
  pages: LocalProjectPage[];
}

/**
 * 新建项目时传入的页面草稿结构。
 */
export interface LocalProjectDraftPage {
  name: string;
  image_source: LocalProjectImageSource;
}

/**
 * 新建本地项目时的输入数据。
 */
export interface CreateLocalProjectPayload {
  title: string;
  author: string;
  source_label?: string;
  pages: LocalProjectDraftPage[];
}
