import { expect, test } from 'claude-code/testing'
import { splitFences } from '../hooks/register.tsx'

test('splits prose and closed fences', async () => {
  const segments = splitFences('Intro:\n\n```ts\nconst x = 1\n```\n\nAfter.')
  expect(segments).toEqual([
    { kind: 'markdown', text: 'Intro:\n' },
    { kind: 'code', language: 'ts', source: 'const x = 1' },
    { kind: 'markdown', text: '\nAfter.' },
  ])
})

test('an unclosed fence runs to the end, as while streaming', async () => {
  expect(splitFences('```py\nprint(1)')).toEqual([{ kind: 'code', language: 'py', source: 'print(1)' }])
})

test('a longer fence holds a shorter one', async () => {
  const segments = splitFences('````md\n```js\nx\n```\n````')
  expect(segments).toEqual([{ kind: 'code', language: 'md', source: '```js\nx\n```' }])
})

test('tilde fences and no language', async () => {
  expect(splitFences('~~~\nplain\n~~~')).toEqual([{ kind: 'code', language: '', source: 'plain' }])
})
