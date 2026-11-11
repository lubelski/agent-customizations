import { expect, test } from 'claude-code/testing'
import { commandRuns, fitRuns, shortenCommand } from '../hooks/commands.ts'

const repo = '/Users/me/dev/mercury-web'
const context = { cwd: repo, home: '/Users/me' }

test('absolute paths inside a command shorten as a path field does', async () => {
  expect(shortenCommand(`cd ${repo}/.claude/worktrees/pool-06 && yarn test src/a.ts`, context)).toBe('cd pool-06 -  && yarn test src/a.ts')
  expect(shortenCommand(`cat ${repo}/src/a.ts /Users/me/.claude/CLAUDE.md > /dev/null`, context)).toBe('cat src/a.ts ~/.claude/CLAUDE.md > /dev/null')
  expect(shortenCommand(`grep -n x --repo=${repo}/pi "${repo}/claude/x"`, context)).toBe('grep -n x --repo=pi "claude/x"')
  expect(shortenCommand('echo a/b 1/2', context)).toBe('echo a/b 1/2')
})

test('each stage draws its program in text and the rest dim', async () => {
  expect(commandRuns('git status --short | head -5', context, 80)).toEqual([
    { text: 'git', tone: 'text' }, { text: ' ', tone: 'dim' }, { text: 'status', tone: 'dim' }, { text: ' ', tone: 'dim' },
    { text: '--short', tone: 'dim' }, { text: ' ', tone: 'dim' }, { text: '|', tone: 'dim' }, { text: ' ', tone: 'dim' },
    { text: 'head', tone: 'text' }, { text: ' ', tone: 'dim' }, { text: '-5', tone: 'dim' },
  ])
})

test('a variable or a runner before the program stays dim', async () => {
  const programs = (command: string) => commandRuns(command, context, 80).filter(run => run.tone === 'text').map(run => run.text)
  expect(programs('CI=1 yarn test && sudo rm -rf dist; env FOO=1 node x.js')).toEqual(['yarn', 'rm', 'node'])
  expect(programs(`cd ${repo}/pi && npm ci`)).toEqual(['cd', 'npm'])
})

test('runs cut to width end in an ellipsis', async () => {
  const runs = [{ text: 'git', tone: 'text' as const }, { text: ' ', tone: 'dim' as const }, { text: 'status', tone: 'dim' as const }]
  expect(fitRuns(runs, 80)).toEqual(runs)
  expect(fitRuns(runs, 7)).toEqual([{ text: 'git', tone: 'text' }, { text: ' ', tone: 'dim' }, { text: 'st…', tone: 'dim' }])
  expect(fitRuns(runs, 4)).toEqual([{ text: 'git…', tone: 'text' }])
  expect(fitRuns(runs, 1)).toEqual([])
})
