// ============================================================
// ui.js —— DOM 渲染与交互（不含游戏规则）
// Godot 移植：本文件由场景树 + Control 节点替代
// ============================================================

import { MATERIALS, RECIPES, JUDGE_STAGES, JUDGE_ZONES } from './data.js'
import { QUALITY_NAMES } from './judge.js'

const $ = (sel, root = document) => root.querySelector(sel)

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
      <button class="topbar-btn" id="codex-btn">📜 图鉴</button>
    `
    $('#codex-btn').addEventListener('click', showCodex)
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
      btn.className = 'material-btn' + (game.selected.includes(m.id) ? ' selected' : '')
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
        return `<span class="selected-chip" data-id="${id}">${m.emoji}${m.name}</span>`
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

  const judgeTrack = $('#judge-track')
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

    // 灵气波动（5% 概率，区间偏移 ±10）
    zoneOffset = Math.random() < 0.05 ? (Math.random() < 0.5 ? -10 : 10) : 0
    renderZones()
    if (zoneOffset !== 0) {
      judgeStatus.textContent = '⚡ 丹炉灵气波动！区间偏移！'
    }

    const period = stage.period * 1000
    const t0 = performance.now()
    cancelAnimationFrame(animId)
    const tick = (now) => {
      const phase = ((now - t0) % period) / period
      const base = phase < 0.5 ? phase * 200 : (1 - phase) * 200
      // 视觉抖动 ±4（GDD §5.3）
      currentPos = Math.min(100, Math.max(0, base + (Math.random() - 0.5) * 4))
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
      if (next) {
        startJudge(next)
      } else {
        // 结算由 settle 事件驱动
      }
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
          <p class="settle-reward">💰 +${result.rewardCoins} 金币 · 返还素材 ×${result.rewardMaterials.length}</p>
          <button class="modal-btn" id="again-btn">再炼一炉</button>
          <button class="modal-btn ghost" id="codex-btn2">📜 图鉴</button>
        </div>`
    }
    overlay.innerHTML = content
    document.body.appendChild(overlay)
    $('#again-btn', overlay)?.addEventListener('click', () => {
      overlay.remove()
      game.backToSelect()
    })
    $('#codex-btn2', overlay)?.addEventListener('click', () => {
      overlay.remove()
      game.backToSelect()
      showCodex()
    })
  }

  game.on('settle', (result) => {
    judgeView.classList.remove('active')
    mainView.classList.remove('hidden')
    setTimeout(() => showSettle(result), 700)
  })

  // ---------- 图鉴 ----------
  const showCodex = () => {
    const overlay = document.createElement('div')
    overlay.className = 'modal'
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
        <button class="modal-btn" id="close-codex">关闭</button>
      </div>`
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
