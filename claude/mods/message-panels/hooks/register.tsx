import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, UiPressArgument } from 'claude-code'
import { countLines, cutBlocks, cutPair, inputBlocks, outputBlocks } from './blocks'
import type { Block } from './blocks'
import { commandRuns, fitRuns } from './commands'
import { pathRuns } from './paths'
import type { PathContext, Run } from './paths'
import { segments, unwrapPastes } from './paste'

// Warm palettes near Claude's orange (#d97757), muted for panel fills.
// Assistant: warm gray. User: orange-brown, pale in the light palette.
// `userText` is the user panel's text, which the
// mod draws itself; the assistant panel's text is the engine's Markdown, in
// the theme's own text color. `quote` is the bar beside pasted text in a
// user panel.
type Scheme = 'light' | 'dark'
type Palette = { assistant: string; user: string; userText: string; quote: string; error: string; tag: string }

const PALETTES: Record<Scheme, Palette> = {
  dark: { assistant: '#2a2725', user: '#4a3226', userText: '#efe6df', quote: '#a87a62', error: '#e07a6a', tag: '#8a7d74' },
  light: { assistant: '#e8dcc9', user: '#f4d8c3', userText: '#3b2a20', quote: '#c4906f', error: '#b0442f', tag: '#76685e' },
}

// A tool row in the ctrl+o transcript shows this much of its input and output
// before a click reveals the rest.
const INPUT_PREVIEW = 8
const OUTPUT_PREVIEW = 12
// An open row anywhere else (the `verbose` setting, a chevron the person
// opened, a failed call) shows this many lines in all, input first but at
// most `PREVIEW_INPUT_MAX` of it when output follows.
const PREVIEW = 7
const PREVIEW_INPUT_MAX = 3

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

// Tool rows whose chevron the person turned, by tool_use_id: true open, false
// closed. A row with no entry takes its view's default.
const opened = atom({ plugin: 'message-panels', key: 'opened' } as const, {} as Record<string, boolean>, { shape: 'opened-1' })

// The `verbose` setting. The engine marks rows expanded alike under it and in
// the ctrl+o transcript, so the mod reads the setting to tell them apart.
const verbose = atom({ plugin: 'message-panels', key: 'verbose' } as const, false, { shape: 'verbose-1' })

/** Writes the `verbose` setting only when it changed. */
async function refreshVerbose($: EngineInterface): Promise<void> {
  const row = (await $.config.list()).find(r => r.key === 'verbose')
  const next = row?.value === true
  if ((await read($, verbose)) !== next) await update($, verbose, () => next)
}

async function toggleOpened($: EngineInterface, id: string, open: boolean): Promise<void> {
  await update($, opened, held => ({ ...held, [id]: !open }))
}

// Summary rows show this many lines, the last cut with `…`.
const ASIDE_LINES = 3
// Cells the row loses to the engine's bullet column and the panel's padding.
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
  const last = lines[max - 1] ?? ''
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

// Fields that hold a file path, drawn short and cut from the middle, and the
// one that holds a shell command, drawn with its programs in the text tone.
const PATH_KEYS = new Set(['file_path', 'path'])
const COMMAND_KEY = 'command'

type Detail = { text: string; kind: 'path' | 'command' | 'other' }

/** The one input field a person would recognise the call by. */
function summarize(input: unknown): Detail {
  if (!input || typeof input !== 'object') return { text: '', kind: 'other' }
  const record = input as Record<string, unknown>
  for (const key of KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return { text: oneLine(value), kind: PATH_KEYS.has(key) ? 'path' : key === COMMAND_KEY ? 'command' : 'other' }
    }
  }
  for (const value of Object.values(record)) {
    if (typeof value === 'string' && value.trim()) return { text: oneLine(value), kind: 'other' }
    // A list of labelled items (set_links): its labels.
    if (Array.isArray(value) && value.length > 0 && value.every(v => v && typeof v === 'object' && typeof (v as { label?: unknown }).label === 'string')) {
      return { text: value.map(v => oneLine((v as { label: string }).label)).join(', '), kind: 'other' }
    }
  }
  return { text: '', kind: 'other' }
}

