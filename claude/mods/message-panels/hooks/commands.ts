// A Bash call's line shows its command. Two things make the command hard to
// read at a glance: absolute paths, which the mod shortens as it does a
// path field, and the flags and arguments around each program's name. The
// line draws each stage's program in the text tone and the rest dim, so
// `cd claude/mods && cat hooks/paths.ts` reads as `cd` and `cat`.

import { shortenPath } from './paths'
import type { PathContext, Run } from './paths'

// An absolute path inside a command: from a `/` at a word's start to the
// next space, quote or shell punctuation.
const ABSOLUTE = /(^|[\s='"`:(])(\/[^\s'"`;|&()<>]+)/g

// A word that ends one stage of a pipeline and starts another.
const OPERATORS = new Set(['&&', '||', '|', ';', '(', '$(', '{'])

// A leading `FOO=bar` before a program, or a word that runs another program.
const PRELUDE = /^[A-Za-z_][A-Za-z0-9_]*=/
const RUNNERS = new Set(['sudo', 'env', 'time', 'exec', 'nohup', 'xargs'])

/** The command with each absolute path shortened as a path field is. */
export const shortenCommand = (command: string, context: PathContext): string =>
  command.replace(ABSOLUTE, (_, lead: string, path: string) => lead + shortenPath(path, context))

/**
 * The one-line command as runs: each stage's program in the text tone, its
 * flags, arguments and the operators between stages dim. A word that only
 * sets a variable or hands off to another program (`sudo`, `env`) stays dim,
 * so the program it runs is the one in the text tone.
 */
export const commandRuns = (command: string, context: PathContext, width: number): Run[] => {
  const shortened = shortenCommand(command, context)
  const runs: Run[] = []
  let expectProgram = true
  for (const word of shortened.split(/(\s+)/)) {
    if (!word) continue
    if (/^\s+$/.test(word)) {
      runs.push({ text: word, tone: 'dim' })
      continue
    }
    const isProgram = expectProgram && !PRELUDE.test(word) && !RUNNERS.has(word) && !OPERATORS.has(word)
    runs.push({ text: word, tone: isProgram ? 'text' : 'dim' })
    if (isProgram) expectProgram = false
    // `rm dist;` ends its stage as `;` alone does.
    if (OPERATORS.has(word) || word.endsWith(';')) expectProgram = true
  }
  return fitRuns(runs, width)
}

/** The runs cut to `width` columns, the last kept one ending in `…`. */
export const fitRuns = (runs: Run[], width: number): Run[] => {
  const total = runs.reduce((sum, run) => sum + run.text.length, 0)
  if (total <= width) return runs
  if (width < 2) return []
  const out: Run[] = []
  let room = width - 1
  for (const run of runs) {
    if (run.text.length <= room) {
      out.push(run)
      room -= run.text.length
      continue
    }
    if (room > 0) out.push({ text: run.text.slice(0, room), tone: run.tone })
    break
  }
  const last = out[out.length - 1]
  if (last) last.text += '…'
  else out.push({ text: '…', tone: 'dim' })
  return out
}
