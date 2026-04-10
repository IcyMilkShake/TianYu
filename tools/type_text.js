const { exec } = require('child_process')

function run({ text }, emotion) {
  return new Promise((resolve) => {
    if (!text) return resolve({ success: false, message: 'No text to type' })

    // Use PowerShell SendKeys to type text at current cursor position
    const escaped = text.replace(/'/g, "''")
    const cmd = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')"`

    console.log(`[type_text] Typing: ${text}`)

    exec(cmd, (err) => {
      if (err) {
        resolve({ success: false, message: `Could not type text` })
      } else {
        resolve({ success: true, message: `Typed: "${text}"` })
      }
    })
  })
}

module.exports = { run }