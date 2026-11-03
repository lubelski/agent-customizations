import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Link } from '../types'

// After pi-customizations' set_footer_links: the model keeps a short list of
// the task's links (tickets, pull requests, mock pages), drawn as clickable
// links in the band above the prompt. The list lives in $.state for the
// session and is recovered from the transcript's last set_links call after a
// resume, so a reload or a restart loses nothing.

export const MAX_LINKS = 8
const MAX_LABEL = 32
const MAX_URL = 2048
const TOOL = 'set_links'
const TOOL_FULL = 'mcp__links__set_links'
const ACCENT = '#d97757'

const links = atom({ plugin: 'links', key: 'links' } as const, [] as Link[], { shape: 'links-1' })

function cleanLabel(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** The list validated, cleaned and deduplicated by URL; throws with the reason the model reads. */
export function normalizeLinks(value: unknown): Link[] {
  if (!Array.isArray(value)) throw new Error('links must be an array')
  if (value.length > MAX_LINKS) throw new Error(`links are limited to ${MAX_LINKS} items`)
  const out: Link[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new Error('each link must have a label and a url')
    const { label: rawLabel, url: rawUrl } = item as Partial<Link>
    if (typeof rawLabel !== 'string' || typeof rawUrl !== 'string') throw new Error('each link must have a string label and url')
    const label = cleanLabel(rawLabel)
    if (!label) throw new Error('a link label cannot be empty')
    if (label.length > MAX_LABEL) throw new Error(`link labels are limited to ${MAX_LABEL} characters: ${label}`)
    const url = rawUrl.trim()
    if (url.length > MAX_URL) throw new Error(`link urls are limited to ${MAX_URL} characters: ${label}`)
    if (/[\s\u0000-\u001f\u007f-\u009f]/.test(url)) throw new Error(`a link url cannot hold whitespace or control characters: ${label}`)
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error(`invalid link url: ${url}`)
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(`links must use http or https: ${url}`)
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ label, url })
  }
  return out
}

/** The last set_links call's list in the conversation, for a session resumed or a mod reloaded with no state. */
function linksFromTranscript(messages: ReadonlyArray<{ toolUses: ReadonlyArray<{ tool: string; input: unknown }> }>): Link[] | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const uses = messages[i]?.toolUses ?? []
    for (let j = uses.length - 1; j >= 0; j -= 1) {
      const use = uses[j]
      if (use?.tool !== TOOL_FULL) continue
      try {
        return normalizeLinks((use.input as { links?: unknown })?.links)
      } catch {
        return null
      }
    }
  }
  return null
}

async function restore($: EngineInterface): Promise<void> {
  const held = await read($, links)
  if (held.length > 0) return
  const found = linksFromTranscript(await $.session.messages())
  if (found && found.length > 0) await update($, links, () => found)
}

function describe(list: readonly Link[]): string {
  return list.length === 0 ? 'No links set.' : `Links: ${list.map(l => l.label).join(', ')}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: TOOL,
      description:
        'Replace the clickable links shown above the prompt for this session. Send the complete current list each time, with short labels, for the task\'s Linear tickets, pull requests, local mock or Storybook pages, and similar resources. Pass an empty list to clear stale links.',
      inputSchema: {
        type: 'object',
        properties: {
          links: {
            type: 'array',
            maxItems: MAX_LINKS,
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', maxLength: MAX_LABEL, description: 'Short label, such as "PR #12" or "LIN-123"' },
                url: { type: 'string', maxLength: MAX_URL, description: 'An http or https URL' },
              },
              required: ['label', 'url'],
              additionalProperties: false,
            },
          },
        },
        required: ['links'],
        additionalProperties: false,
      },
      isDeferred: false,
    })
    await $.command.register({ name: 'links', description: 'Show the session links, or clear them', argumentHint: '[clear]' })
    await restore($)
    return next(e)
  })

  on('tool.call', { tool: 'mcp__links__set_links' }, async ($, e) => {
    let list: Link[]
    try {
      list = normalizeLinks((e as { links?: unknown }).links)
    } catch (error) {
      return { deny: `set_links: ${(error as Error).message}` }
    }
    await update($, links, () => list)
    return { result: describe(list) }
  }).catch(() => ({ deny: 'set_links: the links mod failed to store the list.' }))

  on('command.run', { command: 'links' }, async ($, e) => {
    if (e.args.trim() === 'clear') {
      await update($, links, () => [])
      return { text: 'Links cleared.' }
    }
    const list = await read($, links)
    if (list.length === 0) return { text: 'No links set. The model sets them with set_links; /links clear removes them.' }
    return { text: list.map(l => `- ${l.label}: ${l.url}`).join('\n') }
  })

  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)
    return {
      sections: [
        ...sections,
        {
          id: 'links:keep',
          scope: 'session',
          text: 'Keep the task\'s relevant links (Linear tickets, pull requests, local mock or Storybook pages) shown with the set_links tool. Send the complete current list on each update, and clear links that stop being relevant.',
        },
      ],
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, links)
    if (e.props.hasSurvey || list.length === 0) return next(e)
    const { Box, Text, Link } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" flexWrap="wrap" justifyContent="flex-end" width={e.props.bodyColumns} paddingX={1}>
        {list.map((link, i) => (
          <Box flexDirection="row">
            {i > 0 ? <Text dimColor> · </Text> : null}
            <Text color={ACCENT} underline>
              <Link href={link.url} label={link.label} />
            </Text>
          </Box>
        ))}
      </Box>
    )
  })
}
