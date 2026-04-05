/**
 * 文件用途：封装对象存储直传相关的前端辅助方法。
 * 当前主要用于用户头像等预签名 PUT 地址上传。
 */

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:/i;
const DEV_AVATAR_PROXY_PREFIX = "/_dev_avatar_proxy/";
const HTTPS_UPGRADE_HOST_SUFFIXES = ["aliyuncs.com", "seastarss.cn"];
const IMAGE_CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const inMemoryAssetUrlCache = new Map<string, Promise<string | undefined>>();
const objectUrlCache = new Map<string, string>();
const missingAssetUrlCache = new Set<string>();

/**
 * 解析可跨客户端共享的资源 URL。
 * 当后端返回相对路径时，这里会自动补齐 API 所在站点的 origin。
 */
export function resolveSharedAssetUrl(
  rawUrl: string | undefined,
): string | undefined {
  const normalizedUrl = upgradeInsecureObjectStorageUrl(rawUrl?.trim());

  if (!normalizedUrl) {
    return undefined;
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
 * 解析前端可直接展示的资源 URL。
 * 开发环境下会把 CDN 头像切到 Vite 本地代理，避免跨站 Cookie/WAF 问题。
 */
export function resolveAssetUrl(
  rawUrl: string | undefined,
): string | undefined {
  const normalizedUrl = rawUrl?.trim();

  if (!normalizedUrl) {
    return undefined;
  }

  if (
    import.meta.env.DEV &&
    normalizedUrl.startsWith("https://p1.seastarss.cn/")
  ) {
    return normalizedUrl.replace(
      "https://p1.seastarss.cn/",
      DEV_AVATAR_PROXY_PREFIX,
    );
  }

  if (normalizedUrl.startsWith(DEV_AVATAR_PROXY_PREFIX)) {
    return new URL(normalizedUrl, `${window.location.origin}/`).toString();
  }

  return resolveSharedAssetUrl(normalizedUrl);
}

/**
 * 以内存对象 URL 形式缓存图片资源，避免同一头像在当前会话内反复重新请求。
 */
export async function resolveInMemoryAssetUrl(
  rawUrl: string | undefined,
): Promise<string | undefined> {
  const normalizedUrl = resolveAssetUrl(rawUrl);

  if (!normalizedUrl) {
    return undefined;
  }

  if (normalizedUrl.startsWith("blob:") || normalizedUrl.startsWith("data:")) {
    return normalizedUrl;
  }

  if (missingAssetUrlCache.has(normalizedUrl)) {
    return undefined;
  }

  const cachedObjectUrl = objectUrlCache.get(normalizedUrl);
  if (cachedObjectUrl) {
    return cachedObjectUrl;
  }

  const pendingTask = inMemoryAssetUrlCache.get(normalizedUrl);
  if (pendingTask) {
    return pendingTask;
  }

  const nextTask = (async () => {
    try {
      const response = await fetch(normalizedUrl, {
        cache: "force-cache",
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 410) {
          missingAssetUrlCache.add(normalizedUrl);
        }

        return undefined;
      }

      const contentType = response.headers.get("content-type")?.toLowerCase();
      if (!contentType?.startsWith("image/")) {
        return undefined;
      }

      const assetBlob = await response.blob();
      const objectUrl = URL.createObjectURL(assetBlob);
      objectUrlCache.set(normalizedUrl, objectUrl);
      return objectUrl;
    } catch {
      return undefined;
    } finally {
      inMemoryAssetUrlCache.delete(normalizedUrl);
    }
  })();

  inMemoryAssetUrlCache.set(normalizedUrl, nextTask);
  return nextTask;
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

export interface PresignedPutUploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadFileToPresignedPutUrlOptions {
  onProgress?: (progress: PresignedPutUploadProgress) => void;
}

/**
 * 把文件直接上传到后端返回的预签名 PUT 地址。
 */
export async function uploadFileToPresignedPutUrl(
  putUrl: string,
  file: Blob,
  contentType: string,
  options: UploadFileToPresignedPutUrlOptions = {},
): Promise<void> {
  const normalizedPutUrl = upgradeInsecureObjectStorageUrl(putUrl) || putUrl;

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const totalBytes = file.size || 0;

    const emitProgress = (loadedBytes: number): void => {
      if (!options.onProgress) {
        return;
      }

      const safeLoadedBytes = totalBytes
        ? Math.min(Math.max(loadedBytes, 0), totalBytes)
        : Math.max(loadedBytes, 0);
      const percent = totalBytes
        ? Math.min(100, Math.round((safeLoadedBytes / totalBytes) * 100))
        : safeLoadedBytes > 0
          ? 100
          : 0;

      options.onProgress({
        loaded: safeLoadedBytes,
        total: totalBytes,
        percent,
      });
    };

    request.open("PUT", normalizedPutUrl, true);
    request.setRequestHeader("Content-Type", contentType);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        emitProgress(event.loaded);
      }
    };

    request.onerror = () => {
      reject(new Error("上传文件到对象存储失败"));
    };

    request.onabort = () => {
      reject(new Error("上传已取消"));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        emitProgress(totalBytes);
        resolve();
        return;
      }

      reject(new Error("上传文件到对象存储失败"));
    };

    emitProgress(0);
    request.send(file);
  });
}

function upgradeInsecureObjectStorageUrl(
  rawUrl: string | undefined,
): string | undefined {
  const normalizedUrl = rawUrl?.trim();

  if (!normalizedUrl || window.location.protocol !== "https:") {
    return normalizedUrl;
  }

  if (!normalizedUrl.startsWith("http://")) {
    return normalizedUrl;
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const shouldUpgrade = HTTPS_UPGRADE_HOST_SUFFIXES.some(
      (hostSuffix) =>
        parsedUrl.hostname === hostSuffix ||
        parsedUrl.hostname.endsWith(`.${hostSuffix}`),
    );

    if (!shouldUpgrade) {
      return normalizedUrl;
    }

    parsedUrl.protocol = "https:";
    return parsedUrl.toString();
  } catch {
    return normalizedUrl;
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

  return appendCacheBustQuery(normalizedUrl, version);
}

/**
 * 为共享资源 URL 追加版本参数，避免跨客户端协作继续引用旧缓存。
 */
export function appendCacheBustQueryToSharedAssetUrl(
  rawUrl: string | undefined,
  version: number | string | undefined,
): string | undefined {
  const normalizedUrl = resolveSharedAssetUrl(rawUrl);

  if (!normalizedUrl) {
    return undefined;
  }

  return appendCacheBustQuery(normalizedUrl, version);
}

function appendCacheBustQuery(
  normalizedUrl: string,
  version: number | string | undefined,
): string {
  if (!version) {
    return normalizedUrl;
  }

  const [urlWithoutHash, urlHash = ""] = normalizedUrl.split("#");
  const separator = urlWithoutHash.includes("?") ? "&" : "?";

  return `${urlWithoutHash}${separator}t=${encodeURIComponent(String(version))}${urlHash ? `#${urlHash}` : ""}`;
}
