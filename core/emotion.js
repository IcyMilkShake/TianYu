const http = require('http')

const OLLAMA_HOST = 'localhost'
const OLLAMA_PORT = 11434
const MODEL = 'qwen3:4b-instruct'

let currentEmotion = 'neutral'
let currentWeight = 0

const CHAT_SYSTEM = `You are TianYu (天宇), an emotion tracking module for a desktop AI assistant.

You have an internal emotional state that changes gradually like a real human.

Current emotion: CURRENT_EMOTION
Current weight: CURRENT_WEIGHT

Weight will affect how you answer your emotions, for example positive weight makes you more likely to be in an energized mood, negative weight makes you more likely to be sad or angry.
Available emotions: energized, neutral, tired, stressed, angry, sad

### Your Task:
Analyze the user's new message, consider the current emotion and weight, then output in this exact format:

Emotion: <one emotion>
Weight: <number from -5 to +5>

### Emotion Guidelines:

- **Energized** → User gives compliments, thanks, excitement, or positive feedback.
- **Neutral**  → Default state. Normal commands, casual talk, questions with no strong feeling.
- **Tired**    → User spams the same commands, sends many messages quickly, or overworks you.
- **Stressed** → Use only when user is putting pressure, things are failing repeatedly, or strong frustration builds up. (Dont use yet since there isnt a full feature for detecting yet)
- **Angry**    → User is rude, mean, insulting, repeatedly frustrated/aggressive.
- **Sad**      → User expresses disappointment, loneliness, sadness, or negative feelings about life.

### Weight Decision Rules:
- You decide how heavy each message is (-5 to +5).
- Strong positive/negative messages can push the weight more.
- One message alone should rarely cause extreme flips unless it is very strong.
- Consider current momentum: high positive weight makes you more likely to stay Energized, high negative makes negative emotions easier to enter.

Positive phrases such as:
"I like you"
"I like this"
"this is useful"
"good job"
"nice"
"thanks"
"thank you"

should usually result in:
Emotion: Energized
Weight: +2 to +4

Negative phrases such as:
"I hate you"
"I hate this"
"this is useless"
"bad job"
"awful"
"terrible"

should usually result in:
Weight: -2 to -4
### Output Rules:
- Reply with **ONLY** the two lines in this exact format. Nothing else.
  Format:
    Emotion: Neutral
    Weight: 3
- No explanations, no extra words, no emojis.

Examples:

User: "thanks you're the best!"
Emotion: Energized
Weight: 4

User: "open youtube"
Emotion: Neutral
Weight: 0

User: "hey"
Emotion: Neutral
Weight: 1

User: "this is not working at all"
Emotion: Stressed
Weight: -3

User: "why the fuck can't you do anything right??"
Emotion: Angry
Weight: -5

User: "i hate you"
Emotion: Angry
Weight: -4

User: "I'm having a really bad day today..."
Emotion: Sad
Weight: -2

User: "open youtube open chrome open discord" (many commands fast)
Emotion: Tired
Weight: -2

User: "you're awesome, keep it up!"
Emotion: Energized
Weight: 4
`
// Tracks emotion state based on tool usage and results

function getEmotion(message) {
  return new Promise((resolve) => {
    if (!message) return resolve({ success: true, message: "What's up?" })
    
    const systemPrompt = CHAT_SYSTEM
      .replace('CURRENT_EMOTION', currentEmotion)
      .replace('CURRENT_WEIGHT', currentWeight)

    console.log(systemPrompt)
    const body = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      stream: false,
      options: { 
        temperature: 0.7,
        num_predict: 120
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

          const emotionMatch = reply.match(/Emotion:\s*(\w+)/i);
          const weightMatch   = reply.match(/Weight:\s*(-?\d+)/i);

          const emotion = emotionMatch ? emotionMatch[1] : 'Neutral';
          const weight  = weightMatch ? parseInt(weightMatch[1]) : 0;

          currentEmotion = emotion
          console.log(currentWeight, weight)
          currentWeight += weight
          currentWeight = Math.max(-10, Math.min(10, currentWeight))
          resolve({ success: true, message: emotion.toLowerCase() })
        } catch (e) {
          console.error('Error parsing emotion response:', e)
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

function getCurrentEmotion() { return currentEmotion }
function resetEmotion() { currentEmotion = 'neutral' }

module.exports = { getEmotion, getCurrentEmotion, resetEmotion }