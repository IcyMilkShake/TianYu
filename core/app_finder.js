const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const USER = os.homedir()

const SCAN_DIRS = [
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  path.join(USER, 'AppData\\Local'),
  path.join(USER, 'AppData\\Roaming'),
  path.join(USER, 'AppData\\Local\\Programs'),
]

let appCache = null

function scanApps() {
  if (appCache) return appCache

  const found = {}

  // 1. Scan local, roaming, programs folder
  for (const dir of SCAN_DIRS) {
    if (!fs.existsSync(dir)) continue
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const subdir = path.join(dir, entry.name)
        try {
          const files = fs.readdirSync(subdir)
          for (const file of files) {
            if (file.toLowerCase().endsWith('.exe')) {
              const name = file.replace(/\.exe$/i, '').toLowerCase()
              if (!found[name]) found[name] = path.join(subdir, file)
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  // 2. Registry scan
  try {
    const result = execSync(
      `reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths" /s`,
      { encoding: 'utf8', timeout: 5000 }
    )
    const lines = result.split('\n')
    let currentApp = null
    for (const line of lines) {
      const keyMatch = line.match(/App Paths\\(.+?)$/i)
      if (keyMatch) currentApp = keyMatch[1].replace(/\.exe$/i, '').toLowerCase().trim()
      if (currentApp && line.includes('REG_SZ') && line.includes('.exe')) {
        const pathMatch = line.match(/REG_SZ\s+(.+\.exe)/i)
        if (pathMatch) { found[currentApp] = pathMatch[1].trim(); currentApp = null }
      }
    }
  } catch (e) {}

  // 3. finding .lnk files
  try {
    const startDirs = [
      'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
      path.join(USER, 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs'),
    ]
    for (const dir of startDirs) {
      if (!fs.existsSync(dir)) continue
      const files = fs.readdirSync(dir, { recursive: true })
      for (const file of files) {
        if (file.toString().toLowerCase().endsWith('.lnk')) {
          const name = path.basename(file.toString(), '.lnk').toLowerCase()
          if (!found[name]) found[name] = 'shortcut:' + path.join(dir, file.toString())
        }
      }
    }
  } catch (e) {}

  appCache = found
  console.log(`[app_finder] Indexed ${Object.keys(found).length} apps`)
  return found
}

// Returns a compact string summary for Qwen's context
function getAppListForLLM() {
  const apps = scanApps()
  return Object.keys(apps)
    .filter(k => !k.includes('unins') && !k.includes('setup') && !k.includes('update'))
    .sort()
    .join(', ')
}

function findApp(name) {
  const apps = scanApps()
  const key = name.toLowerCase().trim()
  if (apps[key]) return apps[key]
  const partial = Object.keys(apps).find(k => k.includes(key) || key.includes(k))
  return partial ? apps[partial] : null
}

function refreshCache() {
  appCache = null
  return scanApps()
}

module.exports = { scanApps, findApp, getAppListForLLM, refreshCache }