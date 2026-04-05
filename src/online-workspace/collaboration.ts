/**
 * 文件用途：为在线章节工作区生成稳定协作房间键。
 * 在线房间直接基于 chapter/page ID，对齐所有成员，无需依赖本地项目元数据。
 */

export function buildOnlineChapterCollaborationKey(chapterID: string): string {
  return ["translator-online-chapter", chapterID.trim()].join("::");
}

export function buildOnlinePageCollaborationKey(
  chapterID: string,
  pageID: string,
): string {
  return [
    buildOnlineChapterCollaborationKey(chapterID),
    "page",
    pageID.trim(),
  ].join("::");
}
