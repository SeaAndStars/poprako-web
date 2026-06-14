/**
 * 文件用途：解析“页码范围”输入字符串，例如 "1-5, 8, 10-12"。
 * 输入为 1-based 自然页码；输出为去重升序的 1-based 数组。
 * 与后端 PageRangeParser 保持同语义，便于前端即时校验。
 */

export interface PageRangeParseResult {
  pages: number[];
  error?: string;
}

export function parsePageRange(input: string): PageRangeParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { pages: [], error: "请输入页码或页码范围" };
  }

  const seen = new Set<number>();
  const segments = trimmed
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return { pages: [], error: "请输入页码或页码范围" };
  }

  for (const segment of segments) {
    const rangeParts = segment.split("-").map((part) => part.trim());
    if (rangeParts.length === 1) {
      const single = Number(rangeParts[0]);
      if (!Number.isInteger(single) || single < 1) {
        return { pages: [], error: `页码 "${segment}" 不是合法的正整数` };
      }
      seen.add(single);
    } else if (rangeParts.length === 2) {
      const start = Number(rangeParts[0]);
      const end = Number(rangeParts[1]);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < 1
      ) {
        return {
          pages: [],
          error: `页码区间 "${segment}" 必须为两个正整数`,
        };
      }
      if (start > end) {
        return {
          pages: [],
          error: `页码区间 "${segment}" 起始值不能大于结束值`,
        };
      }
      if (end - start > 9999) {
        return { pages: [], error: `页码区间 "${segment}" 跨度过大` };
      }
      for (let page = start; page <= end; page++) {
        seen.add(page);
      }
    } else {
      return { pages: [], error: `无法识别的页码片段 "${segment}"` };
    }
  }

  const pages = Array.from(seen).sort((a, b) => a - b);
  return { pages };
}