/**
 * The call's one line as runs, cut to `width`. The head `› <tool> · ` is dim.
 * A path draws its stand-in prefix in the tag tone, its directories dim and
 * its file name in the text tone; a command draws each program in the text
 * tone and the rest dim; any other detail is dim.
 */
function labelRuns(tool: string, input: unknown, width: number, context: PathContext, mark = '›'): Run[] {
  const name = tool.startsWith('mcp__') ? tool.split('__').slice(2).join('__') || tool : tool
  const head = `${mark} ${name}`
  const detail = summarize(input)
  if (!detail.text) return [{ text: truncate(head, width), tone: 'dim' }]
  const room = width - head.length - 3
  if (room < 2) return [{ text: truncate(head, width), tone: 'dim' }]
  const lead: Run = { text: `${head} · `, tone: 'dim' }
  if (detail.kind === 'path') return [lead, ...pathRuns(detail.text, context, room)]
  if (detail.kind === 'command') return [lead, ...commandRuns(detail.text, context, room)]
  return fitRuns([lead, { text: detail.text, tone: 'dim' }], width)
}

/** A tool line's runs as Text elements: dim, the theme's text, or the tag color; all in `color` when the call failed. */
function toolLine({ Text }: Elements, runs: Run[], colors: Palette, failed: boolean, running: boolean) {
  const shown = running ? [...runs, { text: ' …', tone: 'dim' as const }] : runs
  return shown.map(run => {
    const color = failed ? colors.error : run.tone === 'tag' ? colors.tag : undefined
    return (
      <Text color={color} dimColor={failed || run.tone !== 'text'} wrap="truncate-end">
        {run.text}
      </Text>
    )
  })
}

/** What a path is shortened against: the session's directory and the home directory. */
async function pathContext($: EngineInterface): Promise<PathContext> {
  const [cwd, home] = await Promise.all([$.session.cwd(), $.env.get('HOME')])
  return { cwd, home }
}

type Elements = { Box: any; Text: any; Button: any; Code?: any }

/**
 * How a panel draws its spacing, from the `fontCompat` option (`/config`).
 * Off (the default): half-block caps and edges, which take half a row where
 * whole rows take one. On: whole rows and cells only, so terminals and fonts
 * without Block Elements draw it the same.
 */
let fontCompat = false

/** What a press on a panel's top-right cell does: copy the panel's raw text. */
type Copy = (press: UiPressArgument) => void

/** Copies a panel's text as the model or the person wrote it, Markdown and all. */
async function copyText($: EngineInterface, text: string, surface: UiPressArgument['surface']) {
  const copied = await $.ui.copy({ text, surface })
  $.ui.toast(copied.isCopied ? 'Copied' : 'Could not copy message')
}

// The copy target: 4 cells of the panel's top edge, ending one cell short of
// the fill's last column, so one cell of the edge always shows past it. At rest they draw as the edge does; under the pointer the
// word swaps in. A hover can restyle a label but not change its text, so the
// word is a second Button, drawn `display: none` until its keyed Box is hovered.
const COPY_LABEL = 'COPY'
const COPY_INSET = 1

function copyCell({ Box, Text, Button }: Elements, color: string, rest: { text: string; fill?: string }, copy: Copy) {
  return (
    <Box key="copy-cell" width={COPY_LABEL.length} height={1} flexShrink={0}>
      <Button key="copy" plain onPress={copy}>
        <Text color={color} backgroundColor={rest.fill}>{rest.text}</Text>
      </Button>
      <Box position="absolute" top={0} left={0} display="none" hover={{ display: 'flex' }}>
        <Button key="copy-label" plain onPress={copy}>
          <Text bold backgroundColor={color}>{COPY_LABEL}</Text>
        </Button>
      </Box>
    </Box>
  )
}

