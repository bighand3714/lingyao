// ============================================================
// game.js —— 游戏状态机（背包 / 图鉴 / 炼药流程）
// Godot 移植：本文件转换为 res://scripts/game_state.gd（autoload 单例）
// ============================================================

import { MATERIALS, RECIPES, JUDGE_STAGES } from './data.js'
import { judgeScore, resolveResult } from './judge.js'

const SAVE_KEY = 'lingyao_save_v1'

export class Game {
  constructor() {
    this.inventory = {}   // { materialId: count }
    this.codex = {}       // { recipeId: true }
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
      this.codex = save.codex ?? {}
      this.coins = save.coins ?? 0
    } catch {
      this.giveStarter()
    }
  }

  save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      inventory: this.inventory,
      codex: this.codex,
      coins: this.coins,
    }))
  }

  giveStarter() {
    // GDD §3.3 初始素材
    this.inventory = { lingzhi: 5, zhushacao: 5, mandala: 3, shougu: 3, zhusha: 3 }
    this.coins = 50
    for (const [id, r] of Object.entries(RECIPES)) {
      if (r.known) this.codex[id] = true
    }
  }

  // ---------- 素材 ----------
  count(id) { return this.inventory[id] ?? 0 }

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
