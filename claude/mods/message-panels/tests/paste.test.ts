import { expect, test } from 'claude-code/testing'
import { segments, unwrapPastes } from '../hooks/paste.ts'

const prompt = '\n\n<pasted_content id="ca06">\nUnknown owner on line 103\n  indented\n</pasted_content id="ca06">\n\n\ntrack down the owners'

test('a paste splits from the typed text around it', async () => {
  expect(segments(prompt)).toEqual([
    { kind: 'pasted', text: 'Unknown owner on line 103\n  indented' },
    { kind: 'typed', text: 'track down the owners' },
  ])
})

test('the space typed after a paste is dropped', async () => {
  expect(segments('<pasted_content id="a">  code</pasted_content id="a"> why?')).toEqual([
    { kind: 'pasted', text: '  code' },
    { kind: 'typed', text: 'why?' },
  ])
})

test('typed text with no paste is one segment', async () => {
  expect(segments('hello\nthere')).toEqual([{ kind: 'typed', text: 'hello\nthere' }])
})

test('a closing tag must match its own id', async () => {
  const text = 'a <pasted_content id="x">one</pasted_content id="y"> b <pasted_content id="z">two</pasted_content id="z">'
  expect(segments(text)).toEqual([
    { kind: 'typed', text: 'a <pasted_content id="x">one</pasted_content id="y"> b' },
    { kind: 'pasted', text: 'two' },
  ])
})

test('copy drops the tags and keeps the words', async () => {
  expect(unwrapPastes(prompt)).toBe('Unknown owner on line 103\n  indented\n\ntrack down the owners')
})
