/**
 * 音质取值表（唯一事实来源）
 *
 * 三个地方读同一份，避免「接口能收、文档没写」这种漂移：
 *   1. /api 的参数校验（src/service/api.js）
 *   2. 首页「音质档位」表（src/pages/home/quality.js）
 *   3. 给 AI 的集成提示词（src/pages/home/prompt.js）
 *
 * 键 = 用户可能写的值（调用方统一转小写后查表），值 = 网易云的 level 原值。
 * 顺序即音质由低到高，页面的档位表也按这个顺序渲染。
 */
export const DEFAULT_QUALITY = 'standard'

export const QUALITY_ALIASES = {
    standard: 'standard', std: 'standard', '128': 'standard', '128k': 'standard',
    higher: 'higher', '192': 'higher', '192k': 'higher',
    exhigh: 'exhigh', '320': 'exhigh', '320k': 'exhigh', hq: 'exhigh',
    lossless: 'lossless', flac: 'lossless', sq: 'lossless',
    hires: 'hires', 'hi-res': 'hires', hi_res: 'hires', hr: 'hires',
    jyeffect: 'jyeffect', effect: 'jyeffect',
    sky: 'sky',
    jymaster: 'jymaster', master: 'jymaster',
}

/** 去重后的标准值，顺序与 QUALITY_ALIASES 的书写顺序一致（低 → 高） */
export const QUALITY_VALUES = [...new Set(Object.values(QUALITY_ALIASES))]

/** 某个标准值接受的全部写法，标准值本身排在最前 */
export const qualityAliasesOf = (value) => [
    value,
    ...Object.keys(QUALITY_ALIASES).filter(key => key !== value && QUALITY_ALIASES[key] === value),
]

export default QUALITY_VALUES
