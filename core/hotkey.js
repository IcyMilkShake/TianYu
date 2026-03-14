const { UiohookKey, uIOhook } = require('uiohook-napi')

// Right Alt keycode
const RIGHT_ALT = UiohookKey.AltRight

class HotkeyManager {
  constructor() {
    this.isHeld = false
    this.onPressCallback = null
    this.onReleaseCallback = null
  }

  start(onPress, onRelease) {
    this.onPressCallback = onPress
    this.onReleaseCallback = onRelease

    uIOhook.on('keydown', (event) => {
      if (event.keycode === RIGHT_ALT && !this.isHeld) {
        this.isHeld = true
        console.log('[hotkey] Right Alt pressed — recording start')
        if (this.onPressCallback) this.onPressCallback()
      }
    })

    uIOhook.on('keyup', (event) => {
      if (event.keycode === RIGHT_ALT && this.isHeld) {
        this.isHeld = false
        console.log('[hotkey] Right Alt released — recording stop')
        if (this.onReleaseCallback) this.onReleaseCallback()
      }
    })

    uIOhook.start()
    console.log('[hotkey] Listening for Right Alt...')
  }

  stop() {
    uIOhook.stop()
  }
}

module.exports = new HotkeyManager()