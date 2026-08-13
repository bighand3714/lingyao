// ============================================================
// economy.js —— 商店价格体系（纯函数，可单测）
// 经济循环：卖丹/卖素材赚金币 → 买素材 → 炼药 → 卖丹 → 打听图鉴 → 解锁更高级循环
// ============================================================

/** 素材买入价：品阶与灵气值共同决定 */
export function materialBuyPrice(material) {
  return material.tier * 15 + material.value * 3
}

/** 素材卖出价：买入价的一半 */
export function materialSellPrice(material) {
  return Math.floor(materialBuyPrice(material) / 2)
}

/**
 * 丹药卖出价
 * @param {object} pill { grade: 实际品阶, baseGrade: 配方基础品阶 }
 */
export function pillSellPrice(pill) {
  return pill.grade * 20 + pill.baseGrade * 10
}

/** 丹药买入价（商店只卖基础品阶，价贵一倍） */
export function pillBuyPrice(pill) {
  return pillSellPrice(pill) * 2
}

/** 图鉴打听价（购买解锁配方信息） */
export function codexPrice(recipe) {
  return (recipe.grade + 1) * 50
}
