import { expect, test } from 'claude-code/testing'
import { countLines, cutBlocks, cutDiff, cutPair, diffSource, inputBlocks, outputBlocks } from '../hooks/blocks.ts'

const colors = { error: 'red', tag: 'tag' }

test('a Bash command is a code block; its other fields stay lines', async () => {
  expect(inputBlocks('Bash', { command: 'git status\nls', description: 'Show status' })).toEqual([
    { kind: 'code', code: { source: 'git status\nls', language: 'bash' } },
    { kind: 'lines', lines: [{ text: 'description: Show status' }] },
  ])
})

test('an Edit shows its path alone; its text is in the output patch', async () => {
  expect(inputBlocks('Edit', { file_path: '/a.ts', old_string: 'x', new_string: 'y' })).toEqual([
    { kind: 'lines', lines: [{ text: 'file_path: /a.ts' }] },
  ])
  const hunks = [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-x', '+y'] }]
  expect(outputBlocks({ structuredPatch: hunks }, false, colors)).toEqual([
    { kind: 'code', code: { source: '@@ -1,1 +1,1 @@\n-x\n+y', format: 'diff' } },
  ])
})

test("a Read's content is code at the file's path, numbered from its first line", async () => {
  expect(outputBlocks({ file: { content: 'a\nb', startLine: 10 } }, false, colors, '/x.ts')).toEqual([
    { kind: 'code', code: { source: 'a\nb', path: '/x.ts', startLine: 10 } },
  ])
})

test('stdout is dim lines and stderr is error lines', async () => {
  expect(outputBlocks({ stdout: 'ok\n', stderr: 'bad' }, false, colors)).toEqual([
    { kind: 'lines', lines: [{ text: 'ok' }] },
    { kind: 'lines', lines: [{ text: 'bad', color: 'red' }] },
  ])
})

test('a preview keeps whole blocks, then cuts one by lines, and the count stays exact', async () => {
  const blocks = [
    { kind: 'lines' as const, lines: [{ text: '1' }, { text: '2' }] },
    { kind: 'code' as const, code: { source: 'a\nb\nc\nd', language: 'bash' } },
  ]
  expect(countLines(blocks)).toBe(6)
  const cut = cutBlocks(blocks, 4)
  expect(cut).toEqual([blocks[0], { kind: 'code', code: { source: 'a\nb', language: 'bash' } }])
  expect(countLines(cut)).toBe(4)
  expect(cutBlocks(blocks, 0)).toEqual([])
})

test('a cut diff rewrites its last hunk so it still parses', async () => {
  const source = diffSource([
    { oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: [' a', '-b', '+c'] },
    { oldStart: 9, oldLines: 3, newStart: 9, newLines: 4, lines: [' x', '+y', ' z', '+w', ' q'] },
  ])
  expect(cutDiff(source, 8)).toBe('@@ -1,2 +1,2 @@\n a\n-b\n+c\n@@ -9,2 +9,3 @@\n x\n+y\n z')
  expect(cutDiff(source, 2)).toBe('@@ -1,1 +1,1 @@\n a')
  expect(cutDiff(source, 1)).toBe('@@ -1,0 +1,0 @@')
})

const rows = (n: number, prefix: string) => [{ kind: 'lines' as const, lines: Array.from({ length: n }, (_, i) => ({ text: `${prefix}${i}` })) }]

test('a shared preview gives input at most its cap when output follows', async () => {
  const [input, output] = cutPair(rows(5, 'i'), rows(20, 'o'), 7, 3)
  expect(countLines(input)).toBe(3)
  expect(countLines(output)).toBe(4)
})

test('short output leaves its room to the input', async () => {
  const [input, output] = cutPair(rows(5, 'i'), rows(1, 'o'), 7, 3)
  expect(countLines(input)).toBe(5)
  expect(countLines(output)).toBe(1)
})

test('input alone takes the whole preview', async () => {
  const [input, output] = cutPair(rows(10, 'i'), [], 7, 3)
  expect(countLines(input)).toBe(7)
  expect(countLines(output)).toBe(0)
})
