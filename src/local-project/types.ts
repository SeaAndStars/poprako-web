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