/**
 * A panel in the spacing mode in use; `gap` is `gapAbove`, which compact
 * ignores. With `copy`, the panel's top-right cell is a Button that copies it.
 */
function panel(elements: Elements, color: string, body: unknown, gap: number, copy?: Copy) {
  return fontCompat ? compatPanel(elements, color, body, gap, copy) : compactPanel(elements, color, body, copy)
}

/**
 * Compat: a fill inset one cell from each side of the row (the terminal's
 * background shows there), with one cell of fill beside the text, one row of
 * fill above and below it (padding), and one blank row outside it (gap).
 * The panel takes its gap below, and above only when the row before it is
 * not a panel (gapAbove), so two panels in a row share one blank row. A tool
 * line or the turn line under a panel needs no gap of its own.
 */
function compatPanel({ Box, Text, Button }: Elements, color: string, body: unknown, gap: number, copy?: Copy) {
  // The copy cells sit in the fill's top padding row, one cell in from its end.
  return (
    <Box flexDirection="column" marginTop={gap} marginBottom={1}>
      <Box backgroundColor={color} marginX={1} paddingX={1} paddingY={1} flexDirection="column">
        {body}
        {copy && (
          <Box position="absolute" top={0} right={COPY_INSET}>
            {copyCell({ Box, Text, Button }, color, { text: ' '.repeat(COPY_LABEL.length), fill: color }, copy)}
          </Box>
        )}
      </Box>
    </Box>
  )
}

// Compact: a column of half blocks, taller than any panel. The outer Box's
// overflow clips it to the panel's height: an absolute Box does not clip
// itself.
const LEFT_EDGE = '▐\n'.repeat(500)
const RIGHT_EDGE = '▌\n'.repeat(500)

// The bar beside pasted text: a column of box-drawing lines, clipped by its
// parent to the paste's height, as the panel's edges are.
const QUOTE_BAR = '│\n'.repeat(500)

/**
 * A user panel's body: typed text as written, and each paste as a quote
 * block, a bar down its left side and its text dim, one blank row between.
 */
