const tools = {
  open_app:   require('../tools/open_app'),
  close_app:  require('../tools/close_app'),
  search_web: require('../tools/search_web'),
  type_text:  require('../tools/type_text'),
  chat:       require('../tools/chat'),
}

async function execute(toolCall) {
  const { tool, args } = toolCall

  if (!tool) throw new Error('No tool specified in response')

  if (tool === 'unknown') {
    return {
      success: false,
      message: `I didn't understand that. ${args?.reason || ''}`.trim()
    }
  }

  const handler = tools[tool]
  if (!handler) {
    return {
      success: false,
      message: `Unknown tool: ${tool}`
    }
  }

  console.log(`[executor] Running tool: ${tool}`, args)
  return await handler.run(args)
}

module.exports = { execute }