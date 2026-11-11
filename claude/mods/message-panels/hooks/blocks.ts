// An expanded tool row lists the call's input, then its output. Each is a
// list of blocks: plain lines, or a source the row draws through the API's
// `Code` element, which highlights it as a reply's code fence is highlighted.
// A preview shows the first lines of the list, so a block is cut by lines
// before it is drawn, and a count of what was cut stays exact.

export type Line = { text: string; color?: string }

/** A source the `Code` element draws: a command, a file's content, or a unified diff. */
export type Source = { source: string; language?: string; path?: string; format?: 'source' | 'diff'; startLine?: number }

export type Block = { kind: 'lines'; lines: Line[] } | { kind: 'code'; code: Source }

/** The colors a block names: the error color for stderr and an error, the tag color for a note. */
export type BlockColors = { error: string; tag: string }

export const splitLines = (value: string): string[] =>
  value.replace(/\r\n?/g, '\n').replace(/\n$/, '').replace(/\t/g, '    ').split('\n')

const plain = (value: string, color?: string): Block => ({ kind: 'lines', lines: splitLines(value).map(text => ({ text, color })) })

const lines = (lines: Line[]): Block => ({ kind: 'lines', lines })

const code = (code: Source): Block => ({ kind: 'code', code })

// Edit and Write carry their text in the output's patch, so their input
// shows the path and the flags alone.
const SHOWN_IN_OUTPUT = new Set(['old_string', 'new_string', 'content'])

// The input field drawn as code, by tool, with its language.
const CODE_INPUT: Record<string, { key: string; language: string }> = {
  Bash: { key: 'command', language: 'bash' },
}

/** The call's input as blocks: `key: value` lines, with a command drawn as code. */
export const inputBlocks = (tool: string, input: unknown): Block[] => {
  if (typeof input === 'string') return [plain(input)]
  if (!input || typeof input !== 'object') return []
  const blocks: Block[] = []
  const pending: Line[] = []
  const flush = () => {
    if (pending.length) blocks.push(lines(pending.splice(0)))
  }
  const asCode = CODE_INPUT[tool]
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined || value === null) continue
    if ((tool === 'Edit' || tool === 'Write') && SHOWN_IN_OUTPUT.has(key)) continue
    if (typeof value === 'string') {
      if (asCode && key === asCode.key) {
        flush()
        blocks.push(code({ source: value, language: asCode.language }))
      } else if (value.includes('\n')) {
        pending.push({ text: `${key}:` }, ...splitLines(value).map(l => ({ text: `  ${l}` })))
      } else {
        pending.push({ text: `${key}: ${value}` })
      }
    } else {
      pending.push({ text: `${key}: ${JSON.stringify(value)}` })
    }
  }
  flush()
  return blocks
}

export type Hunk = { oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }

/** The hunks as a unified diff the `Code` element reads. */
export const diffSource = (hunks: Hunk[]): string =>
  hunks.map(hunk => [`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`, ...hunk.lines].join('\n')).join('\n')

/**
 * The call's result as blocks: Bash's stdout and stderr, a Read's content as
 * code numbered from its first line, an Edit's or Write's patch as a diff, a
 * plugin tool's text blocks, and JSON for anything else. An errored call's
 * result is the error text. `path` is the call's file, for the highlighter.
 */
export const outputBlocks = (output: unknown, errored: boolean, colors: BlockColors, path?: string): Block[] => {
  if (output === undefined || output === null) return []
  if (typeof output === 'string') return [plain(output, errored ? colors.error : undefined)]
  if (Array.isArray(output)) {
    return output.map(block => {
      const b = block as { type?: unknown; text?: unknown }
      if (b && typeof b.text === 'string') return plain(b.text)
      if (b && b.type === 'image') return lines([{ text: '[image]' }])
      return plain(JSON.stringify(block))
    })
  }
  if (typeof output !== 'object') return [lines([{ text: String(output) }])]
  const r = output as Record<string, unknown>
  if (typeof r.stdout === 'string' || typeof r.stderr === 'string') {
    const out: Block[] = []
    if (r.isImage) out.push(lines([{ text: '[image]' }]))
    else if (typeof r.stdout === 'string' && r.stdout.trim()) out.push(plain(r.stdout))
    if (typeof r.stderr === 'string' && r.stderr.trim()) out.push(plain(r.stderr, colors.error))
    if (typeof r.backgroundTaskId === 'string') out.push(lines([{ text: `running in background · ${r.backgroundTaskId}`, color: colors.tag }]))
    return out
  }
  if (Array.isArray(r.structuredPatch) && r.structuredPatch.length > 0) {
    return [code({ source: diffSource(r.structuredPatch as Hunk[]), format: 'diff' })]
  }
  if (r.file && typeof r.file === 'object') {
    const file = r.file as Record<string, unknown>
    if (typeof file.content === 'string') {
      const startLine = typeof file.startLine === 'number' ? file.startLine : 1
      return [code({ source: file.content, path, startLine })]
    }
    if (typeof file.base64 === 'string') return [lines([{ text: `[${typeof file.type === 'string' ? file.type : 'binary'}]` }])]
  }
  if (typeof r.content === 'string') return [plain(r.content)]
  if (Array.isArray(r.filenames)) return [lines(r.filenames.map(f => ({ text: String(f) })))]
  if (typeof r.message === 'string') return [plain(r.message)]
  return [plain(JSON.stringify(output, null, 2))]
}

const sourceLines = (source: string): string[] => source.replace(/\n$/, '').split('\n')

/** How many rows the blocks take drawn in full. */
export const countLines = (blocks: Block[]): number =>
  blocks.reduce((sum, block) => sum + (block.kind === 'lines' ? block.lines.length : sourceLines(block.code.source).length), 0)

// A hunk header, whose counts the cut rewrites to what it kept.
const HEADER = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/

/**
 * A diff cut to its first `limit` lines that still parses: the last hunk's
 * counts say how many old and new lines the cut kept.
 */
export const cutDiff = (source: string, limit: number): string => {
  const kept = sourceLines(source).slice(0, limit)
  let header = -1
  for (let i = kept.length - 1; i >= 0; i--) {
    if (HEADER.test(kept[i] ?? '')) {
      header = i
      break
    }
  }
  if (header < 0) return kept.join('\n')
  const body = kept.slice(header + 1)
  const old = body.filter(line => !line.startsWith('+')).length
  const added = body.filter(line => !line.startsWith('-')).length
  const match = HEADER.exec(kept[header] ?? '')
  if (match) kept[header] = `@@ -${match[1]},${old} +${match[3]},${added} @@`
  return kept.join('\n')
}

/** The blocks' first `limit` rows: whole blocks, then one cut by lines. */
export const cutBlocks = (blocks: Block[], limit: number): Block[] => {
  const out: Block[] = []
  let room = limit
  for (const block of blocks) {
    if (room <= 0) break
    const count = block.kind === 'lines' ? block.lines.length : sourceLines(block.code.source).length
    if (count <= room) {
      out.push(block)
      room -= count
      continue
    }
    if (block.kind === 'lines') out.push(lines(block.lines.slice(0, room)))
    else {
      const source = block.code.format === 'diff' ? cutDiff(block.code.source, room) : sourceLines(block.code.source).slice(0, room).join('\n')
      out.push(code({ ...block.code, source }))
    }
    room = 0
  }
  return out
}
