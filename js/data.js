// ============================================================
// data.js —— 素材与配方数据（纯数据层，无逻辑）
// Godot 移植：本文件 1:1 转换为 res://data/materials.json + recipes.json
// ============================================================

// ---------- 素材表 ----------
// type: herb 草药 / mineral 矿物 / beast 兽材
// natures: wen温 han寒 du毒 ping平 ling灵
export const MATERIALS = {
  lingzhi: {
    id: 'lingzhi', name: '灵芝', type: 'herb', emoji: '🍄',
    tier: 1, natures: ['wen'], value: 3,
    desc: '百年灵芝，益气安神', unlock: 0,
  },
  zhushacao: {
    id: 'zhushacao', name: '朱砂草', type: 'herb', emoji: '🌿',
    tier: 1, natures: ['ping'], value: 2,
    desc: '通体赤红，蕴含灵气', unlock: 0,
  },
  mandala: {
    id: 'mandala', name: '曼陀罗', type: 'herb', emoji: '🌺',
    tier: 2, natures: ['du'], value: 4,
    desc: '妖艳之花，含致幻之毒', unlock: 0,
  },
  zhusha: {
    id: 'zhusha', name: '朱砂', type: 'mineral', emoji: '🔴',
    tier: 2, natures: ['ling'], value: 5,
    desc: '炼丹常用矿料，凝神聚气', unlock: 0,
  },
  shougu: {
    id: 'shougu', name: '兽骨', type: 'beast', emoji: '🦴',
    tier: 2, natures: ['ping'], value: 4,
    desc: '妖兽遗骸，性烈易炼', unlock: 0,
  },
  xuelian: {
    id: 'xuelian', name: '雪莲', type: 'herb', emoji: '❄️',
    tier: 3, natures: ['han'], value: 6,
    desc: '千年雪峰之花，寒性极重', unlock: 3,
  },
  hanjing: {
    id: 'hanjing', name: '寒晶', type: 'mineral', emoji: '💎',
    tier: 4, natures: ['han'], value: 8,
    desc: '万年寒冰凝晶，触之冻骨', unlock: 6,
  },
  yaodan: {
    id: 'yaodan', name: '妖丹', type: 'beast', emoji: '🔮',
    tier: 4, natures: ['ling'], value: 9,
    desc: '妖兽千年修为所凝', unlock: 9,
  },
  longlin: {
    id: 'longlin', name: '龙鳞', type: 'beast', emoji: '🐉',
    tier: 5, natures: ['ling'], value: 12,
    desc: '真龙之鳞，可遇不可求', unlock: 12,
  },
}

// ---------- 配方表 ----------
// materials: 素材组合（无序），grade: 基础品阶
export const RECIPES = {
  huichun: {
    id: 'huichun', name: '回春丹', grade: 1,
    materials: ['lingzhi', 'zhushacao'],
    natures: ['wen'],
    emoji: '💊',
    effect: '恢复气血，疗伤圣药',
    known: true,
  },
  juqi: {
    id: 'juqi', name: '聚气丹', grade: 1,
    materials: ['zhushacao', 'zhusha'],
    natures: ['ping'],
    emoji: '⚡',
    effect: '加速灵气凝聚，修炼事半功倍',
    known: true,
  },
  mihun: {
    id: 'mihun', name: '迷魂丹', grade: 2,
    materials: ['mandala', 'shougu'],
    natures: ['du'],
    emoji: '🌀',
    effect: '迷人心智，中者昏聩',
    known: false,
  },
  peiyuan: {
    id: 'peiyuan', name: '培元丹', grade: 2,
    materials: ['lingzhi', 'lingzhi', 'zhushacao'],
    natures: ['wen'],
    emoji: '🌱',
    effect: '固本培元，夯实根基',
    known: false,
  },
  hanxi: {
    id: 'hanxi', name: '寒息丹', grade: 3,
    materials: ['xuelian', 'hanjing'],
    natures: ['han'],
    emoji: '🧊',
    effect: '冰寒彻骨，修习冰系功法必备',
    known: false,
  },
  pojing: {
    id: 'pojing', name: '破镜丹', grade: 4,
    materials: ['xuelian', 'hanjing', 'yaodan'],
    natures: ['ling'],
    emoji: '✨',
    effect: '一举突破瓶颈，传说级丹药',
    known: false,
  },
}

// ---------- 随机丹药模板（组合不匹配配方时生成） ----------
export const RANDOM_PILL_POOL = [
  { name: '杂丹', emoji: '🫙', effect: '药性驳杂，聊胜于无' },
  { name: '回气散', emoji: '🫙', effect: '微微回复灵力' },
  { name: '凝神丸', emoji: '🫙', effect: '清心凝神，杂念不生' },
]

// ---------- 判定区间（0~100） ----------
// 机制：指针单向从左走到右，判定区在最右侧，走到底（>96）即为失败
// perfect/good/normal 嵌套：normal ⊃ good ⊃ perfect
export const JUDGE_ZONES = {
  perfect: { min: 90, max: 96 },   // 得分 3
  good:    { min: 82, max: 96 },   // 得分 2
  normal:  { min: 72, max: 96 },   // 得分 1
  // <72 太早点击 / >96 走过头 → 失败，得分 0
}

export const JUDGE_SCORES = { perfect: 3, good: 2, normal: 1, fail: 0 }

// 三段判定配置：投炉 / 控火 / 出锅
// 机制：指针从左到右单向行进，duration 为走完全程的秒数（三段一致 5 秒）
export const JUDGE_STAGES = [
  { id: 'throwing', name: '投炉时机', duration: 5, hint: '指针走向右侧，金色处点下！' },
  { id: 'fire',     name: '控火时机', duration: 5, hint: '火候将成，把握右侧时机！' },
  { id: 'done',     name: '出锅时机', duration: 5, hint: '丹将出炉，最后一击！' },
]

// 失误 ≥2 段即爆炉
export const FAIL_THRESHOLD = 2
