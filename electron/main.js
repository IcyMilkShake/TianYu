const { app, BrowserWindow } = require('electron')
const path = require('path')

let mainWindow = null

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  console.log('[main] Creating window...')
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

// ── IPC ───────────────────────────────────────────────────────────────────────
function send(channel, value) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, value)
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught:', err)
})

app.whenReady().then(() => {
  console.log('[main] App ready')
  createWindow()

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main] Page loaded')

    // Start persistent audio worker
    const worker = require('../core/recorder')

    worker.on('loading', (msg) => {
      console.log('[main] Worker loading:', msg)
      send('status', 'loading')
    })

    worker.on('ready', (msg) => {
      console.log('[main] Worker ready:', msg)
      send('status', 'idle')
    })

    worker.on('recording', () => {
      send('status', 'listening')
    })

    worker.on('transcribing', () => {
      send('status', 'processing')
    })

    worker.on('transcript', (text) => {
      console.log('[main] Transcript:', text)
      send('transcript', text)
    })

    worker.on('workerError', (msg) => {
      console.error('[main] Worker error:', msg)
      send('error', msg)
    })

    worker.on('exit', () => {
      send('error', 'Audio worker stopped unexpectedly')
    })

    // Start worker process
    worker.start()

    // Start hotkey listener
    try {
      const hotkey = require('../core/hotkey')
      hotkey.start(
        () => {
          if (!worker.ready) return
          worker.startRecording()
        },
        () => {
          if (!worker.ready) return
          worker.stopRecording()
        }
      )
      console.log('[main] Hotkey started')
    } catch (e) {
      console.error('[main] Hotkey error:', e.message)
      send('error', 'Hotkey failed: ' + e.message)
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