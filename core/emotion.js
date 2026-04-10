const http = require('http')

const OLLAMA_HOST = 'localhost'
const OLLAMA_PORT = 11434
const MODEL = 'qwen3:4b-instruct'

let currentEmotion = 'neutral'
let currentWeight = 0

// ─────────────────────────────────────────────
// PROMPT 1 — score the message, output weight only
// ─────────────────────────────────────────────
const SCORE_SYSTEM = `You are a sentiment scorer.

Read the user's message and output ONE line only:
Weight: [number]

The number must be an integer from -5 to 5.

### Scoring Rules:
- Big compliment, warm thanks, very positive → +4 or +5
- Positive, friendly → +2 or +3
- Slightly positive → +1
- Neutral (commands, "hi", "okay", tasks) → 0
- Slightly negative, mild frustration → -1
- Negative, frustrated → -2 or -3
- Rude, insulting, strong anger → -4 or -5

+4/+5 and -4/-5 are rare. Only for very strong messages.
Output ONLY the one line. No explanation. Nothing else.

### Examples:
User: "open youtube"                         → Weight: 0
User: "hey"                                  → Weight: 1
User: "that's exactly what I needed"         → Weight: 2
User: "that was fast, thanks"                → Weight: 3
User: "you're honestly so helpful"           → Weight: 4
User: "i don't know what i'd do without you" → Weight: 5
User: "this is taking forever"               → Weight: -1
User: "that's not what I asked for"          → Weight: -2
User: "you keep getting this wrong"          → Weight: -3
User: "you're useless"                       → Weight: -4
User: "why the fuck can't you do anything right??" → Weight: -5
`

// ─────────────────────────────────────────────
// PROMPT 2 — pick emotion from weight alone
// ─────────────────────────────────────────────
const EMOTION_SYSTEM = `You are TianYu (天宇), an emotion tracking module.

Your only job: pick one emotion based on the Current weight number below.

Current weight: CURRENT_WEIGHT

---

## Emotion table — follow this strictly

| Current weight | Emotion |
|---|---|
| +4 to +10 | Energized |
| +1 to +3 | Neutral |
| 0 | Neutral |
| -1 to -3 | Sad |
| -4 to -6 | Stressed |
| -7 to -10 | Angry |

IMPORTANT RULES:
- Tired and Stressed from overwork require conversation history you do not have. Do NOT use Tired unless you have clear evidence of spamming/repetition. Default to Sad or Stressed instead.
- If weight is -4 or lower, you MUST NOT output Neutral or Energized. Ever.
- If weight is +1 or higher, you MUST NOT output Angry, Stressed, Sad, or Tired.
- The weight is already computed. Do not second-guess it. Just look it up in the table.

Output ONLY one line. Nothing else.
Emotion: [emotion]

---

## Examples

Current weight: 8  → Emotion: Energized
Current weight: 5  → Emotion: Energized
Current weight: 3  → Emotion: Neutral
Current weight: 1  → Emotion: Neutral
Current weight: 0  → Emotion: Neutral
Current weight: -1 → Emotion: Sad
Current weight: -3 → Emotion: Sad
Current weight: -4 → Emotion: Stressed
Current weight: -6 → Emotion: Stressed
Current weight: -7 → Emotion: Angry
Current weight: -10 → Emotion: Angry
`

function callOllama(systemPrompt, userMessage) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage }
      ],
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 20
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
          resolve((parsed.message?.content || '').trim())
        } catch (e) {
          resolve('')
        }
      })
    })

    req.on('error', () => resolve(null))
    req.write(body)
    req.end()
  })
}

async function getEmotion(message) {
  if (!message) return { success: true, message: "What's up?" }

  // ── Call 1: score the message ──
  const scoreReply = await callOllama(SCORE_SYSTEM, message)
  if (scoreReply === null) return { success: false, message: 'Ollama is not running' }

  const weightMatch = scoreReply.match(/Weight:\s*(-?\d+)/i)
  const score = weightMatch ? Math.max(-5, Math.min(5, parseInt(weightMatch[1]))) : 0

  currentWeight += score
  currentWeight = Math.max(-10, Math.min(10, currentWeight))

  console.log(`score=${score}  weight=${currentWeight}`)

  // ── Call 2: pick emotion from updated weight only ──
  // Pass weight as the user message so the model focuses on it alone
  const emotionPrompt = EMOTION_SYSTEM.replace('CURRENT_WEIGHT', currentWeight)
  const emotionReply = await callOllama(emotionPrompt, `Current weight: ${currentWeight}`)

  const emotionMatch = emotionReply.match(/Emotion:\s*(\w+)/i)
  const emotion = emotionMatch ? emotionMatch[1] : 'Neutral'

  currentEmotion = emotion
  console.log(`emotion=${currentEmotion}`)

  return { success: true, message: emotion.toLowerCase() }
}

function getCurrentEmotion() { return currentEmotion }
function resetEmotion() { currentEmotion = 'neutral'; currentWeight = 0 }

module.exports = { getEmotion, getCurrentEmotion, resetEmotion }