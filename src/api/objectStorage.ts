/**
 * 文件用途：封装对象存储直传相关的前端辅助方法。
 * 当前主要用于用户头像等预签名 PUT 地址上传。
 */

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:/i;
const IMAGE_CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * 解析前端可直接展示的资源 URL。
 * 当后端返回相对路径时，这里会自动补齐 API 所在站点的 origin。
 */
export function resolveAssetUrl(
  rawUrl: string | undefined,
): string | undefined {
  const normalizedUrl = rawUrl?.trim();

  if (!normalizedUrl) {
    return undefined;
  }

  // 开发环境下拦截 CDN 地址，交给 vite server proxy 处理，
  // 以规避前端在 localhost 调试时缺失跨站 Cookie 导致 WAF 无限重定向死循环的问题。
  if (
    import.meta.env.DEV &&
    normalizedUrl.startsWith("https://p1.seastarss.cn/")
  ) {
    return normalizedUrl.replace(
      "https://p1.seastarss.cn/",
      "/_dev_avatar_proxy/",
    );
  }

  if (ABSOLUTE_URL_PATTERN.test(normalizedUrl)) {
    return normalizedUrl;
  }

  if (normalizedUrl.startsWith("//")) {
    return `${window.location.protocol}${normalizedUrl}`;
  }

  const configuredBaseURL = import.meta.env.VITE_API_BASE_URL?.trim();

  try {
    const apiBaseURL = configuredBaseURL
      ? new URL(configuredBaseURL, window.location.origin)
      : new URL(window.location.origin);

    return new URL(normalizedUrl, `${apiBaseURL.origin}/`).toString();
  } catch {
    return normalizedUrl;
  }
}

/**
 * 根据文件名或 Content-Type 推断上传图片扩展名。
 */
export function resolveImageFileExtension(
  file: Pick<File, "name" | "type">,
): string {
  const extensionFromName = file.name
    .trim()
    .match(/\.([^.]+)$/)?.[1]
    ?.toLowerCase();

  if (extensionFromName === "jpg" || extensionFromName === "jpeg") {
    return "jpg";
  }

  if (extensionFromName === "png" || extensionFromName === "webp") {
    return extensionFromName;
  }

  const normalizedContentType = file.type.trim().toLowerCase();
  return IMAGE_CONTENT_TYPE_EXTENSION_MAP[normalizedContentType] || "png";
}

/**
 * 把文件直接上传到后端返回的预签名 PUT 地址。
 */
export async function uploadFileToPresignedPutUrl(
  putUrl: string,
  file: Blob,
  contentType: string,
): Promise<void> {
  const uploadResponse = await fetch(putUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("上传文件到对象存储失败");
  }
}

/**
 * 为静态资源 URL 追加版本参数，避免浏览器继续命中旧缓存。
 */
export function appendCacheBustQueryToUrl(
  rawUrl: string | undefined,
  version: number | string | undefined,
): string | undefined {
  const normalizedUrl = resolveAssetUrl(rawUrl);

  if (!normalizedUrl) {
    return undefined;
  }

  if (!version) {
    return normalizedUrl;
  }

  const [urlWithoutHash, urlHash = ""] = normalizedUrl.split("#");
  const separator = urlWithoutHash.includes("?") ? "&" : "?";

  return `${urlWithoutHash}${separator}t=${encodeURIComponent(String(version))}${urlHash ? `#${urlHash}` : ""}`;
}
