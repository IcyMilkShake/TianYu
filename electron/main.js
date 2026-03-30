const { app, BrowserWindow, screen } = require('electron')
const path = require('path')

let mainWindow = null
let bubbleWindow = null

// ── Main window ───────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    title: 'TianYu',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  mainWindow.webContents.openDevTools()
}

// ── Bubble window ─────────────────────────────────────────────────────────────
function createBubbleWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  console.log('[bubble] Screen size:', width, height)

  bubbleWindow = new BrowserWindow({
    width: 380,
    height: 220,
    x: width - 400,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'bubble_preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const bubblePath = path.join(__dirname, 'bubble.html')
  console.log('[bubble] Loading:', bubblePath)
  bubbleWindow.loadFile(bubblePath)
  bubbleWindow.hide()
  
  bubbleWindow.webContents.on('did-finish-load', () => {
    console.log('[bubble] Loaded OK')
  })
  bubbleWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('[bubble] Load failed:', code, desc)
  })
}

// ── IPC ───────────────────────────────────────────────────────────────────────
function send(channel, value) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, value)
  }
}

let bubbleTimer = null

const BUBBLE_SIZES = {
  small:  { w: 380, h: 206 },
  medium: { w: 320, h: 199 },
  large:  { w: 300, h: 287 },
}

function pickBubbleSize(len) {
  if (len <= 60)  return BUBBLE_SIZES.small
  if (len <= 140) return BUBBLE_SIZES.medium
  return BUBBLE_SIZES.large
}

function showBubble(message, emotion = 'neutral') {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return
  clearTimeout(bubbleTimer)

  const { width } = screen.getPrimaryDisplay().workAreaSize
  const size = pickBubbleSize(message.length)

  bubbleWindow.setSize(size.w, size.h)
  bubbleWindow.setPosition(width - size.w - 20, 20)
  bubbleWindow.showInactive()
  bubbleWindow.webContents.send('bubble', { message, emotion, windowW: size.w, windowH: size.h })

  const duration = Math.max(3000, 3000 + Math.floor(message.length / 20) * 1000)
  bubbleTimer = setTimeout(() => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      bubbleWindow.webContents.send('bubble-hide')
      setTimeout(() => {
        if (bubbleWindow && !bubbleWindow.isDestroyed()) bubbleWindow.hide()
      }, 400)
    }
  }, duration)
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught:', err)
})

app.whenReady().then(() => {
  console.log('[main] App ready')
  createWindow()
  createBubbleWindow()

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main] Page loaded')

    // Scan installed apps in background
    setTimeout(() => {
      try { require('../core/app_finder').scanApps() } catch (e) {}
    }, 2000)

    // Start audio worker
    const worker = require('../core/recorder')

    worker.on('loading',  (msg) => { send('status', 'loading'); console.log('[main]', msg) })
    worker.on('ready',    (msg) => { send('status', 'idle');    console.log('[main]', msg) })
    worker.on('recording',    () => send('status', 'listening'))
    worker.on('transcribing', () => send('status', 'processing'))

    worker.on('transcript', async (text) => {
      console.log('[main] Transcript:', text)
      send('transcript', text)

      try {
        const { think }   = require('../core/llm')
        const { execute } = require('../core/executor')
        const { getEmotion } = require('../core/emotion')

        send('status', 'thinking')
        const toolCall = await think(text)

        send('status', 'executing')
        const result = await execute(toolCall)

        console.log('[main] Result:', result)
        send('result', { tool: toolCall.tool, ...result })

        // Show speech bubble with emotion
        if (result.message) {
          const emotion = getEmotion(toolCall.tool, result.success)
          showBubble(result.message, emotion)
        }

      } catch (err) {
        console.error('[main] Error:', err.message)
        send('error', err.message)
        showBubble(err.message, 'stressed')
      }
    })

    worker.on('workerError', (msg) => { send('error', msg); showBubble(msg, 'angry') })
    worker.on('exit', () => send('error', 'Audio worker stopped'))

    worker.start()

    try {
      const hotkey = require('../core/hotkey')
      hotkey.start(
        () => { if (worker.ready) worker.startRecording() },
        () => { if (worker.ready) worker.stopRecording() }
      )
      console.log('[main] Hotkey started')
    } catch (e) {
      console.error('[main] Hotkey error:', e.message)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  try { require('../core/recorder').stop() } catch (e) {}
  try { require('../core/hotkey').stop() } catch (e) {}
  if (process.platform !== 'darwin') app.quit()
})