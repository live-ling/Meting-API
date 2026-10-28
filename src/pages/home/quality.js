/**
 * 首页「音质档位」数据
 *
 * 取值本身来自 src/service/quality-values.js（/api 校验用的同一份表），
 * 这里只补「人话」：档位名、两个主力平台实际会拿到什么、要不要会员。
 *
 * 页面按 QUALITY_VALUES 的顺序渲染，所以以后在 quality-values.js 里加一档，
 * 首页会自动多一行；万一忘了写说明，这里用兜底行占位而不是直接崩掉。
 */

import { QUALITY_VALUES, DEFAULT_QUALITY } from '../../service/quality-values.js'

/**
 * @typedef {object} QualityLevel
 * @property {string} value   传给 /api 的标准值
 * @property {string} label   中文档位名
 * @property {string} netease 网易云音乐的实际规格
 * @property {string} tencent QQ 音乐的实际规格
 * @property {string} access  会员要求（经验值，以实际返回为准）
 */

/** @type {QualityLevel[]} */
export const QUALITY_LEVELS = [
    {
        value: 'standard',
        label: '标准',
        netease: 'MP3 · 128 kbps',
        tencent: 'M500 · 128 kbps',
        access: '无需会员',
    },
    {
        value: 'higher',
        label: '较高',
        netease: 'MP3 · 192 kbps',
        tencent: 'M800 · 320 kbps（无 192k 档）',
        access: '无需会员',
    },
    {
        value: 'exhigh',
        label: '极高',
        netease: 'MP3 · 320 kbps',
        tencent: 'M800 · 320 kbps',
        access: '部分需会员',
    },
    {
        value: 'lossless',
        label: '无损',
        netease: 'FLAC · 约 1000 kbps',
        tencent: 'F000 · FLAC',
        access: '多数需会员',
    },
    {
        value: 'hires',
        label: 'Hi-Res',
        netease: 'FLAC · 24 bit / 48 kHz 起',
        tencent: 'F000 · FLAC（不高于无损）',
        access: '需付费会员',
    },
    {
        value: 'jyeffect',
        label: '高清环绕声',
        netease: 'FLAC · 空间音频混音',
        tencent: '不支持，回落 128 kbps',
        access: '需付费会员',
    },
    {
        value: 'sky',
        label: '沉浸环绕声',
        netease: 'FLAC · 空间音频混音',
        tencent: '不支持，回落 128 kbps',
        access: '需付费会员',
    },
    {
        value: 'jymaster',
        label: '超清母带',
        netease: 'FLAC · 母带级',
        tencent: 'F000 · FLAC（不高于无损）',
        access: '需付费会员',
    },
]

const BY_VALUE = new Map(QUALITY_LEVELS.map(level => [level.value, level]))

/** 表里漏写的档位用占位行，保证「接口收什么，页面就列什么」 */
const fallbackLevel = (value) => ({
    value,
    label: value,
    netease: '—',
    tencent: '—',
    access: '以实际返回为准',
})

/**
 * 按 /api 的取值顺序返回档位行。
 * @returns {QualityLevel[]}
 */
export function qualityRows() {
    return QUALITY_VALUES.map(value => BY_VALUE.get(value) || fallbackLevel(value))
}

/** 默认档，用于表格里标注「默认」 */
export const DEFAULT_QUALITY_VALUE = DEFAULT_QUALITY

/**
 * 档位数的中文写法（"八档音质"）。
 * 文案跟着取值表走，以后加一档不会出现「说八档、列九行」。
 */
const CN_NUMBERS = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十']

export function qualityCountLabel() {
    const count = QUALITY_VALUES.length
    return `${CN_NUMBERS[count] || count}档`
}

export default QUALITY_LEVELS
