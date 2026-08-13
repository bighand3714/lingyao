// ============================================================
// game.js —— 游戏状态机（背包 / 图鉴 / 商店 / 炼药流程）
// Godot 移植：本文件转换为 res://scripts/game_state.gd（autoload 单例）
// ============================================================

import { MATERIALS, RECIPES, RANDOM_PILL_POOL, JUDGE_STAGES } from './data.js'
import { judgeScore, resolveResult } from './judge.js'
import {
  materialBuyPrice, materialSellPrice, pillBuyPrice, pillSellPrice, codexPrice,
} from './economy.js'

const SAVE_KEY = 'lingyao_save_v1'

/** 丹药背包 key：id@品阶（如 huichun@3） */
export function pillKey(id, grade) {
  return `${id}@${grade}`
}

export class Game {
  constructor() {
    this.inventory = {}   // { materialId: count } 素材背包
    this.pills = {}       // { 'pillId@grade': count } 丹药背包
    this.codex = {}       // { recipeId: true } 图鉴
    this.coins = 0
    this.state = 'selecting'   // selecting | judging | settling
    this.selected = []         // 本次选中的素材 id
    this.scores = []           // 本次判定得分
    this.stageIndex = 0        // 当前判定段
    this.listeners = {}
    this.load()
  }

  // ---------- 事件 ----------
  on(event, fn) {
    ;(this.listeners[event] ??= []).push(fn)
  }

  emit(event, data) {
    for (const fn of this.listeners[event] ?? []) fn(data)
  }

