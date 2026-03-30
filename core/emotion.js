// Tracks emotion state based on tool usage and results

let currentEmotion = 'neutral'
let successStreak = 0
let failStreak = 0

const TOOL_EMOTIONS = {
  chat:       'happy',
  search_web: 'energized',
  open_app:   'energized',
  close_app:  'neutral',
  close_tab:  'neutral',
  type_text:  'energized',
  unknown:    'cunning',
}

function getEmotion(tool, success) {
  if (!success) {
    failStreak++
    successStreak = 0
    if (failStreak >= 3) { currentEmotion = 'stressed'; return currentEmotion }
    currentEmotion = 'angry'
    return currentEmotion
  }

  failStreak = 0
  successStreak++

  if (successStreak >= 5) { 
    currentEmotion = 'energized'
  } else {
    currentEmotion = TOOL_EMOTIONS[tool] || 'neutral'
  }

  return currentEmotion
}

function getCurrentEmotion() { return currentEmotion }
function resetEmotion() { currentEmotion = 'neutral'; successStreak = 0; failStreak = 0 }

module.exports = { getEmotion, getCurrentEmotion, resetEmotion }