function promptBody({ Box, Text }: Elements, colors: Palette, text: string) {
  return (
    <Box flexDirection="column">
      {segments(text).map((segment, i) => {
        const { kind, text: words } = segment

        if (kind === 'typed') {
          return (
            <Box key={String(i)} marginTop={i > 0 ? 1 : 0}>
              <Text color={colors.userText}>{words}</Text>
            </Box>
          )
        }
        return (
          <Box key={String(i)} marginTop={i > 0 ? 1 : 0} paddingLeft={2} overflow="hidden">
            <Text color={colors.userText} dimColor>{words}</Text>
            <Box position="absolute" left={0} top={0} bottom={0} width={1}>
              <Text color={colors.quote}>{QUOTE_BAR}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

// Compact: the panel's caps, half-height rows in the fill's color on the
// terminal's own background, in place of a full padding row. The top cap
// fills the lower half of its row, the bottom cap the upper half; each corner
// is the quadrant where a cap meets a side edge. The fill is wider than any
// panel and wraps; its Box is one row high and clips the rest.
const TOP_CAP = { left: '▗', fill: '▄'.repeat(500), right: '▖' }
const BOTTOM_CAP = { left: '▝', fill: '▀'.repeat(500), right: '▘' }

function cap(elements: Elements, color: string, glyphs: { left: string; fill: string; right: string }, copy?: Copy) {
  const { Box, Text } = elements
  // With `copy`, 4 fill cells before the corner are the copy cells, and one
  // plain fill cell sits between them and the corner.
  return (
    <Box height={1} overflow="hidden">
      <Text color={color}>{glyphs.left}</Text>
      <Box flexGrow={1} flexShrink={1} height={1} overflow="hidden">
        <Text color={color}>{glyphs.fill}</Text>
      </Box>
      {copy && copyCell(elements, color, { text: glyphs.fill.slice(0, COPY_LABEL.length) }, copy)}
      {copy && <Text color={color}>{glyphs.fill.slice(0, COPY_INSET)}</Text>}
      <Text color={color}>{glyphs.right}</Text>
    </Box>
  )
}

/**
 * Compact: pi's half-bleed panel, a fill inset one cell with half-block ends
 * in the fill's color, capped above and below by a half-height row. The caps
 * are the panel's whole spacing: it takes no blank row above or below. Two
 * panels in a row leave one row of the terminal's background between their
 * fills, and a tool line sits half a row from a fill.
 */
function compactPanel(elements: Elements, color: string, body: unknown, copy?: Copy) {
  const { Box, Text } = elements
  // The bottom cap sits outside the clipping Box: the edge columns run past
  // their own Box's bottom, and only the parent's overflow cuts them off.
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" overflow="hidden">
        {cap(elements, color, TOP_CAP, copy)}
        <Box backgroundColor={color} marginX={1} paddingX={1} flexDirection="column">
          {body}
        </Box>
        <Box position="absolute" left={0} top={1} bottom={0} width={1}>
          <Text color={color}>{LEFT_EDGE}</Text>
        </Box>
        <Box position="absolute" right={0} top={1} bottom={0} width={1}>
          <Text color={color}>{RIGHT_EDGE}</Text>
        </Box>
      </Box>
      {cap(elements, color, BOTTOM_CAP)}
    </Box>
  )
}

/** What a stored row draws in the transcript: a panel, or a line of anything else. */
type RowKind = 'panel' | 'line'

// The kind of the visible row before each message row, by the row's uuid,
// which is the `requestId` the row renders under; and the kind of the last
// visible row stored, for a prompt still drawn under `placeholder` before its
// row is appended. Rows a `--resume` loads are never appended, so they are
// absent and take a gap above.
const rowBefore = new Map<string, RowKind>()
let lastRow: RowKind = 'line'

// Doors whose rows draw nothing: the engine's injected context, a tool's
// result (the ToolUse row above draws it), a queue record.
const HIDDEN_DOORS = new Set(['attachment', 'hook-context', 'tool-result', 'queue'])

type StoredRow = {
  door: string
  uuid: string
  origin: { kind: string }
  message: { isMeta?: true; content: ReadonlyArray<{ type: string; text?: unknown }> }
}

/** The kinds of the visible rows a stored row draws, in order; none for a hidden row. */
function rowKinds(row: StoredRow): RowKind[] {
  if (HIDDEN_DOORS.has(row.door) || row.message.isMeta) return []
  const blocks = row.message.content
  if (row.door === 'prompt') {
    const text = blocks.map(b => (typeof b.text === 'string' ? b.text : '')).join('\n')
    return [row.origin.kind === 'composer' && commandEcho({ text }) === null ? 'panel' : 'line']
  }
  if (row.door === 'response') {
    const kinds: RowKind[] = []
    for (const block of blocks) {
      if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) kinds.push('panel')
      if (block.type === 'tool_use') kinds.push('line')
    }
    return kinds
  }
  return ['line']
}

/** Records a stored row's place among the visible rows. */
function noteRow(row: StoredRow): void {
  const last = rowKinds(row).at(-1)
  if (!last) return
  rowBefore.set(row.uuid, lastRow)
  lastRow = last
}

/** No gap above a panel that follows another panel, whose gap below is enough; one otherwise. */
function gapAbove(requestId: string): number {
  const before = rowBefore.get(requestId) ?? (requestId === 'placeholder' ? lastRow : 'line')
  return before === 'panel' ? 0 : 1
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

/**
 * The blocks as elements. Plain lines draw as Text, dim unless colored, in
 * `color` when the block is input. A code block draws through `Code`, which
 * highlights it and, under `format: 'diff'`, draws the patch's own gutters
 * and markers. Lines wrap when `open`, else cut at the edge.
 */
function blockElements({ Text, Code }: Elements, blocks: Block[], open: boolean, color?: string) {
  const wrap = open ? 'wrap' : 'truncate-end'
  return blocks.map(block => {
    if (block.kind === 'code') {
      const { source, language, path, format, startLine } = block.code
      return <Code source={source || ' '} language={language} path={path} format={format} startLine={startLine} wrap={wrap} />
    }
    return block.lines.map(line => (
      <Text dimColor={!line.color && !color} color={line.color ?? color} wrap={wrap}>{line.text}</Text>
    ))
  })
}

/** The call's file, for the highlighter: a Read's, an Edit's or a Write's. */
function inputPath(input: unknown): string | undefined {
  const path = (input as { file_path?: unknown } | null)?.file_path
  return typeof path === 'string' ? path : undefined
}

/** Whether the tree holds the engine's own drawing anywhere. */
function holdsEngine(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false
  const element = node as { type?: string; children?: unknown[] }
  return element.type === 'engine' || (element.children ?? []).some(holdsEngine)
}


/** One tool call, as `ToolUse` and the calls of a `ToolGroup` both carry it. */
type Call = {
  tool_use_id?: string
  tool: string
  input: unknown
  output?: unknown
  isRunning: boolean
  isErrored: boolean
  isInterrupted: boolean
}

/**
 * One tool call: a line headed by a chevron, and under it, when open, the
 * input and output. The ctrl+o transcript (`transcript`) shows every row open
 * with the longer preview and a fixed `▾`. Elsewhere the chevron is a button:
 * a row starts open under the `verbose` setting or when the call failed, else
 * closed, and the person's turn of it wins. An open row there shows `PREVIEW`
 * lines in all; `n more lines` reveals the rest in either view.
 */
async function drawCall($: EngineInterface, elements: Elements, call: Call, transcript: boolean, width: number) {
  const { Box, Text, Button } = elements
  const failed = call.isErrored || call.isInterrupted
  const colors = await palette($)
  const context = await pathContext($)
  const id = call.tool_use_id
  const held = id === undefined ? undefined : (await read($, opened))[id]
  const open = transcript || (held ?? ((await read($, verbose)) || failed))
  const mark = open ? '▾' : '▸'
  // A Button holds strings and Text only, so it holds the line's runs.
  const runs = toolLine(elements, labelRuns(call.tool, call.input, width, context, mark), colors, failed, call.isRunning)
  const head =
    transcript || id === undefined ? (
      <Box>{runs}</Box>
    ) : (
      <Box>
        <Button key={`fold-${id}`} label={`${open ? 'Close' : 'Open'} ${call.tool}`} plain onPress={() => toggleOpened($, id, open)}>
          {runs}
        </Button>
      </Box>
    )
  if (!open) return <Box paddingLeft={1}>{head}</Box>
  const full = id !== undefined && (await read($, revealed))[id] === true
  const input = inputBlocks(call.tool, call.input)
  const output = call.output === undefined ? [] : outputBlocks(call.output, failed, colors, inputPath(call.input))
  const [inputShown, outputShown] = full
    ? [input, output]
    : transcript
      ? [cutBlocks(input, INPUT_PREVIEW), cutBlocks(output, OUTPUT_PREVIEW)]
      : cutPair(input, output, PREVIEW, PREVIEW_INPUT_MAX)
  const hidden = countLines(input) - countLines(inputShown) + countLines(output) - countLines(outputShown)
  return (
    <Box flexDirection="column" width="100%" backgroundColor={PLAIN} paddingLeft={1} paddingRight={2}>
      {head}
      <Box position="absolute" left={0} bottom={-1} height={1} width="100%" backgroundColor={PLAIN} />
      <Box flexDirection="column" paddingLeft={2}>
        {blockElements(elements, inputShown, full, colors.tag)}
        {blockElements(elements, outputShown, full)}
        {id !== undefined && (hidden > 0 || full) ? (
          <Button key={`reveal-${id}`} plain onPress={() => toggleRevealed($, id)}>
            <Text color={colors.tag}>{full ? '▴ less' : `… ${hidden} more lines`}</Text>
          </Button>
        ) : null}
      </Box>
    </Box>
  )
}

export const register: Register = (on, options) => {
  fontCompat = options.fontCompat === true

  // The palette follows the theme: read at start and on every reload, again
  // when the person changes the theme, and every few seconds for `auto`.
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refreshScheme($)
    await refreshVerbose($)
    schemePoll?.cancel()
    schemePoll = $.clock.every(SCHEME_POLL_MS, () => refreshScheme($))
    return result
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    await refreshScheme($)
    return result
  })

  on('config.set', { key: 'verbose' }, async ($, e, next) => {
    const result = await next(e)
    await refreshVerbose($)
    return result
  })

  // Every row the conversation keeps passes here before it is stored, so a
  // message row finds its place in the table by the time it draws.
  on('session.append', async ($, e, next) => {
    noteRow(e)
    return next(e)
  })

  // The body is another mod's tree where one beneath drew one (code-brackets),
  // else Markdown from the text: the engine's row adds the ⏺ bullet, its indent
  // column and a top margin, and may not sit under `overflow`. A summary block
  // (text between tool calls, condensed) draws as an aside: plain words, dim
  // and italic, at most 3 lines. ctrl+o still shows the full text.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const elements = $.ui.resolve(e)
    const colors = await palette($)
    if (e.props.isSummary) {
      const width = Math.max(20, (e.viewport?.columns ?? 80) - ASIDE_INSET)
      const lines = clampLines(plainWords(e.props.text), width, ASIDE_LINES)
      const body = (
        <elements.Box flexDirection="column">
          {lines.map((line, i) => (
            <elements.Text key={String(i)} dimColor italic wrap="truncate-end">{line}</elements.Text>
          ))}
        </elements.Box>
      )
      return panel(elements, colors.assistant, body, gapAbove(e.requestId))
    }
    const drawn = await next(e)
    const body = holdsEngine(drawn) ? <elements.Markdown text={e.props.text} /> : drawn
    const text = e.props.text
    return panel(elements, colors.assistant, body, gapAbove(e.requestId), press => copyText($, text, press.surface))
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
    const text = e.props.text
    const copy: Copy = press => copyText($, unwrapPastes(text), press.surface)
    return panel(elements, colors.user, promptBody(elements, colors, text), gapAbove(e.requestId), copy)
  })

  // The line that closes a turn (`Baked for 3s · done 4:55 PM`) is the
  // engine's, drawn with a blank row above it and a `✻` glyph. The panel's
  // spacing already leaves room above it, so the mod draws the line itself:
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

  // A tool call is a line headed by a chevron, drawn by `drawCall`. The row's
  // output comes from `p.output`, so the engine's own ToolResult row is hidden
  // on this surface. Expanded without the `verbose` setting is the ctrl+o
  // transcript (or `--verbose` given on the command line, which the setting
  // does not show), where every row is open.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const p = e.props
    if (e.surface !== 'terminal') return next(e)
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const width = (e.viewport?.columns ?? 100) - 4
    const transcript = p.isExpanded === true && !(await read($, verbose))
    return drawCall($, { Box, Text, Button, Code }, p, transcript, width)
  })

  // The ToolUse row above draws the output itself, in every view.
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box display="none" />
  })

  // A group of calls draws each call as its own chevron row. `isCallsOnly` is
  // false when a call errored or was interrupted, and also when the group holds
  // other rows (recalled memory, hook timing). A failed call explains the first
  // case, so the group still draws its own rows, the failed one open and in the
  // error color. Otherwise the engine's line stays, pulled up over its blank row.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const p = e.props
    if (e.surface !== 'terminal' || p.isExpanded) return next(e)
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const failed = p.calls.some(call => call.isErrored || call.isInterrupted)
    if (p.isCallsOnly !== true && !failed) return <Box marginTop={-1}>{await next(e)}</Box>
    const width = (e.viewport?.columns ?? 100) - 4
    const rows = await Promise.all(p.calls.map(call => drawCall($, { Box, Text, Button, Code }, call, false, width)))
    return <Box flexDirection="column">{rows}</Box>
  })
}