  // ---------- 存档 ----------
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) { this.giveStarter(); return }
      const save = JSON.parse(raw)
      this.inventory = save.inventory ?? {}
      this.pills = save.pills ?? {}
      this.codex = save.codex ?? {}
      this.coins = save.coins ?? 0
    } catch {
      this.giveStarter()
    }
  }

  save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      inventory: this.inventory,
      pills: this.pills,
      codex: this.codex,
      coins: this.coins,
    }))
  }

  giveStarter() {
    // GDD §3.3 初始素材
    this.inventory = { lingzhi: 5, zhushacao: 5, mandala: 3, shougu: 3, zhusha: 3 }
    this.pills = {}
    this.coins = 50
    for (const [id, r] of Object.entries(RECIPES)) {
      if (r.known) this.codex[id] = true
    }
  }

  // ---------- 物品信息查询 ----------
  getMaterial(id) { return MATERIALS[id] ?? null }

  /** 按 id 查询丹药信息（配方丹或随机丹），统一归一化出 baseGrade */
  getPillBase(id) {
    const recipe = RECIPES[id]
    if (recipe) return { ...recipe, baseGrade: recipe.grade }
    return RANDOM_PILL_POOL.find(p => p.id === id) ?? null
  }

  /** 解析背包 key → { id, grade } */
  parsePillKey(key) {
    const [id, grade] = key.split('@')
    return { id, grade: Number(grade) }
  }

  // ---------- 素材 ----------
  count(id) { return this.inventory[id] ?? 0 }

  pillCount(key) { return this.pills[key] ?? 0 }

  isUnlocked(id) {
    const m = MATERIALS[id]
    if (!m || m.unlock === 0) return true
    return Object.keys(this.codex).length >= m.unlock
  }

  unlockedMaterials() {
    return Object.values(MATERIALS).filter(m => this.isUnlocked(m.id))
  }

  selectMaterial(id) {
    if (this.state !== 'selecting') return
    if (this.selected.includes(id)) return
    if (this.selected.length >= 3) return
    if (this.count(id) <= 0) return
    this.selected.push(id)
    this.emit('select', { selected: [...this.selected] })
  }

  unselectMaterial(id) {
    if (this.state !== 'selecting') return
    this.selected = this.selected.filter(x => x !== id)
    this.emit('select', { selected: [...this.selected] })
  }

  // ---------- 商店：素材 ----------
  buyMaterial(id, n = 1) {
    const m = MATERIALS[id]
    if (!m) return { ok: false, reason: '素材不存在' }
    if (!this.isUnlocked(id)) return { ok: false, reason: '素材未解锁' }
    const cost = materialBuyPrice(m) * n
    if (this.coins < cost) return { ok: false, reason: '金币不足' }
    this.coins -= cost
    this.inventory[id] = (this.inventory[id] ?? 0) + n
    this.save()
    this.emit('inventory', {})
    return { ok: true, cost }
  }

  sellMaterial(id, n = 1) {
    const m = MATERIALS[id]
    if (!m) return { ok: false, reason: '素材不存在' }
    if (this.count(id) < n) return { ok: false, reason: '数量不足' }
    this.inventory[id] -= n
    const gain = materialSellPrice(m) * n
    this.coins += gain
    this.save()
    this.emit('inventory', {})
    return { ok: true, gain }
  }

  // ---------- 商店：丹药 ----------
  /** 买入丹药（商店只售基础品阶） */
  buyPill(id, n = 1) {
    const info = this.getPillBase(id)
    if (!info) return { ok: false, reason: '丹药不存在' }
    const cost = pillBuyPrice(info) * n
    if (this.coins < cost) return { ok: false, reason: '金币不足' }
    this.coins -= cost
    const key = pillKey(id, info.baseGrade)
    this.pills[key] = (this.pills[key] ?? 0) + n
    this.save()
    this.emit('inventory', {})
    return { ok: true, cost }
  }

  /** 卖出丹药（按背包条目 key，含品阶） */
  sellPill(key, n = 1) {
    if (this.pillCount(key) < n) return { ok: false, reason: '数量不足' }
    const { id, grade } = this.parsePillKey(key)
    const info = this.getPillBase(id)
    if (!info) return { ok: false, reason: '丹药不存在' }
    this.pills[key] -= n
    const gain = pillSellPrice({ grade, baseGrade: info.baseGrade }) * n
    this.coins += gain
    this.save()
    this.emit('inventory', {})
    return { ok: true, gain }
  }

  // ---------- 商店：图鉴 ----------
  buyCodex(recipeId) {
    const recipe = RECIPES[recipeId]
    if (!recipe) return { ok: false, reason: '丹方不存在' }
    if (this.codex[recipeId]) return { ok: false, reason: '已收录' }
    const cost = codexPrice(recipe)
    if (this.coins < cost) return { ok: false, reason: '金币不足' }
    this.coins -= cost
    this.codex[recipeId] = true
    this.save()
    this.emit('inventory', {})
    return { ok: true, cost }
  }

  // ---------- 炼药流程 ----------
  startRefining() {
    if (this.state !== 'selecting') return
    if (this.selected.length === 0) return

    // 扣除素材
    for (const id of this.selected) {
      this.inventory[id] = Math.max(0, (this.inventory[id] ?? 0) - 1)
    }
    this.save()

    this.scores = []
    this.stageIndex = 0
    this.state = 'judging'
    this.emit('stage', { index: 0, stage: JUDGE_STAGES[0] })
  }

  /** 玩家点击判定：传入指针位置 0~100 与灵气波动偏移 */
  onJudgeClick(pos, zoneOffset = 0) {
    if (this.state !== 'judging') return

    const { score } = judgeScore(pos, zoneOffset)
    this.scores.push(score)
    const stage = JUDGE_STAGES[this.stageIndex]

    if (this.stageIndex < JUDGE_STAGES.length - 1) {
      this.stageIndex++
      this.emit('stageResult', { score, fail: score === 0, next: JUDGE_STAGES[this.stageIndex] })
    } else {
      this.emit('stageResult', { score, fail: score === 0, next: null })
      this.state = 'settling'
      this.settle()
    }
  }

  settle() {
    if (this.state !== 'settling' || this._settled) return
    this._settled = true
    const result = resolveResult(this.selected, this.scores)

    // 图鉴收录 & 素材解锁
    let newCodex = false
    if (result.success && result.pill.isRecipe) {
      if (!this.codex[result.pill.id]) {
        this.codex[result.pill.id] = true
        newCodex = true
      }
    }

    // 丹药入背包（按 品阶 分条目）
    if (result.success) {
      const key = pillKey(result.pill.id, result.pill.grade)
      this.pills[key] = (this.pills[key] ?? 0) + 1
    }

    // 奖励（GDD §6.2）
    let rewardCoins = 0
    const rewardMaterials = []
    if (result.success) {
      const grade = result.pill.grade
      rewardCoins = grade * 10 + result.totalScore * 5
      // 返还已用素材：1 个必给，高品阶概率给第 2 个
      const used = [...this.selected]
      const pick = () => used[Math.floor(Math.random() * used.length)]
      rewardMaterials.push(pick())
      if (Math.random() < 0.6 + grade * 0.08) rewardMaterials.push(pick())
    } else {
      // 爆炉：返还 1 个最低 tier 素材
      const lowest = [...this.selected].sort(
        (a, b) => MATERIALS[a].tier - MATERIALS[b].tier)[0]
      rewardMaterials.push(lowest)
    }
    for (const id of rewardMaterials) {
      this.inventory[id] = (this.inventory[id] ?? 0) + 1
    }
    this.coins += rewardCoins
    this.save()

    this.emit('settle', {
      ...result,
      newCodex,
      rewardCoins,
      rewardMaterials,
    })
    return result
  }

  backToSelect() {
    this.selected = []
    this.scores = []
    this.stageIndex = 0
    this._settled = false
    this.state = 'selecting'
    this.emit('select', { selected: [] })
    this.emit('backToSelect', {})
  }
}
