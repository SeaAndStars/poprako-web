/** 标记拖动协作同步目标帧率。 */
export const MARKER_DRAG_SYNC_FPS = 60;

/** 标记拖动协作同步间隔（毫秒）。 */
export const MARKER_DRAG_SYNC_MS = Math.ceil(1000 / MARKER_DRAG_SYNC_FPS);

/** 文本编辑协作同步目标帧率。 */
export const TEXT_EDIT_SYNC_FPS = 30;

/** 文本编辑协作同步间隔（毫秒）。 */
export const TEXT_EDIT_SYNC_MS = Math.ceil(1000 / TEXT_EDIT_SYNC_FPS);

/** 远端 live delta 应用节流间隔（毫秒），与拖动同步对齐。 */
export const REMOTE_LIVE_DELTA_APPLY_MS = MARKER_DRAG_SYNC_MS;
