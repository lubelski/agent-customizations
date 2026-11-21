import type { EngineInterface, Register, UiPressArgument } from 'claude-code'

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

type Elements = { Box: any; Text: any; Code: any; Markdown: any; Button: any }

/** Copies one block's code, without fences or label. */
async function copyCode($: EngineInterface, source: string, surface: UiPressArgument['surface']) {
  const copied = await $.ui.copy({ text: source, surface })
  $.ui.toast(copied.isCopied ? 'Copied' : 'Could not copy code')
}

// The copy target, as on message-panels' panels (its `copyCell`): one gap
// cell after the label, then 4 cells. At rest they are blank. Under the
// pointer they read COPY, bold on the rule color. A hover can restyle a label
// but not change its text, so the word is a second Button, drawn
// `display: none` until its keyed Box is hovered.
const COPY_LABEL = 'COPY'
const COPY_GAP = 1

type Copy = (press: UiPressArgument) => void

function copyCell({ Box, Text, Button }: Elements, n: number, copy: Copy) {
  return (
    <Box key={`copy-cell-${n}`} width={COPY_LABEL.length} height={1} flexShrink={0}>
      <Button key={`copy-${n}`} plain onPress={copy}>
        <Text>{' '.repeat(COPY_LABEL.length)}</Text>
      </Button>
      <Box position="absolute" top={0} left={0} display="none" hover={{ display: 'flex' }}>
        <Button key={`copy-label-${n}`} plain onPress={copy}>
          <Text bold backgroundColor={RULE}>{COPY_LABEL}</Text>
        </Button>
      </Box>
    </Box>
  )
}

function body($: EngineInterface, elements: Elements, segments: Segment[]) {
  const { Box, Text, Code, Markdown } = elements
  let blocks = 0
  return (
    <Box flexDirection="column" gap={1}>
      {segments.map(segment => {
        if (segment.kind === 'markdown') return <Markdown text={segment.text} />
        const n = blocks++
        const copy: Copy = press => copyCode($, segment.source, press.surface)
        return (
          <Box flexDirection="column">
            <Box flexDirection="row" height={1}>
              <Text color={RULE}>{segment.language || '┌──'}</Text>
              <Text>{' '.repeat(COPY_GAP)}</Text>
              {copyCell(elements, n, copy)}
            </Box>
            <Box flexDirection="column" paddingLeft={2} overflow="hidden">
              <Code source={segment.source || ' '} language={segment.language || undefined} />
              <Box position="absolute" left={0} top={0} bottom={0} width={1}>
                <Text color={RULE}>{BAR}</Text>
              </Box>
            </Box>
            <Text color={RULE}>└──</Text>
          </Box>
        )
      })}
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
    const tree = body($, $.ui.resolve(e), segments)
    // The engine's own row: draw the body, and a panel mod above wraps it.
    if ((drawn as Node).type === 'engine') return tree
    // A panel mod beneath drew the text as Markdown: swap the body in place.
    return (replaceMarkdown(drawn, e.props.text, tree) ?? drawn) as typeof drawn
  })
}
