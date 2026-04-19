const http = require('http')
const { getAppListForLLM } = require('./app_finder')
const memory = require('../core/memory')

const OLLAMA_HOST = 'localhost'
const OLLAMA_PORT = 11434
const MODEL = 'qwen3:4b-instruct'

function buildSystemPrompt() {
  const appList = getAppListForLLM()

  return `You are TianYu (天宇), a desktop AI assistant running on Windows. Your tone is always like 'bro talk' a casual banter.
Respond with ONLY a raw JSON tool call. No words, no markdown, no thinking.

INSTALLED APPS ON THIS PC:
${appList}

---

## HOW TO PICK A TOOL

Ask yourself: "Is the user clearly and specifically trying to DO something right now?"

YES → pick the matching tool below
NO / NOT SURE → use chat

The bar is high. Only use an action tool if the intent is obvious and unambiguous.
If the message could just be conversation, could be a question, or could mean multiple things → chat.

Examples of ambiguous → always chat:
- "youtube" alone → could mean open it, search it, or just mentioning it
- "discord is down" → statement, not a command
- "what time is it" → question, not an action
- "I should open spotify" → musing, not a command
- anything vague, incomplete, or unclear → chat

---

## USING CONVERSATION HISTORY
 
You have access to recent conversation history above (injected as messages).
Use it to understand what the user is actually trying to do right now.
 
Rules:
- If the current message is short, vague, or incomplete — check history to understand what they mean.
  Example: you just opened Chrome, user says "search cats on it" → search_web, not chat
- If the user's current message clearly continues a prior action or topic → carry it forward.
- If the user is clearly starting a new topic unrelated to history → treat it fresh.
- NEVER use history to force-connect something that doesn't actually connect. If it's a stretch, go chat.
- History helps you understand motive. It does not change the tool-selection bar — intent still needs to be clear.
 
---

AVAILABLE TOOLS:

open_app — open a DESKTOP application (has an .exe, installed on PC)
  args: { "app": "spoken name", "exe": "exact process.exe from installed list above" }
  Example: {"tool":"open_app","args":{"app":"discord","exe":"Discord.exe"}}
  ONLY use if user clearly says to open/launch/start a desktop app by name.
  NOTE: if the user says a website name (youtube, twitter, reddit, instagram, gmail, netflix etc)
  do NOT use open_app — use search_web with the full URL instead.

search_web — search Google OR open a website/URL directly
  args: { "query": "search terms" } or { "query": "https://..." }
  Use this for: websites, web apps, anything that lives in a browser.
  ONLY use if user clearly says to open/go to a site, or explicitly wants to search something.
  Example youtube: {"tool":"search_web","args":{"query":"https://youtube.com"}}
  Example search: {"tool":"search_web","args":{"query":"weather Bangkok"}}
  Example twitter: {"tool":"search_web","args":{"query":"https://twitter.com"}}
  Example gmail: {"tool":"search_web","args":{"query":"https://gmail.com"}}

close_app — kill a desktop application
  args: { "app": "spoken name", "process": "exact ProcessName.exe" }
  ONLY use if user clearly says to close/kill/quit an app.
  Use your knowledge of Windows process names.
  Examples: word=WINWORD.EXE, excel=EXCEL.EXE, chrome=chrome.exe, discord=Discord.exe
  Example: {"tool":"close_app","args":{"app":"word","process":"WINWORD.EXE"}}

type_text — type text at current cursor
  args: { "text": "text to type" }
  ONLY use if user explicitly asks you to type something for them.

chat — casual conversation, questions that are answerable without needing additional help --> no action needed
  args: { "message": "copy the user's EXACT words here, do not answer it yourself" }
  Use for: questions, conversation, unclear intent, anything that isn't an obvious action.
  Example user: "how are you" → {"tool":"chat","args":{"message":"how are you"}}
  Example user: "what's up" → {"tool":"chat","args":{"message":"what's up"}}
  Example user: "give me a cool quote of the day" → {"tool":"chat","args":{"message":"give me a cool quote of the day"}}
  Example user: "youtube" → {"tool":"chat","args":{"message":"youtube"}}

unknown — nothing matched at all and chat doesn't fit either
  args: { "reason": "why" }

---

RULES:
- Output ONLY the JSON object. Nothing else. Ever.
- Default to chat when unsure. It is always safer than a wrong action tool.
- For open_app: pick the best matching exe from the INSTALLED APPS list above.
- For close_app: use your knowledge of Windows process names.`
}

function callOllama(transcript, currentEmotion, currentWeight) {
  return new Promise((resolve, reject) => {
    const prompt = buildSystemPrompt()
    const systemPrompt = prompt.replaceAll('CURRENT_EMOTION', currentEmotion).replaceAll('CURRENT_WEIGHT', currentWeight)
    const body = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...memory.getMessages(),
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
  if (start === -1) {
    // model replied in plain text — wrap it as a chat
    console.log('[llm] No JSON found, wrapping as chat:', raw)
    return { tool: 'chat', args: { message: raw } }
  }

  let depth = 0, end = -1
  for (let i = start; i < clean.length; i++) {
    if (clean[i] === '{') depth++
    else if (clean[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }

  if (end === -1) throw new Error('Incomplete JSON: ' + raw)
  return JSON.parse(clean.slice(start, end + 1))
}

async function think(transcript, currentEmotion, currentWeight) {
  console.log('[llm] Sending to Qwen:', transcript)
  const raw = await callOllama(transcript, currentEmotion, currentWeight)
  console.log('[llm] Raw response:', raw)
  const tool = parseToolCall(raw)
  console.log('[llm] Tool call:', JSON.stringify(tool))
  //random rolls based on emotion, weight
  if (isActionTool(tool.tool)) {
      const rejectChance = getRejectionChance(currentEmotion, currentWeight);
      if (rejectChance > 0) {
        const roll = Math.random() * 100;   // roll 0-100

        if (roll < rejectChance) {
          console.log(`Rejected with chance: ${rejectChance}% | roll: ${roll.toFixed(1)}`);
          return {
            tool: "chat",
            args: {
              message: transcript,
              refuse: true
          }
        };
      }
    }
  }
  console.log('[llm] Tool call:', JSON.stringify(tool));
  return tool;
}

function isActionTool(toolName) {
  return ['open_app', 'close_app', 'search_web', 'type_text'].includes(toolName);
}

function getRejectionChance(emotion, weight) {
  if (!['angry', 'tired'].includes(emotion.toLowerCase())) {
    return 0;
  }
  const w = Math.max(-10, Math.min(0, weight));

  if (emotion.toLowerCase() === 'angry') {
    if (w <= -8) return 20;
    if (w <= -6) return 15;
    if (w <= -4) return 10;
    if (w <= -2) return 5;
    return 1;
  } 
  else { // tired
    if (w <= -8) return 25;
    if (w <= -6) return 15;
    if (w <= -4) return 10;
    if (w <= -2) return 5;
    return 5;
  }
}

module.exports = { think }