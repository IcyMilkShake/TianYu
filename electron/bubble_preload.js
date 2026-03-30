const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onBubble:     (cb) => ipcRenderer.on('bubble',      (_e, v) => cb(v)),
  onBubbleHide: (cb) => ipcRenderer.on('bubble-hide', (_e, v) => cb(v)),
})