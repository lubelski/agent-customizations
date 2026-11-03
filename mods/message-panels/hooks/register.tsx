import type { EngineInterface, Register } from 'claude-code'

// Warm palette near Claude's orange (#d97757), muted for panel fills.
// Assistant: warm gray. User: dark orange-brown. Edges use the same colors.
const ASSISTANT_BG = '#2a2725'
const USER_BG = '#4a3226'
const ERROR = '#e07a6a'
const TAG = '#8a7d74'

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function truncate(value: string, width: number): string {
  if (width < 2) return ''
  return value.length <= width ? value : value.slice(0, width - 1) + '…'
}

const KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description', 'prompt', 'skill']

/** The one input field a person would recognise the call by. */
function summarize(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const record = input as Record<string, unknown>
  for (const key of KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return oneLine(value)
  }
  for (const value of Object.values(record)) {
    if (typeof value === 'string' && value.trim()) return oneLine(value)
  }
  return ''
}

function label(tool: string, input: unknown): string {
  const name = tool.startsWith('mcp__') ? tool.split('__').slice(2).join('__') || tool : tool
  const detail = summarize(input)
  return detail ? `› ${name} · ${detail}` : `› ${name}`
}

// A column of half blocks, taller than any panel. The outer Box's overflow
// clips it to the panel's height: an absolute Box does not clip itself.
const LEFT_EDGE = '▐\n'.repeat(500)
const RIGHT_EDGE = '▌\n'.repeat(500)

type Elements = { Box: any; Text: any }

/**
 * pi's half-bleed panel: a fill inset one cell, with half-block ends in the
 * fill's color. Every panel takes one blank row above and none below. The
 * rows after it supply the gap below: Claude Code's own rows start with a
 * blank row, and a tool line does too when it follows a message (gapBefore).
 * So two neighbours never stack two blank rows (margin collapse by hand).
 */
function panel({ Box, Text }: Elements, color: string, body: unknown, tag?: string) {
  return (
    <Box marginTop={1} flexDirection="column" overflow="hidden">
      <Box backgroundColor={color} marginX={1} paddingX={1} paddingY={1} flexDirection="column">
        {body}
      </Box>
      <Box position="absolute" left={0} top={0} bottom={0} width={1}>
        <Text color={color}>{LEFT_EDGE}</Text>
      </Box>
      <Box position="absolute" right={0} top={0} bottom={0} width={1}>
        <Text color={color}>{RIGHT_EDGE}</Text>
      </Box>
      {tag ? (
        <Box position="absolute" right={3} top={0}>
          <Text color={TAG}>{tag}</Text>
        </Box>
      ) : null}
    </Box>
  )
}

type Block = { type: string; id?: unknown; text?: unknown }

/**
 * The ids of tool calls whose previous visible row is a message (a prompt or
 * assistant text), not another tool call. Thinking draws nothing here and
 * tool results hide under their call, so both are skipped. A user message
 * that carries tool results is the engine's plumbing (its text blocks are
 * reminders), not a prompt row.
 */
function callsAfterMessages(messages: ReadonlyArray<{ role: string; content: readonly Block[] }>): { after: Set<string>; last: 'message' | 'tool' } {
  const after = new Set<string>()
  let previous: 'message' | 'tool' = 'message'
  for (const message of messages) {
    const blocks = message.content
    if (message.role === 'user') {
      const isPlumbing = blocks.some(b => b.type === 'tool_result')
      if (!isPlumbing && blocks.some(b => b.type === 'text')) previous = 'message'
      continue
    }
    for (const block of blocks) {
      if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) previous = 'message'
      if (block.type === 'tool_use' && typeof block.id === 'string') {
        if (previous === 'message') after.add(block.id)
        previous = 'tool'
      }
    }
  }
  return { after, last: previous }
}

/** One blank row above a tool line that follows a message, none after another tool line. */
async function gapBefore($: EngineInterface, id: string | undefined): Promise<number> {
  if (!id) return 0
  const messages = await $.session.messages({ as: 'api' })
  const { after, last } = callsAfterMessages(messages)
  if (after.has(id)) return 1
  // A call of the reply still streaming is not in the list yet: it comes after
  // everything there, so the last visible row decides.
  const listed = messages.some(m => m.content.some(b => b.type === 'tool_use' && b.id === id))
  return !listed && last === 'message' ? 1 : 0
}

