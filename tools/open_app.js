const { exec } = require('child_process')
const { findApp } = require('../core/app_finder')

function launch(target) {
  return new Promise((resolve) => {
    let cmd
    if (target.startsWith('shortcut:')) {
      cmd = `start "" "${target.replace('shortcut:', '')}"`
    } else if (!target.includes('\\') && !target.includes('/')) {
      cmd = `start ${target}`
    } else {
      cmd = `start "" "${target}"`
    }
    console.log('[open_app] CMD:', cmd)
    exec(cmd, { shell: true }, (err) => resolve(!err))
  })
}

async function run({ app, exe }) {
  if (!app) return { success: false, message: 'No app specified' }

  // 1. Qwen gave us an exe name — look it up in scanned apps
  if (exe) {
    const found = findApp(exe.replace(/\.exe$/i, ''))
    if (found) {
      console.log(`[open_app] Qwen-guided launch: ${found}`)
      const ok = await launch(found)
      if (ok) return { success: true, message: `Opening ${app}` }
    }
  }

  // 2. Try app name directly in scanned apps
  const found = findApp(app)
  if (found) {
    console.log(`[open_app] Scan match: ${found}`)
    const ok = await launch(found)
    if (ok) return { success: true, message: `Opening ${app}` }
  }

  // 3. PowerShell fallback
  console.log(`[open_app] PowerShell fallback: ${app}`)
  return new Promise((resolve) => {
    exec(`powershell -command "Start-Process '${app}'"`, { shell: true }, (err) => {
      if (err) resolve({ success: false, message: `Could not find "${app}"` })
      else resolve({ success: true, message: `Opening ${app}` })
    })
  })
}

module.exports = { run }