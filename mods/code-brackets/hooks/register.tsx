import type { Register } from 'claude-code'

// After pi-customizations/extensions/code-brackets.ts: a fenced block draws as
//
//   ts
//   │ export const x = 1
//   └──
//
// The label is the fence's language, or `┌──` when it names none.
const RULE = '#6e6058'
// A column of `│`, taller than any block, clipped by its parent's overflow.
const BAR = '│\n'.repeat(2000)

type Segment =
  | { kind: 'markdown'; text: string }
  | { kind: 'code'; language: string; source: string }

/** Splits markdown on top-level fences. An unclosed fence (a reply still streaming) runs to the end. */
export function splitFences(text: string): Segment[] {
  const lines = text.split('\n')
  const segments: Segment[] = []
  let prose: string[] = []
  const flush = () => {
    if (prose.join('\n').trim()) segments.push({ kind: 'markdown', text: prose.join('\n') })
    prose = []
  }
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const open = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[^`]*$/.exec(line)
    if (!open) {
      prose.push(line)
      i += 1
      continue
    }
    flush()
    const fence = open[1] ?? '```'
    const close = new RegExp(`^ {0,3}\\${fence[0]}{${fence.length},}[ \\t]*$`)
    const body: string[] = []
    i += 1
    while (i < lines.length && !close.test(lines[i] ?? '')) {
      body.push(lines[i] ?? '')
      i += 1
    }
    i += 1 // the closing fence, or past the end
    segments.push({ kind: 'code', language: open[2] ?? '', source: body.join('\n') })
  }
  flush()
  return segments
}

type Elements = { Box: any; Text: any; Code: any; Markdown: any }

function body({ Box, Text, Code, Markdown }: Elements, segments: Segment[]) {
  return (
    <Box flexDirection="column" gap={1}>
      {segments.map(segment =>
        segment.kind === 'markdown' ? (
          <Markdown text={segment.text} />
        ) : (
          <Box flexDirection="column">
            <Text color={RULE}>{segment.language || '┌──'}</Text>
            <Box flexDirection="column" paddingLeft={2} overflow="hidden">
              <Code source={segment.source || ' '} language={segment.language || undefined} />
              <Box position="absolute" left={0} top={0} bottom={0} width={1}>
                <Text color={RULE}>{BAR}</Text>
              </Box>
            </Box>
            <Text color={RULE}>└──</Text>
          </Box>
        ),
      )}
    </Box>
  )
}

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }

/** The tree with the Markdown element that draws `text` swapped for `replacement`; null when none does. */
function replaceMarkdown(node: unknown, text: string, replacement: unknown): unknown | null {
  if (!node || typeof node !== 'object') return null
  const element = node as Node
  if (element.type === 'Markdown' && element.props?.text === text) return replacement
  if (!Array.isArray(element.children)) return null
  for (let i = 0; i < element.children.length; i += 1) {
    const swapped = replaceMarkdown(element.children[i], text, replacement)
    if (swapped !== null) {
      const children = [...element.children]
      children[i] = swapped
      return { ...element, children }
    }
  }
  return null
}

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const drawn = await next(e)
    if (e.surface !== 'terminal' || e.props.isSummary) return drawn
    const segments = splitFences(e.props.text)
    if (!segments.some(s => s.kind === 'code')) return drawn
    const tree = body($.ui.resolve(e), segments)
    // The engine's own row: draw the body, and a panel mod above wraps it.
    if ((drawn as Node).type === 'engine') return tree
    // A panel mod beneath drew the text as Markdown: swap the body in place.
    return (replaceMarkdown(drawn, e.props.text, tree) ?? drawn) as typeof drawn
  })
}
