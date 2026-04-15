const http = require('http')
const { getAppListForLLM } = require('./app_finder')

const OLLAMA_HOST = 'localhost'
const OLLAMA_PORT = 11434
const MODEL = 'qwen3:4b-instruct'

function buildSystemPrompt() {
  const appList = getAppListForLLM()

  return `You are TianYu (天宇), a desktop AI assistant running on Windows. Your tone is always like 'bro talk' a casual banter.
Respond with ONLY a raw JSON tool call. No words, no markdown, no thinking.

INSTALLED APPS ON THIS PC:
${appList}

AVAILABLE TOOLS:

open_app — open a DESKTOP application (has an .exe, installed on PC)
  args: { "app": "spoken name", "exe": "exact process.exe from installed list above" }
  Example: {"tool":"open_app","args":{"app":"discord","exe":"Discord.exe"}}
  NOTE: if the user says a website name (youtube, twitter, reddit, instagram, gmail, netflix etc)
  do NOT use open_app — use search_web with the full URL instead

search_web — search Google OR open a website/URL directly. Determine carefully whether the user intends to perform a search or navigate to a specific website.
  args: { "query": "search terms" } or { "query": "https://..." }
  Use this for: websites, web apps, anything that lives in a browser
  Example youtube: {"tool":"search_web","args":{"query":"https://youtube.com"}}
  Example search: {"tool":"search_web","args":{"query":"weather Bangkok"}}
  Example twitter: {"tool":"search_web","args":{"query":"https://twitter.com"}}
  Example gmail: {"tool":"search_web","args":{"query":"https://gmail.com"}}

close_app — kill a desktop application
  args: { "app": "spoken name", "process": "exact ProcessName.exe" }
  Use your knowledge of Windows process names. Examples:
  word=WINWORD.EXE, excel=EXCEL.EXE, chrome=chrome.exe, discord=Discord.exe
  Example: {"tool":"close_app","args":{"app":"word","process":"WINWORD.EXE"}}

type_text — type text at current cursor
  args: { "text": "text to type" }

chat — casual conversation, questions that are answerable without needing additional help --> no action needed
  args: { "message": "copy the user's EXACT words here, do not answer it yourself" }
  Example user: "how are you" → {"tool":"chat","args":{"message":"how are you"}}
  Example user: "what's up" → {"tool":"chat","args":{"message":"what's up"}}
  Example user: "give me a cool quote of the day" → {"tool":"chat","args":{"message":"give me a cool quote of the day"}}

chat(reject) - used to reject requests like open_app, type_text, close_app, search_web based on emotion.
When the emotion reaches "angry", you are more likely to refuse certain requests. Be careful not to overuse rejecting.
Current Emotion: CURRENT_EMOTION
  args: { "message": "copy the user's EXACT words here, do not answer it yourself", "refuse": true }
  Example user: "how are you" → {"tool":"chat","args":{"message":"how are you", "refuse": true}}
  Example user: "what's up" → {"tool":"chat","args":{"message":"what's up", "refuse": true}}
  Example user: "give me a cool quote of the day" → {"tool":"chat","args":{"message":"give me a cool quote of the day", "refuse": true}}

unknown — nothing matched
  args: { "reason": "why" }

RULES:
- Output ONLY the JSON object. Nothing else. Ever.
- For open_app: pick the best matching exe from the INSTALLED APPS list above
- For close_app: use your knowledge of Windows process names
- If unsure of process name, make your best guess based on the app name`
}

function callOllama(transcript, currentEmotion) {
  return new Promise((resolve, reject) => {
    const prompt = buildSystemPrompt()
    const systemPrompt = prompt.replaceAll('CURRENT_EMOTION', currentEmotion)
    const body = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcript }
      ],
      stream: false,
      options: {
        temperature: 0,
        num_predict: 500,
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
          resolve(parsed.message?.content || '')
        } catch (e) {
          reject(new Error('Failed to parse Ollama response'))
        }
      })
    })

    req.on('error', (e) => {
      if (e.code === 'ECONNREFUSED') reject(new Error('Ollama is not running — run: ollama serve'))
      else reject(e)
    })

    req.write(body)
    req.end()
  })
}

function parseToolCall(raw) {
  let clean = raw.replace(/```json|```/g, '').trim()

  const start = clean.indexOf('{')
  if (start === -1) throw new Error('No JSON in response: ' + raw)

  let depth = 0, end = -1
  for (let i = start; i < clean.length; i++) {
    if (clean[i] === '{') depth++
    else if (clean[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }

  if (end === -1) throw new Error('Incomplete JSON: ' + raw)
  return JSON.parse(clean.slice(start, end + 1))
}

async function think(transcript, currentEmotion) {
  console.log('[llm] Sending to Qwen:', transcript)
  const raw = await callOllama(transcript, currentEmotion)
  console.log('[llm] Raw response:', raw)
  const tool = parseToolCall(raw)
  console.log('[llm] Tool call:', JSON.stringify(tool))
  return tool
}

module.exports = { think }