import { expect, test } from 'claude-code/testing'
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
