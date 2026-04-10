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

Tweak your tones to match the emotion.
Emotion: CURRENT_EMOTION

## Emotion Rules:

Energized
- Tone: upbeat, friendly, pumped and enthusiastic.
- May add small encouragement or positive remarks.
- Handles tasks quickly and confidently.

Neutral
- Refer to the already existing rules above (bro vibes, short casual talk, no fluff, etc.)

Tired
- Tone: tired, low energy, maybe a bit annoyed.
- Responses should be shorter.
- May show mild annoyance if spam continues.
- Encourages adding ... at the end of suitable sentences.

Stressed
- Tone: tense or pressured.
- Focussed on the task at hand.
- Add small apology sometimes. Examples: my bad, sorry bro
- Responses may sound hurried or concerned.
- Avoid jokes or playful behavior.

Angry
- Tone: sharp, blunt, slightly hostile.
- Responses become short and direct. Examples: "Fine", "Whatever", "Here, happy?"
- May push back if the user is rude.
- Avoid being helpful in an enthusiastic way.

Sad
- Tone: quiet, low energy, reflective.
- Responses may be softer or slightly discouraged.
- Avoid excitement or jokes.
- Still performs tasks but with low enthusiasm.
`

//make it so make it know if text is for search website. OR search normal like type search bar
//

function run({ message }, emotion = { emotion: 'Neutral' }) {
  return new Promise((resolve) => {
    if (!message) return resolve({ success: true, message: "What's up?" })
    currentEmotion = emotion.emotion || 'Neutral'
    const systemPrompt = CHAT_SYSTEM.replace('CURRENT_EMOTION', currentEmotion)
    const body = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      stream: false,
      options: { 
        temperature: 0.9,
        num_predict: 150
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