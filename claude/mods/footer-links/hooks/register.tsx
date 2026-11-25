import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Link } from '../types'

// After pi-customizations' set_footer_links: the model keeps a short list of
// the task's links (tickets, pull requests, mock pages), drawn as clickable
// links in the band above the prompt. The list lives in $.state for the
// session and is recovered from the transcript's last set_footer_links call after a
// resume, so a reload or a restart loses nothing. A link may name a group: the
// links of one piece of work (its ticket, pull request and agent session) draw
// together, and the band wraps between groups.

export const MAX_LINKS = 12
const MAX_LABEL = 32
const MAX_GROUP = 32
const MAX_URL = 2048
const TOOL = 'set_footer_links'
const TOOL_FULL = 'mcp__footer-links__set_footer_links'
// The tool's name before the mod was renamed from `links`: a resumed session
// from before the rename restores its list from calls under this name.
const OLD_TOOL_FULL = 'mcp__links__set_links'
const ACCENT = '#d97757'

// `group` is optional, so a list stored before it existed is still valid: the
// shape stays `links-1`.
const links = atom({ plugin: 'footer-links', key: 'links' } as const, [] as Link[], { shape: 'links-1' })

function cleanLabel(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * The list validated, cleaned and deduplicated by URL, its groups drawn
 * together in the order each group first appears; throws with the reason the
 * model reads. Links with no group form one group of their own.
 */
export function normalizeLinks(value: unknown): Link[] {
  if (!Array.isArray(value)) throw new Error('links must be an array')
  if (value.length > MAX_LINKS) throw new Error(`links are limited to ${MAX_LINKS} items`)
  const out: Link[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new Error('each link must have a label and a url')
    const { label: rawLabel, url: rawUrl, group: rawGroup } = item as Partial<Link>
    if (typeof rawLabel !== 'string' || typeof rawUrl !== 'string') throw new Error('each link must have a string label and url')
    if (rawGroup !== undefined && typeof rawGroup !== 'string') throw new Error(`a link group must be a string: ${rawLabel}`)
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
    const group = rawGroup === undefined ? '' : cleanLabel(rawGroup)
    if (group.length > MAX_GROUP) throw new Error(`link groups are limited to ${MAX_GROUP} characters: ${group}`)
    if (seen.has(url)) continue
    seen.add(url)
    out.push(group ? { label, url, group } : { label, url })
  }
  return groupLinks(out).flat()
}

/** The links in runs of one group each, in the order each group first appears. */
export function groupLinks(list: readonly Link[]): Link[][] {
  const groups = new Map<string, Link[]>()
  for (const link of list) {
    const key = link.group ?? ''
    const members = groups.get(key)
    if (members) members.push(link)
    else groups.set(key, [link])
  }
  return [...groups.values()]
}

/** The last set_footer_links (or old set_links) call's list in the conversation, for a session resumed or a mod reloaded with no state. */
function linksFromTranscript(messages: ReadonlyArray<{ toolUses: ReadonlyArray<{ tool: string; input: unknown }> }>): Link[] | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const uses = messages[i]?.toolUses ?? []
    for (let j = uses.length - 1; j >= 0; j -= 1) {
      const use = uses[j]
      if (use?.tool !== TOOL_FULL && use?.tool !== OLD_TOOL_FULL) continue
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

/** Opens the URL in the person's browser: macOS `open`, else `xdg-open`. */
async function openUrl($: EngineInterface, url: string): Promise<void> {
  for (const opener of ['open', 'xdg-open']) {
    try {
      const ran = await $.process.run([opener, url], { timeoutMs: 10_000 })
      if (ran.exitCode === 0) return
    } catch {
      // the opener is not on this host: try the next
    }
  }
  $.ui.toast(`Could not open ${url}`)
}

function describe(list: readonly Link[]): string {
  return list.length === 0 ? 'No links set.' : `Links: ${list.map(l => l.label).join(', ')}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: TOOL,
      description:
        'Replace the clickable links shown above the prompt for this session. Send the complete current list each time, with short labels, for pull requests, work tickets, local servers, and other linkable reference points relevant to the user. Pass an empty list to clear stale links. When the links belong to more than one piece of work, give each link a group: one key for each piece of work, such as a ticket with its pull request and its agent session. Do not group by kind, such as all pull requests together. Put the ticket first in its group. A label does not need to say which work it belongs to, because the group shows that.',
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
                group: {
                  type: 'string',
                  maxLength: MAX_GROUP,
                  description: 'Optional key for one piece of work, such as its ticket ID. Links with the same key draw together. The key is not shown.',
                },
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
    await $.command.register({ name: 'footer-links', description: 'Show the session links, or clear them', argumentHint: '[clear]' })
    await restore($)
    return next(e)
  })

  on('tool.call', { tool: TOOL_FULL }, async ($, e) => {
    let list: Link[]
    try {
      list = normalizeLinks((e as { links?: unknown }).links)
    } catch (error) {
      return { deny: `${TOOL}: ${(error as Error).message}` }
    }
    await update($, links, () => list)
    return { result: describe(list) }
  }).catch(() => ({ deny: `${TOOL}: the footer-links mod failed to store the list.` }))

  on('command.run', { command: 'footer-links' }, async ($, e) => {
    if (e.args.trim() === 'clear') {
      await update($, links, () => [])
      return { text: 'Links cleared.' }
    }
    const list = await read($, links)
    if (list.length === 0) return { text: 'No links set. The model sets them with set_footer_links; /footer-links clear removes them.' }
    return { text: list.map(l => `- ${l.label}: ${l.url}`).join('\n') }
  })

  on('prompt.compose', async ($, e, next) => {
    const { sections } = await next(e)
    return {
      sections: [
        ...sections,
        {
          id: 'footer-links:keep',
          scope: 'session',
          text: 'Call set_footer_links in the same turn you learn of a linkable reference point that\'s relevant to the user, such as a pull request, work ticket, or local server. That includes ones you open or start yourself, ones a subagent or background task reports back, and ones the user gives you. The links show above the prompt in the main session, so keep them current there even when other agents do the work. Send the complete current list each time. Keep a link listed while its task is still the topic, including a pull request after it merges. Remove links when they are no longer relevant. When the links cover more than one piece of work, group them by work: a ticket, its pull request, and its agent session share one group key. Do not group links by kind. Put the ticket first in its group, and keep labels short, without a parenthetical that only repeats which work the link belongs to.',
        },
      ],
    }
  })

  // A plain Button per link, its label alone: a Link's OSC 8 span becomes
  // `label URL` on a terminal the engine does not know (Rex), three times the
  // width. A press opens the URL with the host's opener.
  //
  // Each group is one row Box, so the band wraps between groups and never
  // inside one. A list with no group keys wraps between links, as before.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, links)
    if (e.props.hasSurvey || list.length === 0) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const grouped = list.some(link => link.group)
    const units = grouped ? groupLinks(list) : list.map(link => [link])
    let index = 0
    return (
      <Box flexDirection="row" flexWrap="wrap" justifyContent="flex-end" width={e.props.bodyColumns} paddingX={1}>
        {units.map((unit, u) => (
          <Box key={`unit-${u}`} flexDirection="row">
            {u > 0 ? <Text dimColor>{grouped ? ' │ ' : ' · '}</Text> : null}
            {unit.flatMap((link, i) => [
              i > 0 ? <Text dimColor> · </Text> : null,
              <Button key={`link-${index++}`} plain onPress={() => openUrl($, link.url)}>
                <Text color={ACCENT} underline>{link.label}</Text>
              </Button>,
            ])}
          </Box>
        ))}
      </Box>
    )
  })
}
