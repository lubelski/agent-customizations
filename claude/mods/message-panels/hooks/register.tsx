import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import { fitPath, shortenPath } from './paths'
import type { PathContext } from './paths'

// Warm palettes near Claude's orange (#d97757), muted for panel fills.
// Assistant: warm gray. User: orange-brown, pale in the light palette.
// Edges use the fill colors. `userText` is the user panel's text, which the
// mod draws itself; the assistant panel's text is the engine's Markdown, in
// the theme's own text color.
type Scheme = 'light' | 'dark'
type Palette = { assistant: string; user: string; userText: string; error: string; tag: string; added: string }

const PALETTES: Record<Scheme, Palette> = {
  dark: { assistant: '#2a2725', user: '#4a3226', userText: '#efe6df', error: '#e07a6a', tag: '#8a7d74', added: '#9fb87a' },
  light: { assistant: '#e8dcc9', user: '#f4d8c3', userText: '#3b2a20', error: '#b0442f', tag: '#76685e', added: '#4f7428' },
}

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

const scheme = atom({ plugin: 'message-panels', key: 'scheme' } as const, 'dark' as Scheme, { shape: 'scheme-1' })

/**
 * Light or dark, from the `theme` setting. `auto` follows the terminal's
 * background, which the mod API does not expose, so the mod reads the macOS
 * appearance instead. Where that read fails (not macOS), the palette is dark.
 */
async function detectScheme($: EngineInterface): Promise<Scheme> {
  const row = (await $.config.list()).find(r => r.key === 'theme')
  const value = typeof row?.value === 'string' ? row.value : 'auto'
  if (value.startsWith('light')) return 'light'
  if (value.startsWith('dark')) return 'dark'
  try {
    const { exitCode, stdout } = await $.process.run(['defaults', 'read', '-g', 'AppleInterfaceStyle'], { timeoutMs: 2000 })
    return exitCode === 0 && /dark/i.test(stdout) ? 'dark' : 'light'
  } catch {
    return 'dark'
  }
}

/** Writes the scheme only when it changed, so an unchanged check redraws nothing. */
async function refreshScheme($: EngineInterface): Promise<void> {
  const next = await detectScheme($)
  if ((await read($, scheme)) !== next) await update($, scheme, () => next)
}

// How often the mod checks the scheme again. Under `auto`, the terminal can
// switch between light and dark with no event the mod sees.
const SCHEME_POLL_MS = 3000

// The running check, cancelled before a reload starts another.
let schemePoll: { cancel: () => void } | undefined

async function palette($: EngineInterface): Promise<Palette> {
  return PALETTES[await read($, scheme)]
}

const revealed = atom({ plugin: 'message-panels', key: 'revealed' } as const, {} as Record<string, boolean>, { shape: 'revealed-1' })

// Narration: text the model wrote in a turn ahead of a tool call, as opposed
// to the reply that ends the turn. `AssistantMessage` does not say which a
// block is, so `session.append` watches the response rows: text rows wait in
// `pendingText`, and a tool_use row after them marks them narration. Keyed by
// the row's `uuid`, which is the `requestId` its render carries. Rows a
// `--resume` loads are never appended, so their narration draws as a reply.
const narration = atom({ plugin: 'message-panels', key: 'narration' } as const, {} as Record<string, true>, { shape: 'narration-1' })
let pendingText: string[] = []

// Narration and summary rows show this many lines, the last cut with `…`.
const ASIDE_LINES = 3
// Cells the row loses to the engine's bullet column and the panel's margins
// and padding.
const ASIDE_INSET = 6

/** Markdown reduced to plain words for a one-style line: markers dropped. */
function plainWords(markdown: string): string {
  return oneLine(
    markdown
      .replace(/```[^\n]*\n?/g, ' ')
      .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|__|`/g, ''),
  )
}

/** Words wrapped to `width` cells, at most `max` lines, the last ending in `…` when cut. */
function clampLines(text: string, width: number, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (!line) line = word
    else if (line.length + 1 + word.length <= width) line += ` ${word}`
    else {
      lines.push(line)
      line = word
      if (lines.length === max) break
    }
  }
  if (lines.length < max && line) return [...lines, line]
  const last = lines[max - 1]
  const room = Math.max(1, width - 1)
  lines[max - 1] = (last.length > room ? last.slice(0, room) : last).trimEnd() + '…'
  return lines
}

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

// Fields that hold a file path, drawn short and cut from the middle.
const PATH_KEYS = new Set(['file_path', 'path'])

type Detail = { text: string; isPath: boolean }

/** The one input field a person would recognise the call by. */
function summarize(input: unknown): Detail {
  if (!input || typeof input !== 'object') return { text: '', isPath: false }
  const record = input as Record<string, unknown>
  for (const key of KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return { text: oneLine(value), isPath: PATH_KEYS.has(key) }
  }
  for (const value of Object.values(record)) {
    if (typeof value === 'string' && value.trim()) return { text: oneLine(value), isPath: false }
    // A list of labelled items (set_links): its labels.
    if (Array.isArray(value) && value.length > 0 && value.every(v => v && typeof v === 'object' && typeof (v as { label?: unknown }).label === 'string')) {
      return { text: value.map(v => oneLine((v as { label: string }).label)).join(', '), isPath: false }
    }
  }
  return { text: '', isPath: false }
}

