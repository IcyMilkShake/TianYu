const { exec } = require('child_process')

async function run({ app, process: procName }) {
  if (!app) return { success: false, message: 'No app specified' }

  // Qwen tells us the process name — use it directly
  const target = procName || (app + '.exe')
  console.log(`[close_app] Killing: ${target}`)

  return new Promise((resolve) => {
    exec(`taskkill /F /IM "${target}"`, (err) => {
      if (err) {
        // Fallback — wildcard search via PowerShell
        const keyword = app.replace(/\s+/g, '*')
        exec(
          `powershell -command "Get-Process | Where-Object {$_.Name -like '*${keyword}*'} | Stop-Process -Force"`,
          (err2) => {
            if (err2) resolve({ success: false, message: `Could not close "${app}" — is it running?` })
            else resolve({ success: true, message: `Closed ${app}` })
          }
        )
      } else {
        resolve({ success: true, message: `Closed ${app}` })
      }
    })
  })
}

module.exports = { run }