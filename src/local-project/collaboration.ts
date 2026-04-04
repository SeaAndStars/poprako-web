/**
 * 文件用途：为本地项目翻译器推导稳定的协作房间键。
 * 当前 TranslatorView 使用本地随机 project/page ID，无法直接跨成员对齐，因此这里统一生成可复算的协作键。
 */

import type { LocalProjectPage, LocalProjectRecord } from "./types";

/**
 * 翻译器实时协作模式。
 */
export type TranslatorMode = "translate" | "proofread";

/**
 * 返回翻译模式的中文标签。
 */
export function resolveTranslatorModeLabel(mode: TranslatorMode): string {
  return mode === "proofread" ? "校对" : "翻译";
}

function normalizeCollaborationKeyPart(rawValue: string | undefined): string {
  return (rawValue ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

/**
 * 生成项目级协作键。
 * 这里刻意不包含 source_label，因为不同成员机器上的本地目录通常不同。
 */
export function buildLocalProjectCollaborationKey(
  projectRecord: Pick<LocalProjectRecord, "title" | "author" | "page_count">,
): string {
  return [
    "translator-project",
    normalizeCollaborationKeyPart(projectRecord.author),
    normalizeCollaborationKeyPart(projectRecord.title),
    String(projectRecord.page_count),
  ].join("::");
}

/**
 * 生成页面级协作键。
 */
export function buildLocalProjectPageCollaborationKey(
  projectRecord: Pick<LocalProjectRecord, "title" | "author" | "page_count">,
  projectPage: Pick<LocalProjectPage, "index" | "name">,
): string {
  return [
    buildLocalProjectCollaborationKey(projectRecord),
    "page",
    String(projectPage.index),
    normalizeCollaborationKeyPart(projectPage.name),
  ].join("::");
}
