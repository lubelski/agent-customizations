import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

// Warm palette near Claude's orange (#d97757), muted for panel fills.
// Assistant: warm gray. User: dark orange-brown. Edges use the same colors.
const ASSISTANT_BG = '#2a2725'
const USER_BG = '#4a3226'
const ERROR = '#e07a6a'
const TAG = '#8a7d74'
const ADDED = '#9fb87a'

// An expanded tool row (ctrl+o, --verbose, an errored call) shows this much of
// its input and output before a click reveals the rest.
const INPUT_PREVIEW = 8
const OUTPUT_PREVIEW = 12

// A click on a tool row expands it, and the engine paints the row's container
// in the `userMessageBackgroundHover` theme color, full width. A Box paints
// its area as a run of spaces in its background color and draws its children
// over it; the painter styles only `ansi:`, `#hex`, `ansi256()` and `rgb()`
// strings and leaves any other unstyled. So a full-width Box in this
// "color" writes plain cells, which take the terminal's own background, over
// the engine's gray. The engine's bottom padding row is covered by an
// absolute Box one row below.
const PLAIN = 'plain'

const revealed = atom({ plugin: 'message-panels', key: 'revealed' } as const, {} as Record<string, boolean>, { shape: 'revealed-1' })

async function toggleRevealed($: EngineInterface, id: string): Promise<void> {
  await update($, revealed, held => ({ ...held, [id]: !held[id] }))
}

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
    // A list of labelled items (set_links): its labels.
    if (Array.isArray(value) && value.length > 0 && value.every(v => v && typeof v === 'object' && typeof (v as { label?: unknown }).label === 'string')) {
      return value.map(v => oneLine((v as { label: string }).label)).join(', ')
    }
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

// The panel's caps: half-height rows in the fill's color on the terminal's
// own background, in place of a full blank padding row. The top cap fills the
// lower half of its row, the bottom cap the upper half; each corner is the
// quadrant where a cap meets a side edge. The fill is wider than any panel
// and wraps; its Box is one row high and clips the rest (Block Elements, so
// any terminal font has them; pi's sextant caps are one third of a row).
const TOP_CAP = { left: '▗', fill: '▄'.repeat(500), right: '▖' }
const BOTTOM_CAP = { left: '▝', fill: '▀'.repeat(500), right: '▘' }

type Elements = { Box: any; Text: any }

function cap({ Box, Text }: Elements, color: string, glyphs: { left: string; fill: string; right: string }) {
  return (
    <Box height={1} overflow="hidden">
      <Text color={color}>{glyphs.left}</Text>
      <Box flexGrow={1} flexShrink={1} height={1} overflow="hidden">
        <Text color={color}>{glyphs.fill}</Text>
      </Box>
      <Text color={color}>{glyphs.right}</Text>
    </Box>
  )
}

/**
 * pi's half-bleed panel: a fill inset one cell, with half-block ends in the
 * fill's color, capped above and below by a half-height row. Every panel takes
 * one blank row above and none below. The rows after it supply the gap below:
 * Claude Code's own rows start with a blank row, and a tool line does too when
 * it follows a message (gapBefore). So two neighbours never stack two blank
 * rows (margin collapse by hand).
 */
function panel(elements: Elements, color: string, body: unknown, tag?: string) {
  const { Box, Text } = elements
  // The bottom cap sits outside the clipping Box: the edge columns run past
  // their own Box's bottom, and only the parent's overflow cuts them off.
  return (
    <Box marginTop={1} flexDirection="column">
      <Box flexDirection="column" overflow="hidden">
        {cap(elements, color, TOP_CAP)}
        <Box backgroundColor={color} marginX={1} paddingX={1} flexDirection="column">
          {body}
        </Box>
        <Box position="absolute" left={0} top={1} bottom={0} width={1}>
          <Text color={color}>{LEFT_EDGE}</Text>
        </Box>
        <Box position="absolute" right={0} top={1} bottom={0} width={1}>
          <Text color={color}>{RIGHT_EDGE}</Text>
        </Box>
        {tag ? (
          <Box position="absolute" right={3} top={0}>
            <Text color={TAG}> {tag} </Text>
          </Box>
        ) : null}
      </Box>
      {cap(elements, color, BOTTOM_CAP)}
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

type Line = { text: string; color?: string }

function splitLines(value: string): string[] {
  return value.replace(/\r\n?/g, '\n').replace(/\n$/, '').replace(/\t/g, '    ').split('\n')
}

function plain(value: string, color?: string): Line[] {
  return splitLines(value).map(text => ({ text, color }))
}

// Edit and Write carry their text in the output's patch, so their input
// shows the path and the flags alone.
const SHOWN_IN_OUTPUT = new Set(['old_string', 'new_string', 'content'])

/** The call's input as `key: value` lines; a multi-line value indents under its key. */
function inputLines(tool: string, input: unknown): string[] {
  if (typeof input === 'string') return splitLines(input)
  if (!input || typeof input !== 'object') return []
  const lines: string[] = []
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined || value === null) continue
    if ((tool === 'Edit' || tool === 'Write') && SHOWN_IN_OUTPUT.has(key)) continue
    if (typeof value === 'string') {
      if (value.includes('\n')) lines.push(`${key}:`, ...splitLines(value).map(l => `  ${l}`))
      else lines.push(`${key}: ${value}`)
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    }
  }
  return lines
}

