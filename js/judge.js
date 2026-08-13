// ============================================================
// judge.js —— 判定逻辑（纯函数，无 DOM 依赖，可 node 单测）
// Godot 移植：本文件转换为 res://scripts/judge.gd（公式保持一致）
// ============================================================

import {
  MATERIALS, RECIPES, RANDOM_PILL_POOL,
  JUDGE_ZONES, JUDGE_SCORES, FAIL_THRESHOLD,
} from './data.js'

export const QUALITY_NAMES = {
  1: '凡品', 2: '良品', 3: '珍品', 4: '仙品', 5: '传说',
}

/** 判断指针位置 pos(0~100) 落在哪个区间，返回 { level, score }
 *  zoneOffset: 灵气波动导致的区间偏移（GDD §5.3），默认 0 */
export function judgeScore(pos, zoneOffset = 0) {
  const p = pos - zoneOffset
  if (p >= JUDGE_ZONES.perfect.min && p <= JUDGE_ZONES.perfect.max) {
    return { level: 'perfect', score: JUDGE_SCORES.perfect }
  }
  if (p >= JUDGE_ZONES.good.min && p <= JUDGE_ZONES.good.max) {
    return { level: 'good', score: JUDGE_SCORES.good }
  }
  if (p >= JUDGE_ZONES.normal.min && p <= JUDGE_ZONES.normal.max) {
    return { level: 'normal', score: JUDGE_SCORES.normal }
  }
  return { level: 'fail', score: JUDGE_SCORES.fail }
}

/** 素材灵气均值 */
function avgValue(materialIds) {
  const sum = materialIds.reduce((acc, id) => acc + (MATERIALS[id]?.value ?? 0), 0)
  return sum / materialIds.length
}

/**
 * 计算丹药品阶（GDD §5.4）
 * @param {number} avgValue 素材灵气均值
 * @param {number[]} scores 三段得分（0~3）
 * @returns {number} 品阶 1~5
 */
export function calcGrade(avgValue, scores) {
  const total = scores.reduce((a, b) => a + b, 0)
  const factor = total / (scores.length * 3)   // 0~1
  const grade = Math.round(avgValue * factor)
  return Math.min(5, Math.max(1, grade))
}

/** 配方匹配：素材组合无序比较（支持重复素材） */
export function matchRecipe(materialIds) {
  const sorted = [...materialIds].sort()
  for (const recipe of Object.values(RECIPES)) {
    const rSorted = [...recipe.materials].sort()
    if (rSorted.length === sorted.length &&
        rSorted.every((id, i) => id === sorted[i])) {
      return recipe
    }
  }
  return null
}

/**
 * 结算主函数（纯函数）
 * @param {string[]} materialIds 投入素材 id 列表（1~3 种）
 * @param {number[]} scores 三段判定得分（0~3）
 * @returns {object} 结算结果
 */
export function resolveResult(materialIds, scores) {
  const failCount = scores.filter(s => s === 0).length
  const totalScore = scores.reduce((a, b) => a + b, 0)

  // 失误 ≥2 段 → 爆炉
  if (failCount >= FAIL_THRESHOLD) {
    return { success: false, reason: '爆炉', failCount, totalScore }
  }

  const recipe = matchRecipe(materialIds)
  const avg = avgValue(materialIds)
  const calcGradeResult = calcGrade(avg, scores)

  if (recipe) {
    // 命中配方：品阶至少为基础品阶，可更高
    const grade = Math.max(recipe.grade, calcGradeResult)
    return {
      success: true,
      pill: {
        id: recipe.id,
        name: recipe.name,
        emoji: recipe.emoji,
        effect: recipe.effect,
        grade,
        quality: QUALITY_NAMES[grade],
        isRecipe: true,
      },
      failCount, totalScore,
    }
  }

  // 未命中配方 → 随机丹药
  const pool = RANDOM_PILL_POOL
  const pill = pool[Math.floor(Math.random() * pool.length)]
  const grade = calcGradeResult
  return {
    success: true,
    pill: {
      id: null,
      name: pill.name,
      emoji: pill.emoji,
      effect: pill.effect,
      grade,
      quality: QUALITY_NAMES[grade],
      isRecipe: false,
    },
    failCount, totalScore,
  }
}