/** The call's one line, cut to `width`: a path loses directories from its middle. */
function label(tool: string, input: unknown, width: number, context: PathContext): string {
  const name = tool.startsWith('mcp__') ? tool.split('__').slice(2).join('__') || tool : tool
  const head = `› ${name}`
  const detail = summarize(input)
  if (!detail.text) return truncate(head, width)
  if (!detail.isPath) return truncate(`${head} · ${detail.text}`, width)
  const room = width - head.length - 3
  return room < 2 ? truncate(head, width) : `${head} · ${fitPath(shortenPath(detail.text, context), room)}`
}

/** What a path is shortened against: the session's directory and the home directory. */
async function pathContext($: EngineInterface): Promise<PathContext> {
  const [cwd, home] = await Promise.all([$.session.cwd(), $.env.get('HOME')])
  return { cwd, home }
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
 * fill's color, capped above and below by a half-height row. The caps are the
 * panel's whole spacing: it takes no blank row above or below. Two panels in
 * a row leave one row of the terminal's background between their fills, and a
 * tool line or Claude Code's own rows sit half a row from a fill.
 */
function panel(elements: Elements, color: string, tagColor: string, body: unknown, tag?: string) {
  const { Box, Text } = elements
  // The bottom cap sits outside the clipping Box: the edge columns run past
  // their own Box's bottom, and only the parent's overflow cuts them off.
  return (
    <Box flexDirection="column">
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
            <Text color={tagColor}> {tag} </Text>
          </Box>
        ) : null}
      </Box>
      {cap(elements, color, BOTTOM_CAP)}
    </Box>
  )
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