type Hunk = { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }

function patchLines(hunks: Hunk[]): Line[] {
  const out: Line[] = []
  for (const hunk of hunks) {
    out.push({ text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`, color: TAG })
    for (const line of hunk.lines) {
      out.push({ text: line, color: line.startsWith('+') ? ADDED : line.startsWith('-') ? ERROR : undefined })
    }
  }
  return out
}

/**
 * The call's result as lines: Bash's stdout and stderr, a Read's numbered
 * content, an Edit's or Write's patch, a plugin tool's text blocks, and JSON
 * for anything else. An errored call's result is the error text.
 */
function outputLines(output: unknown, errored: boolean): Line[] {
  if (output === undefined || output === null) return []
  if (typeof output === 'string') return plain(output, errored ? ERROR : undefined)
  if (Array.isArray(output)) {
    return output.flatMap(block => {
      const b = block as { type?: unknown; text?: unknown }
      if (b && typeof b.text === 'string') return plain(b.text)
      if (b && b.type === 'image') return [{ text: '[image]' }]
      return plain(JSON.stringify(block))
    })
  }
  if (typeof output !== 'object') return [{ text: String(output) }]
  const r = output as Record<string, unknown>
  if (typeof r.stdout === 'string' || typeof r.stderr === 'string') {
    const out: Line[] = []
    if (r.isImage) out.push({ text: '[image]' })
    else if (typeof r.stdout === 'string' && r.stdout.trim()) out.push(...plain(r.stdout))
    if (typeof r.stderr === 'string' && r.stderr.trim()) out.push(...plain(r.stderr, ERROR))
    if (typeof r.backgroundTaskId === 'string') out.push({ text: `running in background · ${r.backgroundTaskId}`, color: TAG })
    return out
  }
  if (Array.isArray(r.structuredPatch) && r.structuredPatch.length > 0) return patchLines(r.structuredPatch as Hunk[])
  if (r.file && typeof r.file === 'object') {
    const file = r.file as Record<string, unknown>
    if (typeof file.content === 'string') {
      const start = typeof file.startLine === 'number' ? file.startLine : 1
      const lines = splitLines(file.content)
      const pad = String(start + lines.length - 1).length
      return lines.map((text, i) => ({ text: `${String(start + i).padStart(pad)}  ${text}` }))
    }
    if (typeof file.base64 === 'string') return [{ text: `[${typeof file.type === 'string' ? file.type : 'binary'}]` }]
  }
  if (typeof r.content === 'string') return plain(r.content)
  if (Array.isArray(r.filenames)) return r.filenames.map(f => ({ text: String(f) }))
  if (typeof r.message === 'string') return plain(r.message)
  return plain(JSON.stringify(output, null, 2))
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

  // A tool call is one dim line. Expanded (ctrl+o, --verbose) or failed, the
  // line heads a block indented under it: the input as `key: value` lines, then
  // the output. Each shows a preview, and one click on the `n more lines`
  // button reveals the rest; the row's output comes from `p.output`, so the
  // engine's own ToolResult row is hidden on this surface.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const p = e.props
    if (e.surface !== 'terminal') return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const width = (e.viewport?.columns ?? 100) - 4
    const gap = await gapBefore($, p.tool_use_id)
    const failed = p.isErrored || p.isInterrupted
    const head = (
      <Text dimColor color={failed ? ERROR : undefined} wrap="truncate-end">
        {truncate(label(p.tool, p.input), width)}
        {p.isRunning ? ' …' : ''}
      </Text>
    )
    if (!p.isExpanded && !failed) {
      return <Box paddingLeft={1} marginTop={gap}>{head}</Box>
    }
    const id = p.tool_use_id
    const open = (await read($, revealed))[id] === true
    const input = inputLines(p.tool, p.input)
    const output = outputLines(p.output, failed)
    const inputShown = open ? input : input.slice(0, INPUT_PREVIEW)
    const outputShown = open ? output : output.slice(0, OUTPUT_PREVIEW)
    const hidden = input.length - inputShown.length + output.length - outputShown.length
    return (
      <Box flexDirection="column" width="100%" backgroundColor={PLAIN} paddingLeft={1} paddingRight={2} marginTop={gap}>
        {head}
        <Box position="absolute" left={0} bottom={-1} height={1} width="100%" backgroundColor={PLAIN} />
        <Box flexDirection="column" paddingLeft={2}>
          {inputShown.map(text => (
            <Text color={TAG} wrap={open ? 'wrap' : 'truncate-end'}>{text}</Text>
          ))}
          {outputShown.map(line => (
            <Text dimColor={!line.color} color={line.color} wrap={open ? 'wrap' : 'truncate-end'}>{line.text}</Text>
          ))}
          {hidden > 0 || open ? (
            <Button key={`reveal-${id}`} plain onPress={() => toggleRevealed($, id)}>
              <Text color={TAG}>{open ? '▴ less' : `▸ ${hidden} more lines`}</Text>
            </Button>
          ) : null}
        </Box>
      </Box>
    )
  })

  // The ToolUse row above draws the output itself, in every view.
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
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
