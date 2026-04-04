/**
 * 文件用途：封装本地项目翻译单元 IndexedDB 读写。
 * 将翻译单元从 localStorage 迁移到 IndexedDB，为后续多人在线协作做准备。
 */

import type { LocalProjectUnit } from "./types";

const UNIT_DB_NAME = "poprako_translator_units";
const UNIT_STORE_NAME = "units";
const UNIT_DB_VERSION = 1;

interface PersistedUnitRecord extends LocalProjectUnit {
  /** 关联的项目 ID，用于按项目批量查询或删除。 */
  project_id: string;
  /** 关联的页面 ID，用于按页面查询。 */
  page_id: string;
}

/**
 * 打开翻译单元 IndexedDB 数据库。
 */
function openUnitDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(UNIT_DB_NAME, UNIT_DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error("翻译单元数据库打开失败"));
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(UNIT_STORE_NAME)) {
        const store = database.createObjectStore(UNIT_STORE_NAME, {
          keyPath: "id",
        });
        store.createIndex("page_id", "page_id", { unique: false });
        store.createIndex("project_id", "project_id", { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/**
 * 读取指定页面的全部翻译单元。
 */
export async function loadPageUnits(
  projectID: string,
  pageID: string,
): Promise<LocalProjectUnit[]> {
  const database = await openUnitDatabase();

  const records = await new Promise<PersistedUnitRecord[]>(
    (resolve, reject) => {
      const transaction = database.transaction(UNIT_STORE_NAME, "readonly");
      const store = transaction.objectStore(UNIT_STORE_NAME);
      const index = store.index("page_id");
      const request = index.getAll(pageID);

      request.onerror = () => {
        reject(request.error ?? new Error("读取翻译单元失败"));
      };

      request.onsuccess = () => {
        resolve((request.result as PersistedUnitRecord[]) ?? []);
      };
    },
  );

  database.close();

  return records
    .filter((record) => record.project_id === projectID)
    .sort((a, b) => a.index - b.index)
    .map(
      (record): LocalProjectUnit => ({
        id: record.id,
        index: record.index,
        x_coord: record.x_coord,
        y_coord: record.y_coord,
        box_width_ratio: record.box_width_ratio,
        box_height_ratio: record.box_height_ratio,
        is_bubble: record.is_bubble,
        is_proofread: record.is_proofread,
        translated_text: record.translated_text,
        proofread_text: record.proofread_text,
        translator_comment: record.translator_comment,
        proofreader_comment: record.proofreader_comment,
        revision: record.revision,
        last_edited_by: record.last_edited_by,
        last_edited_at: record.last_edited_at,
      }),
    );
}

/**
 * 保存指定页面的全部翻译单元（先清后写）。
 */
export async function savePageUnits(
  projectID: string,
  pageID: string,
  units: LocalProjectUnit[],
): Promise<void> {
  const database = await openUnitDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(UNIT_STORE_NAME, "readwrite");
    const store = transaction.objectStore(UNIT_STORE_NAME);
    const index = store.index("page_id");
    const cursorRequest = index.openCursor(pageID);

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        const record = cursor.value as PersistedUnitRecord;
        if (record.project_id === projectID) {
          cursor.delete();
        }
        cursor.continue();
        return;
      }

      // 旧记录清理完毕，写入新记录
      units.forEach((unit) => {
        store.put({
          ...unit,
          project_id: projectID,
          page_id: pageID,
        } satisfies PersistedUnitRecord);
      });
    };

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error ?? new Error("保存翻译单元失败"));
    };
  });

  database.close();
}

/**
 * 删除指定项目的全部翻译单元。
 */
export async function deleteProjectUnits(projectID: string): Promise<void> {
  const database = await openUnitDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(UNIT_STORE_NAME, "readwrite");
    const store = transaction.objectStore(UNIT_STORE_NAME);
    const index = store.index("project_id");
    const cursorRequest = index.openCursor(projectID);

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
        return;
      }
    };

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error ?? new Error("删除项目翻译单元失败"));
    };
  });

  database.close();
}
