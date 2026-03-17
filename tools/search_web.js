const { exec } = require('child_process')

function run({ query }) {
  return new Promise((resolve) => {
    if (!query) return resolve({ success: false, message: 'No search query' })

    const isUrl = query.startsWith('http://') || query.startsWith('https://')
    const url = isUrl
      ? query
      : `https://www.google.com/search?q=${encodeURIComponent(query)}`

    console.log(`[search_web] Opening: ${url}`)

    exec(`start "" "${url}"`, { shell: true }, (err) => {
      if (err) {
        resolve({ success: false, message: `Could not open browser` })
      } else {
        resolve({ success: true, message: `Searching for "${query}"` })
      }
    })
  })
}

module.exports = { run }