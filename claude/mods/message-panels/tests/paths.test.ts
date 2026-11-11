import { expect, test } from 'claude-code/testing'
import { fitPath, pathRuns, shortenPath } from '../hooks/paths.ts'

const repo = '/Users/me/dev/mercury-web'
const context = { cwd: repo, home: '/Users/me' }

test('a worktree file reads as the worktree name and its path', async () => {
  expect(shortenPath(`${repo}/.claude/worktrees/pool-06/src/index.tsx`, context)).toBe('pool-06 - src/index.tsx')
})

test('inside the worktree it runs in, the session shows the relative path', async () => {
  const cwd = `${repo}/.claude/worktrees/pool-06`
  expect(shortenPath(`${cwd}/src/index.tsx`, { ...context, cwd })).toBe('src/index.tsx')
})

test('beneath the session directory, then beneath home', async () => {
  expect(shortenPath(`${repo}/src/a.ts`, context)).toBe('src/a.ts')
  expect(shortenPath('/Users/me/.claude/CLAUDE.md', context)).toBe('~/.claude/CLAUDE.md')
  expect(shortenPath('/Users/me-two/x', context)).toBe('/Users/me-two/x')
  expect(shortenPath('/etc/hosts', { cwd: repo, home: undefined })).toBe('/etc/hosts')
})

test('a wide path drops directories from its middle', async () => {
  const path = 'pool-06 - src/pages/Settings/ActivityLog/components/ActivityLogTimeline/styles.module.css'
  expect(fitPath(path, 200)).toBe(path)
  expect(fitPath(path, 64)).toBe('pool-06 - src/…/components/ActivityLogTimeline/styles.module.css')
  expect(fitPath(path, 60)).toBe('pool-06 - src/…/ActivityLogTimeline/styles.module.css')
  expect(fitPath(path, 40)).toBe('pool-06 - src/…/styles.module.css')
  expect(fitPath(path, 22)).toBe('…/styles.module.css')
  expect(fitPath(path, 10)).toBe('pool-06 -…')
})

test('a path draws its stand-in prefix tagged, directories dim and the file name in text', async () => {
  expect(pathRuns(`${repo}/.claude/worktrees/pool-06/src/index.tsx`, context, 80)).toEqual([
    { text: 'pool-06', tone: 'tag' },
    { text: ' - src/', tone: 'dim' },
    { text: 'index.tsx', tone: 'text' },
  ])
  expect(pathRuns('/Users/me/notes.md', context, 80)).toEqual([
    { text: '~', tone: 'tag' },
    { text: '/', tone: 'dim' },
    { text: 'notes.md', tone: 'text' },
  ])
  expect(pathRuns('/Users/me', context, 80)).toEqual([{ text: '~', tone: 'tag' }])
  expect(pathRuns(`${repo}/src/a.ts`, context, 80)).toEqual([{ text: 'src/', tone: 'dim' }, { text: 'a.ts', tone: 'text' }])
  expect(pathRuns('README.md', context, 80)).toEqual([{ text: 'README.md', tone: 'text' }])
})

test('a literal ~ the model wrote is not a stand-in', async () => {
  expect(pathRuns('~/notes.md', context, 80)).toEqual([{ text: '~/', tone: 'dim' }, { text: 'notes.md', tone: 'text' }])
})

test('a cut path keeps its tones; one cut past its prefix draws dim to the name', async () => {
  const path = `${repo}/.claude/worktrees/pool-06/src/pages/Settings/ActivityLog/styles.module.css`
  expect(pathRuns(path, context, 40)).toEqual([
    { text: 'pool-06', tone: 'tag' },
    { text: ' - src/…/', tone: 'dim' },
    { text: 'styles.module.css', tone: 'text' },
  ])
  expect(pathRuns(path, context, 22)).toEqual([{ text: '…/', tone: 'dim' }, { text: 'styles.module.css', tone: 'text' }])
  expect(pathRuns(path, context, 10)).toEqual([{ text: 'pool-06 -…', tone: 'dim' }])
})
