// ============================================================
// test.js —— 核心逻辑单测（node 运行：node test.js）
// ============================================================

import { judgeScore, matchRecipe, resolveResult, calcGrade } from './js/judge.js'
import { RECIPES } from './js/data.js'

let pass = 0
let fail = 0

function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`) }
  else { fail++; console.error(`  ✗ ${msg}`) }
}

console.log('【judgeScore 区间判定（单向行进，判定区在最右侧）】')
assert(judgeScore(93).level === 'perfect', 'pos=93 → perfect')
assert(judgeScore(90).level === 'perfect', 'pos=90 → perfect（边界）')
assert(judgeScore(85).level === 'good', 'pos=85 → good')
assert(judgeScore(75).level === 'normal', 'pos=75 → normal')
assert(judgeScore(50).level === 'fail', 'pos=50 → fail（太早）')
assert(judgeScore(98).level === 'fail', 'pos=98 → fail（走过头）')
assert(judgeScore(100).level === 'fail', 'pos=100 → fail（走到底）')
assert(judgeScore(95, 5).level === 'perfect', 'pos=95 + 偏移5 → perfect（区间右移）')
assert(judgeScore(90, 5).level === 'good', 'pos=90 + 偏移5 → good（补偿偏移）')

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
// 品阶计算
assert(calcGrade(3, [3, 3, 3]) === 3, 'avg=3 全完美 → 品阶3')
assert(calcGrade(3, [1, 1, 1]) === 1, 'avg=3 全普通 → 品阶1')
assert(calcGrade(12, [3, 3, 3]) === 5, 'avg=12 全完美 → 品阶5（上限）')

console.log('【配方表完整性】')
for (const r of Object.values(RECIPES)) {
  const ok = r.materials.every(id => !!id)
  assert(ok, `配方 ${r.id} 素材 id 有效`)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)
