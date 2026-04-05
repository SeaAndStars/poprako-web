/**
 * 文件用途：封装本地项目图片资源读写。
 * web 端使用 IndexedDB 存储图片数据；Electron 客户端则直接引用 file:// 路径。
 */

import type { LocalProjectImageSource } from "./types";

const LOCAL_PROJECT_ASSET_DB_NAME = "poprako_local_project_assets";
const LOCAL_PROJECT_ASSET_STORE_NAME = "project_images";
const LOCAL_PROJECT_ASSET_DB_VERSION = 1;

interface LocalProjectImageAssetRecord {
  id: string;
  name: string;
  data_url: string;
  mime_type: string;
  updated_at: string;
}

/**
 * 打开 IndexedDB 数据库。
 * 这里做单库单表设计，后续如果要加入缩略图缓存可继续扩展 object store。
 */
function openLocalProjectAssetDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(
      LOCAL_PROJECT_ASSET_DB_NAME,
      LOCAL_PROJECT_ASSET_DB_VERSION,
    );

    request.onerror = () => {
      reject(request.error ?? new Error("本地项目资源库打开失败"));
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LOCAL_PROJECT_ASSET_STORE_NAME)) {
        database.createObjectStore(LOCAL_PROJECT_ASSET_STORE_NAME, {
          keyPath: "id",
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/**
 * 将浏览器文件转换为 data URL。
 * data URL 体积更大，但读取简单、跨页面预览也更直接，适合作为当前版本的持久化格式。
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(reader.error ?? new Error("读取图片文件失败"));
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("图片文件读取结果无效"));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 将任意 Blob 转换为 data URL。
 * 在线工作区的整章缓存会先把远端图片抓成本地 Blob，再复用同一套 IndexedDB 存储。
 */
function readBlobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(reader.error ?? new Error("读取图片 Blob 失败"));
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("图片 Blob 读取结果无效"));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsDataURL(blob);
  });
}

/**
 * 生成稳定资源 ID。
 */
function createAssetID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 将浏览器选择的图片存入 IndexedDB，并返回 asset_id。
 */
export async function storeWebProjectImageAsset(file: File): Promise<string> {
  const database = await openLocalProjectAssetDatabase();
  const dataURL = await readFileAsDataURL(file);
  const assetID = createAssetID();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      LOCAL_PROJECT_ASSET_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(LOCAL_PROJECT_ASSET_STORE_NAME);

    store.put({
      id: assetID,
      name: file.name,
      data_url: dataURL,
      mime_type: file.type || "image/*",
      updated_at: new Date().toISOString(),
    } satisfies LocalProjectImageAssetRecord);

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error ?? new Error("写入本地项目图片失败"));
    };
  });

  database.close();
  return assetID;
}

/**
 * 将远端下载后的 Blob 写入 IndexedDB。
 * 这使在线章节也能走与本地导入相同的图片读取链路。
 */
export async function storeWebProjectImageAssetBlob(
  blob: Blob,
  name: string,
): Promise<string> {
  const database = await openLocalProjectAssetDatabase();
  const dataURL = await readBlobAsDataURL(blob);
  const assetID = createAssetID();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      LOCAL_PROJECT_ASSET_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(LOCAL_PROJECT_ASSET_STORE_NAME);

    store.put({
      id: assetID,
      name,
      data_url: dataURL,
      mime_type: blob.type || "image/*",
      updated_at: new Date().toISOString(),
    } satisfies LocalProjectImageAssetRecord);

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error ?? new Error("写入在线章节图片缓存失败"));
    };
  });

  database.close();
  return assetID;
}

/**
 * 根据 asset_id 读取 web 端持久化图片。
 */
export async function loadWebProjectImageAsset(
  assetID: string,
): Promise<string | null> {
  const database = await openLocalProjectAssetDatabase();

  const assetRecord = await new Promise<LocalProjectImageAssetRecord | null>(
    (resolve, reject) => {
      const transaction = database.transaction(
        LOCAL_PROJECT_ASSET_STORE_NAME,
        "readonly",
      );
      const store = transaction.objectStore(LOCAL_PROJECT_ASSET_STORE_NAME);
      const request = store.get(assetID);

      request.onerror = () => {
        reject(request.error ?? new Error("读取本地项目图片失败"));
      };

      request.onsuccess = () => {
        resolve(
          (request.result as LocalProjectImageAssetRecord | undefined) ?? null,
        );
      };
    },
  );

  database.close();
  return assetRecord?.data_url ?? null;
}

/**
 * 删除若干 web 端持久化图片资源。
 * 删除项目时应同步清理，避免 IndexedDB 里堆积孤立资源。
 */
export async function deleteWebProjectImageAssets(
  assetIDs: string[],
): Promise<void> {
  if (assetIDs.length === 0) {
    return;
  }

  const database = await openLocalProjectAssetDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      LOCAL_PROJECT_ASSET_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(LOCAL_PROJECT_ASSET_STORE_NAME);

    assetIDs.forEach((assetID) => {
      store.delete(assetID);
    });

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error ?? new Error("删除本地项目图片失败"));
    };
  });

  database.close();
}

/**
 * 将 Electron 文件路径转换为浏览器可识别的 file URL。
 */
export function toElectronFileURL(rawFilePath: string): string {
  const normalizedPath = rawFilePath.replace(/\\/g, "/");

  if (/^[a-zA-Z]:\//.test(normalizedPath)) {
    return encodeURI(`file:///${normalizedPath}`);
  }

  return encodeURI(`file://${normalizedPath}`);
}

/**
 * 统一解析页面图片预览地址。
 * 调用方无需关心当前项目来自 Electron 目录还是 web 本地导入。
 *
 * Electron 开发模式下，页面从 http://localhost 加载，直接使用 file:// URL
 * 会被浏览器跨源策略拦截。因此优先通过 IPC 读取文件内容并以 data URL 返回。
 */
export async function resolveLocalProjectImageURL(
  imageSource: LocalProjectImageSource,
): Promise<string | null> {
  if (imageSource.kind === "electron-file") {
    const desktopBridge = window.poprakoDesktop?.projectDialog;

    if (desktopBridge?.readImageFile) {
      try {
        const dataURL = await desktopBridge.readImageFile(imageSource.path);

        if (dataURL) {
          return dataURL;
        }

        console.warn(
          "[assets] IPC readImageFile 返回空值, path:",
          imageSource.path,
        );
      } catch (err) {
        console.error("[assets] IPC readImageFile 调用失败:", err);
      }
    } else {
      console.warn(
        "[assets] desktopBridge.readImageFile 不可用, 回退到 file:// URL",
      );
    }

    return toElectronFileURL(imageSource.path);
  }

  if (imageSource.kind === "web-remote") {
    return null;
  }

  return loadWebProjectImageAsset(imageSource.asset_id);
}
