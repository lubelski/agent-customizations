import { expect, test } from 'claude-code/testing'
import { fitPath, shortenPath } from '../hooks/paths.ts'

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
