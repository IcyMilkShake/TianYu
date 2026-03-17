const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onStatus:     (cb) => ipcRenderer.on('status',     (_e, v) => cb(v)),
  onTranscript: (cb) => ipcRenderer.on('transcript', (_e, v) => cb(v)),
  onResult:     (cb) => ipcRenderer.on('result',     (_e, v) => cb(v)),
  onError:      (cb) => ipcRenderer.on('error',      (_e, v) => cb(v)),
})