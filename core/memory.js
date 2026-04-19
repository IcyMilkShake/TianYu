const MAX = 10
//10 history only
let history = []

function add(userText, assistantText) {
  history.push({ role: 'user',      content: userText,      timestamp: Date.now() })
  history.push({ role: 'system', content: assistantText, timestamp: Date.now() })

  if (history.length > MAX * 2) {
    history = history.slice(history.length - MAX * 2)
  }
}

function getMessages() {
  return history.map(({ role, content }) => ({ role, content }))
}

function clear() { history = [] }
function size()  { return Math.floor(history.length / 2) }

module.exports = { add, getMessages, clear, size }