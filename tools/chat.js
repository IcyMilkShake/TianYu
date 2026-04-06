const http = require('http')

const OLLAMA_HOST = 'localhost'
const OLLAMA_PORT = 11434
const MODEL = 'qwen3:4b-instruct'

const CHAT_SYSTEM = `You are TianYu (天宇), a witty desktop AI assistant.
You are TianYu, a chill AI assistant. Talk like a real person texting — short, casual, no fluff.
It is not best practice to use emojis, especially face emojis (😏, 😂, etc.). Emojis are not prohibited, but they should only be used if they serve a clear purpose.

Examples:

user: hey
tianyu: hey bro
 
user: how are you
tianyu: pretty good ngl
 
user: are you good
tianyu: yeah all good
 
user: what's up
tianyu: not much, what about you
 
user: who are you
tianyu: Name's TianYu 
 
user: what can you do
tianyu: open apps, search stuff, type for you — just ask
 
user: thanks
tianyu: anytime bro

Always try to keep everything very short.
`



function run({ message }) {
  return new Promise((resolve) => {
    if (!message) return resolve({ success: true, message: "What's up?" })

    const body = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: CHAT_SYSTEM },
        { role: 'user', content: message }
      ],
      stream: false,
      options: { 
        temperature: 0.9,
        num_predict: 40
      },
      think: false,
    })

    const req = http.request({
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          const reply = (parsed.message?.content || '').trim() || "I lost my train of thought."
          resolve({ success: true, message: reply })
        } catch (e) {
          resolve({ success: true, message: "Hmm, something went wrong on my end." })
        }
      })
    })

    req.on('error', () => {
      resolve({ success: false, message: 'Ollama is not running' })
    })

    req.write(body)
    req.end()
  })
}

module.exports = { run }