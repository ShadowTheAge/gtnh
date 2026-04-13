/**
 * Game-data locale is intentionally independent from UI locale.
 *
 * Why this exists:
 * - Non-English players often need mixed-language workflows.
 * - UI text and in-game data (items/recipes/machine names) can be chosen separately.
 *
 * Typical scenarios:
 * - UI in Chinese, game data in English (for wiki/modpack docs lookup).
 * - UI in English, game data in Chinese.
 * - Future bilingual content rendering (show primary + secondary language together).
 *
 * This parameter is only for game content language selection and must not be treated
 * as a UI translation switch.
 */
export type GameDataLocale = "en" | "zh-CN";