/**
 * A slash command's echo, as the engine stores it: `<command-name>/model</command-name>`
 * with `<command-args>`, under an origin it does not always stamp. Returns the
 * line to draw (`/model args`), or null for any other user row.
 */
function commandEcho(props: { text: string; task?: unknown; from?: unknown }): string | null {
  if (props.task || props.from) return null
  const text = props.text.trim()
  const name = /<command-name>([^<]*)<\/command-name>/.exec(text)?.[1]?.trim()
  if (name) {
    const args = /<command-args>([^<]*)<\/command-args>/.exec(text)?.[1]?.trim() ?? ''
    return args ? `${name} ${args}` : name
  }
  return /^\/[a-z][\w:-]*(\s|$)/i.test(text) && !text.includes('\n') ? text : null
}

/** Whether the tree holds the engine's own drawing anywhere. */
function holdsEngine(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const element = node as { type?: string; children?: unknown[] }
  return element.type === 'engine' || (element.children ?? []).some(holdsEngine)
}


export const register: Register = on => {
  // The body is another mod's tree where one beneath drew one (code-brackets),
  // else Markdown from the text: the engine's row adds the ⏺ bullet, its indent
  // column and a top margin, and may not sit under `overflow`. A summary block
  // (text between tool calls, condensed) draws the same way; it loses the
  // engine's faint `· summary` mark, so it carries a `summary` tag of its own in
// the top padding row; ctrl+o still shows the full text.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const elements = $.ui.resolve(e)
    const drawn = await next(e)
    const body = holdsEngine(drawn) ? <elements.Markdown text={e.props.text} /> : drawn
    return panel(elements, ASSISTANT_BG, body, e.props.isSummary ? 'summary' : undefined)
  })

  // Drawn from the text, not wrapped: the engine's row paints its own gray.
  // A slash command's echo (`/model`, `/clear`) is a user row too, under an
  // origin the engine does not always stamp, so it is told by its text and
  // drawn as one dim line, as a tool call is, with its output beneath.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const elements = $.ui.resolve(e)
    const echo = commandEcho(e.props)
    if (echo !== null) {
      return (
        <elements.Box marginTop={1} paddingLeft={1}>
          <elements.Text dimColor>› {oneLine(echo)}</elements.Text>
        </elements.Box>
      )
    }
    if (e.props.origin.kind !== 'composer') return next(e)
    return panel(elements, USER_BG, <elements.Text color="#efe6df">{e.props.text}</elements.Text>)
  })

  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const { Box, Text, Markdown } = $.ui.resolve(e)
    return (
      <Box paddingLeft={3} flexDirection="column">
        {e.props.isErrored ? <Text color={ERROR}>{e.props.text}</Text> : <Markdown text={e.props.text} dimColor />}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const p = e.props
    if (e.surface !== 'terminal' || p.isExpanded || p.isErrored || p.isInterrupted) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const width = (e.viewport?.columns ?? 100) - 4
    return (
      <Box paddingLeft={1} marginTop={await gapBefore($, p.tool_use_id)}>
        <Text dimColor wrap="truncate-end">
          {truncate(label(p.tool, p.input), width)}
          {p.isRunning ? ' …' : ''}
        </Text>
      </Box>
    )
  })

  // pi hides successful tool output until expanded; ctrl+o still shows it.
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isExpanded || e.props.isErrored) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box display="none" />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const p = e.props
    if (e.surface !== 'terminal' || p.isExpanded || p.isCallsOnly !== true) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const width = (e.viewport?.columns ?? 100) - 4
    return (
      <Box flexDirection="column" paddingLeft={1} marginTop={await gapBefore($, p.calls[0]?.tool_use_id)}>
        {p.calls.map(call => (
          <Text dimColor color={call.isErrored ? ERROR : undefined} wrap="truncate-end">
            {truncate(label(call.tool, call.input), width)}
            {call.isRunning ? ' …' : ''}
          </Text>
        ))}
      </Box>
    )
  })
}
