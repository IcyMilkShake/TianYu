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

const BUBBLES = {
  small:  { src: '../assets/bubble.png',  w: 320, h: Math.round(320 * 541 / 1000) },
  medium: { src: '../assets/bubble2.png', w: 320, h: Math.round(320 * 621 / 1000) },
  large:  { src: '../assets/bubble3.png', w: 320, h: Math.round(320 * 955 / 1000) },
}

function pickBubble(len) {
  if (len <= 60)  return BUBBLES.small
  if (len <= 140) return BUBBLES.medium
  return BUBBLES.large
}

function createBubbleWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  bubbleWindow = new BrowserWindow({
    type: 'toolbar',
    hasShadow: false,
    width: BUBBLES.small.w,
    height: BUBBLES.small.h,
    x: width - BUBBLES.small.w - 20,
    y: 20,
    offscreen: false,
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

  bubbleWindow.loadFile(path.join(__dirname, 'bubble.html'))
  bubbleWindow.setIgnoreMouseEvents(true)
  bubbleWindow.hide()
}

// ── IPC ───────────────────────────────────────────────────────────────────────
function send(channel, value) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, value)
  }
}

let bubbleTimer = null

function showBubble(message, emotion = 'neutral') {
  if (!bubbleWindow || bubbleWindow.isDestroyed()) return
  clearTimeout(bubbleTimer)

  const { width } = screen.getPrimaryDisplay().workAreaSize
  const bubble = pickBubble(message.length)

  bubbleWindow.setSize(bubble.w, bubble.h)
  bubbleWindow.setPosition(width - bubble.w - 20, 20)
  bubbleWindow.showInactive()

  //Make top level bubble
  bubbleWindow.setAlwaysOnTop(true, 'screen-saver')
  bubbleWindow.moveTop()
  
  bubbleWindow.webContents.send('bubble', { message, emotion, bubbleSrc: bubble.src })
  console.log("sent")
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

    setTimeout(() => {
      try { require('../core/app_finder').scanApps() } catch (e) {}
    }, 2000)

    const worker = require('../core/recorder')

    worker.on('loading',      (msg) => { send('status', 'loading'); console.log('[main]', msg) })
    worker.on('ready',        (msg) => { send('status', 'idle');    console.log('[main]', msg) })
    worker.on('recording',    ()    => send('status', 'listening'))
    worker.on('transcribing', ()    => send('status', 'processing'))

    worker.on('transcript', async (text) => {
      console.log('[main] Transcript:', text)
      send('transcript', text)

      try {
        const { think }      = require('../core/llm')
        const { execute }    = require('../core/executor')
        const { getEmotion } = require('../core/emotion')

        send('status', 'thinking')
        const toolCall = await think(text)

        send('status', 'executing')
        const result = await execute(toolCall)

        console.log('[main] Result:', result)
        send('result', { tool: toolCall.tool, ...result })

        if (result.message) {
          const emotion = await getEmotion(text)
          console.log('[main] Emotion:', emotion)
          showBubble(result.message, emotion)
          console.log("bubble shown with emotion:", emotion)
        }

      } catch (err) {
        console.error('[main] Error:', err.message)
        send('error', err.message)
        showBubble(err.message, 'stressed')
      }
    })

    worker.on('workerError', (msg) => { send('error', msg); showBubble(msg, 'angry') })
    worker.on('exit',        ()    => send('error', 'Audio worker stopped'))

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