/** The turn's duration as the engine's line formats it: `3s`, `1m 4s`, `1h 2m`. */
function duration(ms: number): string {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

// The clock of each turn's closing line, stamped on its first draw so a
// redraw (a resize) keeps the time the turn ended.
const doneClocks = new Map<string, string>()

function doneAt(requestId: string): string {
  let clock = doneClocks.get(requestId)
  if (!clock) {
    clock = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    doneClocks.set(requestId, clock)
  }
  return clock
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

function patchLines(hunks: Hunk[], colors: Palette): Line[] {
  const out: Line[] = []
  for (const hunk of hunks) {
    out.push({ text: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`, color: colors.tag })
    for (const line of hunk.lines) {
      out.push({ text: line, color: line.startsWith('+') ? colors.added : line.startsWith('-') ? colors.error : undefined })
    }
  }
  return out
}

/**
 * The call's result as lines: Bash's stdout and stderr, a Read's numbered
 * content, an Edit's or Write's patch, a plugin tool's text blocks, and JSON
 * for anything else. An errored call's result is the error text.
 */
function outputLines(output: unknown, errored: boolean, colors: Palette): Line[] {
  if (output === undefined || output === null) return []
  if (typeof output === 'string') return plain(output, errored ? colors.error : undefined)
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
    if (typeof r.stderr === 'string' && r.stderr.trim()) out.push(...plain(r.stderr, colors.error))
    if (typeof r.backgroundTaskId === 'string') out.push({ text: `running in background · ${r.backgroundTaskId}`, color: colors.tag })
    return out
  }
  if (Array.isArray(r.structuredPatch) && r.structuredPatch.length > 0) return patchLines(r.structuredPatch as Hunk[], colors)
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
  // The palette follows the theme: read at start and on every reload, again
  // when the person changes the theme, and every few seconds for `auto`.
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refreshScheme($)
    schemePoll?.cancel()
    schemePoll = $.clock.every(SCHEME_POLL_MS, () => refreshScheme($))
    return result
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    await refreshScheme($)
    return result
  })

  // Marks narration (see `narration`). Only the main conversation's rows count.
  on('session.append', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) return result
    if (e.door === 'prompt') pendingText = []
    if (e.door !== 'response') return result
    if (e.message.content.some(b => b.type === 'text' && typeof b.text === 'string' && b.text.trim())) pendingText.push(e.uuid)
    if (e.message.content.some(b => b.type === 'tool_use') && pendingText.length) {
      const marked = pendingText
      pendingText = []
      await update($, narration, held => ({ ...held, ...Object.fromEntries(marked.map(t => [t, true as const])) }))
    }
    return result
  })

  // The body is another mod's tree where one beneath drew one (code-brackets),
  // else Markdown from the text: the engine's row adds the ⏺ bullet, its indent
  // column and a top margin, and may not sit under `overflow`. A summary block
  // (text between tool calls, condensed) and narration draw as an aside: plain
  // words, dim and italic, at most 3 lines. ctrl+o still shows the full text.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const elements = $.ui.resolve(e)
    const colors = await palette($)
    const aside = e.props.isSummary || (await read($, narration))[e.requestId]
    if (aside) {
      const width = Math.max(20, (e.viewport?.columns ?? 80) - ASIDE_INSET)
      const lines = clampLines(plainWords(e.props.text), width, ASIDE_LINES)
      const body = (
        <elements.Box flexDirection="column">
          {lines.map((line, i) => (
            <elements.Text key={String(i)} dimColor italic wrap="truncate-end">{line}</elements.Text>
          ))}
        </elements.Box>
      )
      return panel(elements, colors.assistant, colors.tag, body)
    }
    const drawn = await next(e)
    const body = holdsEngine(drawn) ? <elements.Markdown text={e.props.text} /> : drawn
    return panel(elements, colors.assistant, colors.tag, body)
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
        <elements.Box paddingLeft={1}>
          <elements.Text dimColor>› {oneLine(echo)}</elements.Text>
        </elements.Box>
      )
    }
    if (e.props.origin.kind !== 'composer') return next(e)
    const colors = await palette($)
    return panel(elements, colors.user, colors.tag, <elements.Text color={colors.userText}>{e.props.text}</elements.Text>)
  })

  // The line that closes a turn (`Baked for 3s · done 4:55 PM`) is the
  // engine's, drawn with a blank row above it and a `✻` glyph. The panel's
  // bottom cap already leaves half a row, so the mod draws the line itself:
  // dim, a `·` where a tool line has its `›`, text aligned with it, no blank row. The engine
  // keeps a line that waits on background agents.
  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.waitingFor) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box paddingLeft={1}>
        <Text dimColor>· {e.props.word} for {duration(e.props.durationMs)} · done {doneAt(e.requestId)}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const { Box, Text, Markdown } = $.ui.resolve(e)
    const colors = await palette($)
    return (
      <Box paddingLeft={3} flexDirection="column">
        {e.props.isErrored ? <Text color={colors.error}>{e.props.text}</Text> : <Markdown text={e.props.text} dimColor />}
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
    const failed = p.isErrored || p.isInterrupted
    const colors = await palette($)
    const context = await pathContext($)
    const head = (
      <Text dimColor color={failed ? colors.error : undefined} wrap="truncate-end">
        {label(p.tool, p.input, width, context)}
        {p.isRunning ? ' …' : ''}
      </Text>
    )
    if (!p.isExpanded && !failed) {
      return <Box paddingLeft={1}>{head}</Box>
    }
    const id = p.tool_use_id
    const open = (await read($, revealed))[id] === true
    const input = inputLines(p.tool, p.input)
    const output = outputLines(p.output, failed, colors)
    const inputShown = open ? input : input.slice(0, INPUT_PREVIEW)
    const outputShown = open ? output : output.slice(0, OUTPUT_PREVIEW)
    const hidden = input.length - inputShown.length + output.length - outputShown.length
    return (
      <Box flexDirection="column" width="100%" backgroundColor={PLAIN} paddingLeft={1} paddingRight={2}>
        {head}
        <Box position="absolute" left={0} bottom={-1} height={1} width="100%" backgroundColor={PLAIN} />
        <Box flexDirection="column" paddingLeft={2}>
          {inputShown.map(text => (
            <Text color={colors.tag} wrap={open ? 'wrap' : 'truncate-end'}>{text}</Text>
          ))}
          {outputShown.map(line => (
            <Text dimColor={!line.color} color={line.color} wrap={open ? 'wrap' : 'truncate-end'}>{line.text}</Text>
          ))}
          {hidden > 0 || open ? (
            <Button key={`reveal-${id}`} plain onPress={() => toggleRevealed($, id)}>
              <Text color={colors.tag}>{open ? '▴ less' : `▸ ${hidden} more lines`}</Text>
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

  // A group of calls draws one line per call. `isCallsOnly` is false when a
  // call errored or was interrupted, and also when the group holds other rows
  // (recalled memory, hook timing). A failed call explains the first case, so
  // the group still draws its own lines, the failed one in the error color.
  // Otherwise the engine's line stays, pulled up over its blank row.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const p = e.props
    if (e.surface !== 'terminal' || p.isExpanded) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const failed = p.calls.some(call => call.isErrored || call.isInterrupted)
    if (p.isCallsOnly !== true && !failed) return <Box marginTop={-1}>{await next(e)}</Box>
    const width = (e.viewport?.columns ?? 100) - 4
    const context = await pathContext($)
    const colors = await palette($)
    return (
      <Box flexDirection="column" paddingLeft={1}>
        {p.calls.map(call => (
          <Text dimColor color={call.isErrored || call.isInterrupted ? colors.error : undefined} wrap="truncate-end">
            {label(call.tool, call.input, width, context)}
            {call.isRunning ? ' …' : ''}
          </Text>
        ))}
      </Box>
    )
  })
}
