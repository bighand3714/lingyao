// ============================================================
// ui.js —— DOM 渲染与交互（不含游戏规则）
// Godot 移植：本文件由场景树 + Control 节点替代
// ============================================================

import { MATERIALS, RECIPES, RANDOM_PILL_POOL, JUDGE_STAGES, JUDGE_ZONES } from './data.js'
import { QUALITY_NAMES } from './judge.js'
import { pillKey } from './game.js'
import {
  materialBuyPrice, materialSellPrice, pillBuyPrice, pillSellPrice, codexPrice,
} from './economy.js'

const $ = (sel, root = document) => root.querySelector(sel)

/** 素材品阶 → 颜色类（与丹药品阶色共用 q1~q5） */
const tierClass = (tier) => `q${Math.min(5, Math.max(1, tier))}`

/** 轻提示（弹窗底部显示操作结果） */
function toast(el, text) {
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = text
  el.appendChild(t)
  setTimeout(() => t.remove(), 1600)
}

export function initUI(game) {
  const app = $('#app')

  // ---------- 顶栏 ----------
  const topbar = document.createElement('header')
  topbar.className = 'topbar'
  app.appendChild(topbar)

  const renderTopbar = () => {
    topbar.innerHTML = `
      <span class="topbar-item">💰 <b id="coin-amount">${game.coins}</b></span>
      <span class="topbar-item">图鉴 <b>${Object.keys(game.codex).length}/${Object.keys(RECIPES).length}</b></span>
      <button class="topbar-btn" id="inventory-btn">🎒 背包</button>
      <button class="topbar-btn" id="shop-btn">🏪 商店</button>
    `
    $('#inventory-btn').addEventListener('click', showInventory)
    $('#shop-btn').addEventListener('click', showShop)
  }

  // ---------- 主界面 ----------
  const mainView = document.createElement('main')
  mainView.className = 'main-view'
  mainView.innerHTML = `
    <div class="cauldron" id="cauldron">🏺</div>
    <div class="cauldron-flame" id="cauldron-flame"></div>
    <p class="cauldron-caption" id="cauldron-caption">丹炉微温，等待开炼</p>
    <div class="material-bar" id="material-bar"></div>
    <div class="selected-panel" id="selected-panel"></div>
    <button class="refine-btn" id="refine-btn" disabled>🔥 开炼</button>
  `
  app.appendChild(mainView)

  const materialBar = $('#material-bar')
  const selectedPanel = $('#selected-panel')
  const refineBtn = $('#refine-btn')

  const renderMaterialBar = () => {
    const materials = game.unlockedMaterials()
    materialBar.innerHTML = ''
    for (const m of materials) {
      const btn = document.createElement('button')
      btn.className = `material-btn ${tierClass(m.tier)}` + (game.selected.includes(m.id) ? ' selected' : '')
      btn.innerHTML = `<span class="material-emoji">${m.emoji}</span>
        <span class="material-name">${m.name}</span>
        <span class="material-count">×${game.count(m.id)}</span>`
      btn.title = m.desc
      btn.addEventListener('click', () => {
        if (game.selected.includes(m.id)) game.unselectMaterial(m.id)
        else game.selectMaterial(m.id)
      })
      materialBar.appendChild(btn)
    }
    // 未解锁素材占位
    for (const m of Object.values(MATERIALS)) {
      if (game.isUnlocked(m.id)) continue
      const btn = document.createElement('button')
      btn.className = 'material-btn locked'
      btn.innerHTML = `<span class="material-emoji">🔒</span>
        <span class="material-name">？？？</span>
        <span class="material-count">图鉴 ${m.unlock}+</span>`
      btn.title = `收集 ${m.unlock} 种丹方后解锁`
      materialBar.appendChild(btn)
    }
  }

  const renderSelectedPanel = () => {
    const sel = game.selected
    if (sel.length === 0) {
      selectedPanel.innerHTML = '<p class="selected-hint">选择素材投入丹炉（最多 3 种）</p>'
    } else {
      selectedPanel.innerHTML = '<p class="selected-hint">已选：</p>' + sel.map(id => {
        const m = MATERIALS[id]
        return `<span class="selected-chip ${tierClass(m.tier)}" data-id="${id}">${m.emoji}${m.name}</span>`
      }).join('')
    }
    selectedPanel.querySelectorAll('.selected-chip').forEach(chip => {
      chip.addEventListener('click', () => game.unselectMaterial(chip.dataset.id))
    })
    refineBtn.disabled = sel.length === 0
  }

  refineBtn.addEventListener('click', () => {
    if (game.selected.length > 0) game.startRefining()
  })

  // ---------- 判定界面 ----------
  const judgeView = document.createElement('section')
  judgeView.className = 'judge-view'
  judgeView.innerHTML = `
    <h2 class="judge-title" id="judge-title"></h2>
    <p class="judge-hint" id="judge-hint"></p>
    <div class="judge-track" id="judge-track">
      <div class="zone-outer" id="zone-outer"></div>
      <div class="zone-good" id="zone-good"></div>
      <div class="zone-perfect" id="zone-perfect"></div>
      <div class="judge-pointer" id="judge-pointer"></div>
    </div>
    <button class="judge-btn" id="judge-btn">点！</button>
    <p class="judge-status" id="judge-status"></p>
  `
  app.appendChild(judgeView)

  const judgePointer = $('#judge-pointer')
  const judgeBtn = $('#judge-btn')
  const judgeStatus = $('#judge-status')

  // 判定区间视觉与 data.js JUDGE_ZONES 自动同步
  const ZONE_STYLES = {
    outer:   { left: JUDGE_ZONES.normal.min, width: JUDGE_ZONES.normal.max - JUDGE_ZONES.normal.min },
    good:    { left: JUDGE_ZONES.good.min, width: JUDGE_ZONES.good.max - JUDGE_ZONES.good.min },
    perfect: { left: JUDGE_ZONES.perfect.min, width: JUDGE_ZONES.perfect.max - JUDGE_ZONES.perfect.min },
  }

  let animId = 0
  let currentPos = 50
  let zoneOffset = 0

  const renderZones = () => {
    $('#zone-outer').style.left = `${ZONE_STYLES.outer.left + zoneOffset}%`
    $('#zone-outer').style.width = `${ZONE_STYLES.outer.width}%`
    $('#zone-good').style.left = `${ZONE_STYLES.good.left + zoneOffset}%`
    $('#zone-good').style.width = `${ZONE_STYLES.good.width}%`
    $('#zone-perfect').style.left = `${ZONE_STYLES.perfect.left + zoneOffset}%`
    $('#zone-perfect').style.width = `${ZONE_STYLES.perfect.width}%`
  }

  const startJudge = (stage) => {
    judgeView.classList.add('active')
    mainView.classList.add('hidden')
    $('#judge-title').textContent = `第 ${game.stageIndex + 1} 段 · ${stage.name}`
    $('#judge-hint').textContent = stage.hint
    judgeStatus.textContent = ''
    judgeBtn.textContent = '点！'
    judgeBtn.disabled = false

    // 灵气波动（5% 概率，区间偏移 ±5）
    zoneOffset = Math.random() < 0.05 ? (Math.random() < 0.5 ? -5 : 5) : 0
    renderZones()
    if (zoneOffset !== 0) {
      judgeStatus.textContent = '⚡ 丹炉灵气波动！区间偏移！'
    }

    // 指针从左到右单向行进，duration 秒走完全程（走到底即失败）
    const duration = stage.duration * 1000
    const t0 = performance.now()
    cancelAnimationFrame(animId)
    const tick = (now) => {
      const t = (now - t0) / duration
      if (t >= 1) {
        // 走到底还没点击 → 自动判失败
        cancelAnimationFrame(animId)
        judgeBtn.disabled = true
        judgeStatus.textContent = '💨 时机已过！'
        game.onJudgeClick(100, zoneOffset)
        return
      }
      // 单向线性行进 + 低频正弦扰动（周期约 3s、幅度 ±0.8，丝滑且略带不确定）
      const wobble = Math.sin(now * 0.002) * 0.8
      currentPos = Math.min(100, Math.max(0, t * 100 + wobble))
      judgePointer.style.left = `${currentPos}%`
      animId = requestAnimationFrame(tick)
    }
    animId = requestAnimationFrame(tick)
  }

  judgeBtn.addEventListener('click', () => {
    if (game.state !== 'judging') return
    judgeBtn.disabled = true
    cancelAnimationFrame(animId)
    game.onJudgeClick(currentPos, zoneOffset)
  })

  // 段结果 → 下一段或结算
  game.on('stage', ({ stage }) => startJudge(stage))

  game.on('stageResult', ({ fail, next }) => {
    judgeStatus.textContent = fail ? '❌ 失误！' : '✅ 不错！'
    setTimeout(() => {
      if (next) startJudge(next)
    }, 600)
  })

  // ---------- 结算 ----------
  const showSettle = (result) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal'
    let content
    if (!result.success) {
      content = `
        <div class="settle-card fail">
          <div class="settle-emoji">💥</div>
          <h2>爆炉了！</h2>
          <p>火候失控，丹炉轰然作响……</p>
          <p class="settle-reward">安慰：返还 ${result.rewardMaterials.length} 份素材</p>
          <button class="modal-btn" id="again-btn">再炼一炉</button>
        </div>`
    } else {
      const p = result.pill
      const qualityClass = `q${p.grade}`
      content = `
        <div class="settle-card ${qualityClass}">
          ${result.newCodex ? '<div class="new-codex">✨ 新丹方收录！</div>' : ''}
          <div class="settle-emoji">${p.emoji}</div>
          <h2>${p.name}</h2>
          <div class="settle-quality ${qualityClass}">${p.quality}</div>
          <p class="settle-effect">${p.effect}</p>
          <p class="settle-reward">🎒 已放入背包 · 💰 +${result.rewardCoins} 金币 · 返还素材 ×${result.rewardMaterials.length}</p>
          <button class="modal-btn" id="again-btn">再炼一炉</button>
          <button class="modal-btn ghost" id="bag-btn">🎒 背包</button>
        </div>`
    }
    overlay.innerHTML = content
    $('#again-btn', overlay)?.addEventListener('click', () => {
      overlay.remove()
      game.backToSelect()
    })
    $('#bag-btn', overlay)?.addEventListener('click', () => {
      overlay.remove()
      game.backToSelect()
      showInventory()
    })
  }

  game.on('settle', (result) => {
    judgeView.classList.remove('active')
    mainView.classList.remove('hidden')
    setTimeout(() => showSettle(result), 700)
  })

  // ---------- 背包 ----------
  const showInventory = () => {
    const overlay = document.createElement('div')
    overlay.className = 'modal col'
    overlay.innerHTML = `
      <div class="panel codex">
        <h2>🎒 背包</h2>
        <div class="tabs">
          <button class="tab-btn active" data-tab="mat">素材</button>
          <button class="tab-btn" data-tab="pill">丹药</button>
        </div>
        <div class="tab-content" id="inv-mat"></div>
        <div class="tab-content hidden" id="inv-pill"></div>
      </div>
      <button class="modal-btn close-btn" id="close-inv">关闭</button>`
    document.body.appendChild(overlay)

    const renderMat = () => {
      const box = $('#inv-mat', overlay)
      const items = Object.values(MATERIALS).filter(m => game.count(m.id) > 0)
      box.innerHTML = items.length === 0
        ? '<p class="empty-hint">背包空空如也，去炼药或逛商店吧</p>'
        : items.map(m => `
          <div class="bag-row">
            <span class="bag-emoji">${m.emoji}</span>
            <span class="bag-name ${tierClass(m.tier)}">${m.name}</span>
            <span class="bag-sub">${m.desc}</span>
            <span class="bag-count">×${game.count(m.id)}</span>
          </div>`).join('')
    }

    const renderPill = () => {
      const box = $('#inv-pill', overlay)
      const keys = Object.keys(game.pills)
      box.innerHTML = keys.length === 0
        ? '<p class="empty-hint">还没有炼成任何丹药</p>'
        : keys.map(key => {
          const { id, grade } = game.parsePillKey(key)
          const info = game.getPillBase(id)
          return `
          <div class="bag-row">
            <span class="bag-emoji">${info.emoji}</span>
            <span class="bag-name q${grade}">${info.name}</span>
            <span class="bag-sub q${grade}">${QUALITY_NAMES[grade]}</span>
            <span class="bag-count">×${game.pillCount(key)}</span>
          </div>`
        }).join('')
    }

    overlay.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn))
        $('#inv-mat', overlay).classList.toggle('hidden', btn.dataset.tab !== 'mat')
        $('#inv-pill', overlay).classList.toggle('hidden', btn.dataset.tab !== 'pill')
      })
    })
    $('#close-inv', overlay).addEventListener('click', () => overlay.remove())
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove() })
    renderMat()
    renderPill()
  }

  // ---------- 商店 ----------
  const showShop = () => {
    const overlay = document.createElement('div')
    overlay.className = 'modal col'
    overlay.innerHTML = `
      <div class="panel codex shop">
        <h2>🏪 丹坊 <span class="codex-count">💰 <b id="shop-coins">${game.coins}</b></span></h2>
        <div class="tabs">
          <button class="tab-btn active" data-tab="mat">素材</button>
          <button class="tab-btn" data-tab="pill">丹药</button>
          <button class="tab-btn" data-tab="codex">图鉴</button>
        </div>
        <div class="tab-content" id="shop-mat"></div>
        <div class="tab-content hidden" id="shop-pill"></div>
        <div class="tab-content hidden" id="shop-codex"></div>
      </div>
      <button class="modal-btn close-btn" id="close-shop">关闭</button>`
    document.body.appendChild(overlay)

    const refreshCoins = () => { $('#shop-coins', overlay).textContent = game.coins }

    const renderMat = () => {
      const box = $('#shop-mat', overlay)
      const materials = Object.values(MATERIALS)
      box.innerHTML = materials.map(m => {
        const unlocked = game.isUnlocked(m.id)
        const buy = materialBuyPrice(m)
        const sell = materialSellPrice(m)
        return `
        <div class="shop-row">
          <div class="shop-info">
            <span class="bag-emoji">${unlocked ? m.emoji : '🔒'}</span>
            <span class="bag-name ${tierClass(m.tier)}">${unlocked ? m.name : '？？？'}</span>
            <span class="bag-sub">持有×${game.count(m.id)}</span>
          </div>
          <div class="shop-btns">
            <button class="shop-btn buy" data-act="buy" data-id="${m.id}" ${unlocked ? '' : 'disabled'}>买 ${buy}💰</button>
            <button class="shop-btn sell" data-act="sell" data-id="${m.id}" ${game.count(m.id) > 0 ? '' : 'disabled'}>卖 ${sell}💰</button>
          </div>
        </div>`
      }).join('')

      box.querySelectorAll('.shop-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id
          const r = btn.dataset.act === 'buy'
            ? game.buyMaterial(id)
            : game.sellMaterial(id)
          refreshCoins()
          renderMat()
          toast(overlay, r.ok ? (btn.dataset.act === 'buy' ? `购入 ${MATERIALS[id].name}` : `售出 ${MATERIALS[id].name}`) : `❌ ${r.reason}`)
        })
      })
    }

    const renderPill = () => {
      const box = $('#shop-pill', overlay)
      // 可购：配方丹 + 随机丹（基础品阶）
      const buyable = [
        ...Object.values(RECIPES),
        ...RANDOM_PILL_POOL,
      ]
      const ownedKeys = Object.keys(game.pills)
      const sellSection = ownedKeys.length > 0 ? `
        <p class="shop-section">我的丹药（出售）</p>
        ${ownedKeys.map(key => {
          const { id, grade } = game.parsePillKey(key)
          const info = game.getPillBase(id)
          const sell = pillSellPrice({ grade, baseGrade: info.baseGrade })
          return `
          <div class="shop-row">
            <div class="shop-info">
              <span class="bag-emoji">${info.emoji}</span>
              <span class="bag-name q${grade}">${info.name}</span>
              <span class="bag-sub q${grade}">${QUALITY_NAMES[grade]} · ×${game.pillCount(key)}</span>
            </div>
            <div class="shop-btns">
              <button class="shop-btn sell" data-key="${key}">卖 ${sell}💰</button>
            </div>
          </div>`
        }).join('')}` : ''

      const buySection = `
        <p class="shop-section">丹药铺（购买 · 基础品阶）</p>
        ${buyable.map(info => {
          const grade = info.baseGrade
          const buy = pillBuyPrice(info)
          return `
          <div class="shop-row">
            <div class="shop-info">
              <span class="bag-emoji">${info.emoji}</span>
              <span class="bag-name q${grade}">${info.name}</span>
              <span class="bag-sub q${grade}">${QUALITY_NAMES[grade]}</span>
            </div>
            <div class="shop-btns">
              <button class="shop-btn buy" data-buy="${info.id}">买 ${buy}💰</button>
            </div>
          </div>`
        }).join('')}`

      box.innerHTML = `<div class="shop-pill-wrap">${sellSection || '<p class="empty-hint">背包里还没有丹药可出售</p>'}${buySection}</div>`

      box.querySelectorAll('.shop-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.key) {
            const r = game.sellPill(btn.dataset.key)
            refreshCoins()
            renderPill()
            toast(overlay, r.ok ? '售出丹药' : `❌ ${r.reason}`)
          } else if (btn.dataset.buy) {
            const r = game.buyPill(btn.dataset.buy)
            refreshCoins()
            renderPill()
            toast(overlay, r.ok ? `购入 ${game.getPillBase(btn.dataset.buy).name}` : `❌ ${r.reason}`)
          }
        })
      })
    }

    const renderCodex = () => {
      const box = $('#shop-codex', overlay)
      const unknown = Object.values(RECIPES).filter(r => !game.codex[r.id])
      const known = Object.values(RECIPES).filter(r => game.codex[r.id])
      box.innerHTML = `
        ${unknown.length > 0 ? `
        <p class="shop-section">未收录丹方（打听后永久解锁图鉴）</p>
        ${unknown.map(r => {
          const price = codexPrice(r)
          return `
          <div class="shop-row">
            <div class="shop-info">
              <span class="bag-emoji">❓</span>
              <span class="bag-name">？？？</span>
              <span class="bag-sub">传闻需 ${r.materials.map(id => MATERIALS[id].name).join('、')}</span>
            </div>
            <div class="shop-btns">
              <button class="shop-btn buy" data-codex="${r.id}">打听 ${price}💰</button>
            </div>
          </div>`
        }).join('')}` : '<p class="empty-hint">全部丹方已收录 ✨</p>'}
        <p class="shop-section">已收录</p>
        <div class="codex-grid">
          ${known.map(r => `
            <div class="codex-card q${r.grade}">
              <div class="codex-emoji">${r.emoji}</div>
              <div class="codex-name">${r.name}</div>
              <div class="codex-grade q${r.grade}">${QUALITY_NAMES[r.grade]}</div>
            </div>`).join('')}
        </div>`

      box.querySelectorAll('[data-codex]').forEach(btn => {
        btn.addEventListener('click', () => {
          const r = game.buyCodex(btn.dataset.codex)
          refreshCoins()
          renderCodex()
          toast(overlay, r.ok ? `📜 打听到「${RECIPES[btn.dataset.codex].name}」丹方！` : `❌ ${r.reason}`)
        })
      })
    }

    overlay.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn))
        const map = { mat: '#shop-mat', pill: '#shop-pill', codex: '#shop-codex' }
        for (const [tab, sel] of Object.entries(map)) {
          $(sel, overlay).classList.toggle('hidden', btn.dataset.tab !== tab)
        }
      })
    })
    $('#close-shop', overlay).addEventListener('click', () => overlay.remove())
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove() })
    renderMat()
    renderPill()
    renderCodex()
  }

  // ---------- 图鉴 ----------
  const showCodex = () => {
    const overlay = document.createElement('div')
    overlay.className = 'modal col'
    const known = Object.values(RECIPES).filter(r => game.codex[r.id])
    const unknown = Object.values(RECIPES).filter(r => !game.codex[r.id])
    overlay.innerHTML = `
      <div class="codex">
        <h2>📜 丹方图鉴 <span class="codex-count">${known.length}/${Object.keys(RECIPES).length}</span></h2>
        <div class="codex-grid">
          ${known.map(r => `
            <div class="codex-card q${r.grade}">
              <div class="codex-emoji">${r.emoji}</div>
              <div class="codex-name">${r.name}</div>
              <div class="codex-grade q${r.grade}">${QUALITY_NAMES[r.grade]}</div>
              <div class="codex-mat">${r.materials.map(id => MATERIALS[id].emoji).join('+')}</div>
            </div>`).join('')}
          ${unknown.map(r => `
            <div class="codex-card unknown">
              <div class="codex-emoji">❓</div>
              <div class="codex-name">？？？</div>
              <div class="codex-mat">传闻需 ${r.materials.map(id => MATERIALS[id].name).join('、')}</div>
            </div>`).join('')}
        </div>
      </div>
      <button class="modal-btn close-btn" id="close-codex">关闭</button>`
    document.body.appendChild(overlay)
    $('#close-codex', overlay).addEventListener('click', () => overlay.remove())
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove()
    })
  }

  // ---------- 状态刷新 ----------
  game.on('select', () => {
    renderMaterialBar()
    renderSelectedPanel()
  })

  game.on('inventory', () => {
    renderTopbar()
    renderMaterialBar()
    renderSelectedPanel()
  })

  game.on('settle', () => renderTopbar())

  game.on('backToSelect', () => {
    renderTopbar()
    renderMaterialBar()
    renderSelectedPanel()
    const flame = $('#cauldron-flame')
    flame.classList.add('fire')
    $('#cauldron-caption').textContent = '丹炉火焰正旺'
    setTimeout(() => {
      flame.classList.remove('fire')
      $('#cauldron-caption').textContent = '丹炉微温，等待开炼'
    }, 2500)
  })

  // 首次渲染
  renderTopbar()
  renderMaterialBar()
  renderSelectedPanel()
}
