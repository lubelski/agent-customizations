/**
 * A prompt's text in order: what the person typed, and what they pasted. The
 * engine wraps a paste as `<pasted_content id="ab12">…</pasted_content id="ab12">`.
 */
export type Segment = { kind: 'typed' | 'pasted'; text: string }

const PASTE = /<pasted_content id="([^"]*)">([\s\S]*?)<\/pasted_content id="\1">/g

/** Blank lines at either end dropped; indentation on the first line kept. */
function trimLines(text: string): string {
  return text.replace(/^(\s*\n)+/, '').trimEnd()
}

/** The prompt split into typed and pasted segments, empty ones dropped. */
export function segments(text: string): Segment[] {
  const out: Segment[] = []
  const push = (kind: Segment['kind'], raw: string) => {
    const trimmed = trimLines(raw)
    if (trimmed) out.push({ kind, text: trimmed })
  }
  let at = 0
  for (const match of text.matchAll(PASTE)) {
    push('typed', text.slice(at, match.index))
    push('pasted', match[2] ?? '')
    at = match.index + match[0].length
  }
  push('typed', text.slice(at))
  return out
}

/** The prompt as the person sees it: each paste's tags removed, its text kept. */
export function unwrapPastes(text: string): string {
  return segments(text)
    .map(s => s.text)
    .join('\n\n')
}
