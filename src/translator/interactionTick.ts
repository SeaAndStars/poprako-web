/** 翻译器拖动、编辑、新增等高频交互的目标帧率。 */
export const TRANSLATOR_INTERACTION_FPS = 128;

/** 交互 tick 间隔（毫秒），约每秒 128 次。 */
export const TRANSLATOR_INTERACTION_TICK_MS = Math.ceil(
  1000 / TRANSLATOR_INTERACTION_FPS,
);
