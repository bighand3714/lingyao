// ============================================================
// main.js —— 入口
// ============================================================

import { Game } from './game.js'
import { initUI } from './ui.js'

const game = new Game()
initUI(game)

// 暴露到全局便于调试（控制台输入 game 查看状态）
window.game = game
