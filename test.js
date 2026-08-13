// ============================================================
// test.js —— 核心逻辑单测（node 运行：node test.js）
// ============================================================

import { judgeScore, matchRecipe, resolveResult, calcGrade } from './js/judge.js'
import { RECIPES, MATERIALS } from './js/data.js'
import { materialBuyPrice, materialSellPrice, pillSellPrice, pillBuyPrice, codexPrice } from './js/economy.js'
import { pillKey } from './js/game.js'

let pass = 0
let fail = 0

function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`) }
  else { fail++; console.error(`  ✗ ${msg}`) }
}

console.log('【judgeScore 区间判定（单向行进，成功区 48~96）】')
assert(judgeScore(93).level === 'perfect', 'pos=93 → perfect')
assert(judgeScore(84).level === 'perfect', 'pos=84 → perfect（边界）')
assert(judgeScore(80).level === 'good', 'pos=80 → good')
assert(judgeScore(60).level === 'normal', 'pos=60 → normal')
assert(judgeScore(40).level === 'fail', 'pos=40 → fail（太早）')
assert(judgeScore(98).level === 'fail', 'pos=98 → fail（走过头）')
assert(judgeScore(100).level === 'fail', 'pos=100 → fail（走到底）')
assert(judgeScore(95, 5).level === 'perfect', 'pos=95 + 偏移5 → perfect（区间右移）')
assert(judgeScore(75, 5).level === 'good', 'pos=75 + 偏移5 → good（补偿偏移）')

console.log('【matchRecipe 配方匹配（无序）】')
assert(matchRecipe(['zhushacao', 'lingzhi'])?.id === 'huichun', '朱砂草+灵芝 → 回春丹')
assert(matchRecipe(['lingzhi', 'zhushacao'])?.id === 'huichun', '灵芝+朱砂草 → 回春丹（顺序无关）')
assert(matchRecipe(['lingzhi', 'lingzhi', 'zhushacao'])?.id === 'peiyuan', '灵芝×2+朱砂草 → 培元丹')
assert(matchRecipe(['lingzhi', 'mandala']) === null, '灵芝+曼陀罗 → 无配方')

console.log('【resolveResult 结算】')
// 命中配方 + 高分
let r = resolveResult(['lingzhi', 'zhushacao'], [3, 3, 3])
assert(r.success && r.pill.id === 'huichun', '回春丹配方 + 全完美 → 出回春丹')
assert(r.pill.grade >= 1, `品阶 ≥1（实际 ${r.pill.grade}）`)
// 爆炉：2 段失误
r = resolveResult(['lingzhi', 'zhushacao'], [0, 0, 3])
assert(!r.success, '2 段失误 → 爆炉')
// 1 段失误不爆炉
r = resolveResult(['lingzhi', 'zhushacao'], [0, 3, 3])
assert(r.success, '1 段失误 → 仍成功')
// 未命中配方 → 随机丹
r = resolveResult(['lingzhi', 'mandala'], [2, 2, 2])
assert(r.success && !r.pill.isRecipe, '未命中配方 → 随机丹药')
// 重复素材配方：灵芝×2+朱砂草 → 培元丹
r = resolveResult(['lingzhi', 'lingzhi', 'zhushacao'], [2, 2, 2])
assert(r.success && r.pill.id === 'peiyuan', '灵芝×2+朱砂草 → 培元丹')
// 品阶计算
assert(calcGrade(3, [3, 3, 3]) === 3, 'avg=3 全完美 → 品阶3')
assert(calcGrade(3, [1, 1, 1]) === 1, 'avg=3 全普通 → 品阶1')
assert(calcGrade(12, [3, 3, 3]) === 5, 'avg=12 全完美 → 品阶5（上限）')

console.log('【配方表完整性】')
for (const r of Object.values(RECIPES)) {
  const ok = r.materials.every(id => !!id)
  assert(ok, `配方 ${r.id} 素材 id 有效`)
}

console.log('【经济：价格计算】')
assert(materialBuyPrice(MATERIALS.lingzhi) === 24, '灵芝买价 = 1*15+3*3 = 24')
assert(materialSellPrice(MATERIALS.lingzhi) === 12, '灵芝卖价 = 24/2 = 12')
assert(materialBuyPrice(MATERIALS.longlin) === 111, '龙鳞买价 = 5*15+12*3 = 111')
assert(pillSellPrice({ grade: 3, baseGrade: 1 }) === 70, '珍品回春丹卖价 = 3*20+1*10 = 70')
assert(pillBuyPrice({ grade: 1, baseGrade: 1 }) === 60, '凡品回春丹买价 = 30*2 = 60')
assert(codexPrice(RECIPES.pojing) === 250, '破镜丹打听价 = 5*50 = 250')

console.log('【经济：买卖与入库】')
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=String(v)} }
const { Game } = await import('./js/game.js')
const g = new Game()
g.coins = 100
assert(g.buyMaterial('lingzhi').ok, '买灵芝成功')
assert(g.count('lingzhi') === 6, '灵芝 +1（5→6）')
assert(g.coins === 100 - 24, '金币扣除 24')
assert(g.buyMaterial('longlin').ok === false, '龙鳞未解锁买不了')
assert(g.sellMaterial('lingzhi').ok, '卖灵芝成功')
assert(g.count('lingzhi') === 5, '灵芝 -1（6→5）')
assert(g.coins === 100 - 24 + 12, '金币 +12')
assert(g.buyPill('huichun').ok, '买回春丹成功')
assert(g.pillCount(pillKey('huichun', 1)) === 1, '凡品回春丹入背包')
assert(g.buyPill('pojing').ok === false, '金币不足买不了破镜丹')
assert(g.sellPill(pillKey('huichun', 1)).ok, '卖回春丹成功')
assert(g.pillCount(pillKey('huichun', 1)) === 0, '回春丹售出')
g.coins = 500
assert(g.buyCodex('mihun').ok, '打听迷魂丹丹方')
assert(g.codex['mihun'] === true, '图鉴解锁迷魂丹')
assert(g.buyCodex('mihun').ok === false, '重复打听被拒绝')

console.log('【丹药入库】')
globalThis.localStorage._d = {}
const g2 = new Game()
g2.selectMaterial('lingzhi'); g2.selectMaterial('zhushacao')
g2.startRefining()
g2.onJudgeClick(93); g2.onJudgeClick(93); g2.onJudgeClick(93)
g2.settle()
assert(g2.pillCount(pillKey('huichun', 3)) === 1, '珍品回春丹入背包（huichun@3）')
globalThis.localStorage._d = {}
const g3 = new Game()
g3.selectMaterial('lingzhi'); g3.selectMaterial('mandala')
g3.startRefining()
g3.onJudgeClick(85); g3.onJudgeClick(85); g3.onJudgeClick(85)
g3.settle()
const randomKeys = Object.keys(g3.pills)
assert(randomKeys.length === 1 && randomKeys[0].startsWith('random_dan@') || randomKeys[0].startsWith('huiqi_san@') || randomKeys[0].startsWith('ningshen_wan@'), '随机丹药入库（带品阶 key）')

console.log('【重复素材选择】')
globalThis.localStorage._d = {}
const g4 = new Game()
g4.selectMaterial('lingzhi')
g4.selectMaterial('lingzhi')
g4.selectMaterial('zhushacao')
assert(g4.selected.length === 3, '同种素材可放多份（灵芝×2+朱砂草）')
assert(g4.selected.filter(x => x === 'lingzhi').length === 2, '灵芝选中 2 份')
g4.selectMaterial('lingzhi')
assert(g4.selected.length === 3, '超过库存/上限被拒绝（最多 3 份）')
g4.unselectMaterial('lingzhi')
assert(g4.selected.filter(x => x === 'lingzhi').length === 1, '取消选中只移除一份')
g4.selectMaterial('lingzhi')
g4.startRefining()
g4.onJudgeClick(93); g4.onJudgeClick(93); g4.onJudgeClick(93)
g4.settle()
assert(g4.pillCount(pillKey('peiyuan', 3)) === 1, '培元丹入库（灵芝×2+朱砂草，全完美→珍品）')

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)
