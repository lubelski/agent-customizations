import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { MAX_LINKS, normalizeLinks } from '../hooks/register.tsx'

test('cleans labels and drops duplicate urls', async () => {
  const links = normalizeLinks([
    { label: '  PR\t#12 ', url: 'https://github.com/o/r/pull/12' },
    { label: 'again', url: 'https://github.com/o/r/pull/12' },
    { label: 'LIN-1', url: 'http://linear.app/x/LIN-1' },
  ])
  expect(links).toEqual([
    { label: 'PR #12', url: 'https://github.com/o/r/pull/12' },
    { label: 'LIN-1', url: 'http://linear.app/x/LIN-1' },
  ])
})

test('refuses what the band must not draw', async () => {
  expect(() => normalizeLinks('nope')).toThrow('links must be an array')
  expect(() => normalizeLinks([{ label: '', url: 'https://a.b' }])).toThrow('cannot be empty')
  expect(() => normalizeLinks([{ label: 'x', url: 'file:///etc/passwd' }])).toThrow('http or https')
  expect(() => normalizeLinks([{ label: 'x', url: 'https://a.b/ c' }])).toThrow('whitespace')
  expect(() => normalizeLinks([{ label: 'x', url: 'notaurl' }])).toThrow('invalid link url')
  const many = Array.from({ length: MAX_LINKS + 1 }, (_, i) => ({ label: `l${i}`, url: `https://a.b/${i}` }))
  expect(() => normalizeLinks(many)).toThrow(`limited to ${MAX_LINKS}`)
})

test('an empty list clears', async () => {
  expect(normalizeLinks([])).toEqual([])
})

test('draws groups together, in the order each first appears', async () => {
  const links = normalizeLinks([
    { label: 'SPM-1', url: 'https://l.app/SPM-1', group: 'SPM-1' },
    { label: 'SPM-2', url: 'https://l.app/SPM-2', group: 'SPM-2' },
    { label: 'parent', url: 'https://l.app/SPM-0' },
    { label: '#11', url: 'https://g.com/pull/11', group: ' SPM-1\t' },
    { label: '#12', url: 'https://g.com/pull/12', group: 'SPM-2' },
    { label: 'Atlas', url: 'https://atlas.app/1', group: 'SPM-1' },
    { label: 'docs', url: 'https://docs.app' },
  ])
  expect(links.map(l => `${l.group ?? '-'} ${l.label}`)).toEqual([
    'SPM-1 SPM-1',
    'SPM-1 #11',
    'SPM-1 Atlas',
    'SPM-2 SPM-2',
    'SPM-2 #12',
    '- parent',
    '- docs',
  ])
})

test('keeps a group of one link, and an empty group means none', async () => {
  expect(
    normalizeLinks([
      { label: 'a', url: 'https://a.b/1', group: 'x' },
      { label: 'b', url: 'https://a.b/2', group: '  ' },
    ]),
  ).toEqual([
    { label: 'a', url: 'https://a.b/1', group: 'x' },
    { label: 'b', url: 'https://a.b/2' },
  ])
  expect(() => normalizeLinks([{ label: 'a', url: 'https://a.b', group: 3 }])).toThrow('group must be a string')
  expect(() => normalizeLinks([{ label: 'a', url: 'https://a.b', group: 'g'.repeat(33) }])).toThrow('groups are limited')
})

test('a list with no groups keeps its order', async () => {
  const flat = Array.from({ length: MAX_LINKS }, (_, i) => ({ label: `l${i}`, url: `https://a.b/${i}` }))
  expect(normalizeLinks(flat)).toEqual(flat)
})

const OLD_TOOL = 'mcp__links__set_links'
const TOOL = 'mcp__footer-links__set_footer_links'

const BAND = { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 10, bodyColumns: 80 } as never

/** The band as drawn: each row Box the outer Box wraps by, as its shown text. */
async function bandUnits($: Engine): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: 'footer-links', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const outer = (await ui.drawn()) as { children: Array<{ children: unknown[] }> }
  const text = (node: unknown): string =>
    typeof node === 'string' ? node : ((node as { children?: unknown[] }).children ?? []).map(text).join('')
  return outer.children.map(text)
}

test('draws each group as one unit, joined by │', async $ => {
  await $.tool.call({
    tool: TOOL,
    links: [
      { label: 'SPM-0', url: 'https://l.app/SPM-0' },
      { label: 'SPM-1', url: 'https://l.app/SPM-1', group: 'SPM-1' },
      { label: '#11', url: 'https://g.com/pull/11', group: 'SPM-1' },
      { label: 'SPM-2', url: 'https://l.app/SPM-2', group: 'SPM-2' },
      { label: '#12', url: 'https://g.com/pull/12', group: 'SPM-2' },
    ],
  } as never)
  expect(await bandUnits($)).toEqual(['SPM-0', ' │ SPM-1 · #11', ' │ SPM-2 · #12'])
})

test('draws a list without groups as before, one unit per link', async $ => {
  await $.tool.call({
    tool: TOOL,
    links: [
      { label: 'PR #12', url: 'https://g.com/pull/12' },
      { label: 'LIN-1', url: 'https://l.app/LIN-1' },
    ],
  } as never)
  expect(await bandUnits($)).toEqual(['PR #12', ' · LIN-1'])
})

/** Starts a session whose transcript holds these set_links calls, oldest first. */
async function resume($: Engine, on: On, calls: Array<[tool: string, links: unknown]>): Promise<void> {
  const value = calls.map(([tool, links]) => ({ role: 'assistant', text: '', toolUses: [{ tool, input: { links } }] }))
  on('session.messages', async () => ({ value }) as never)
  on('tool.register', async () => ({ value: { tool: 'set_footer_links' } }) as never)
  on('command.register', async () => ({ value: { command: 'footer-links' } }) as never)
  on('session.start', async () => ({ cwd: '/' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
}

test('restores an old flat call from before the rename', async ($, on) => {
  await resume($, on, [
    [OLD_TOOL, [{ label: 'old', url: 'https://a.b/old' }]],
    [OLD_TOOL, [{ label: 'PR #12', url: 'https://g.com/pull/12' }, { label: 'LIN-1', url: 'https://l.app/LIN-1' }]],
  ])
  expect(await bandUnits($)).toEqual(['PR #12', ' · LIN-1'])
})

test('restores the last grouped call, under either name', async ($, on) => {
  await resume($, on, [
    [OLD_TOOL, [{ label: 'old', url: 'https://a.b/old' }]],
    [TOOL, [
      { label: 'SPM-1', url: 'https://l.app/SPM-1', group: 'SPM-1' },
      { label: 'SPM-2', url: 'https://l.app/SPM-2', group: 'SPM-2' },
      { label: '#11', url: 'https://g.com/pull/11', group: 'SPM-1' },
    ]],
  ])
  expect(await bandUnits($)).toEqual(['SPM-1 · #11', ' │ SPM-2'])
})
