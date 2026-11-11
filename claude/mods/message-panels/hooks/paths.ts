// A tool line names a file by its path. An absolute path spends most of the
// line on the directories every call shares, so the line shows a short form:
// a worktree's name, the session's directory or `~` stands for the leading
// part, and a path still too wide drops directories from its middle.
//
// The line then draws the short form in three tones, so the eye lands on the
// file: the stand-in prefix in the tag color, the directories dim, and the
// file's name in the text color.

export type PathContext = { cwd: string; home: string | undefined }

/** How a run of a tool line draws: dim for noise, text for the signal, tag for a stand-in prefix. */
export type Tone = 'dim' | 'text' | 'tag'
export type Run = { text: string; tone: Tone }

// A Claude Code worktree: `<repo>/.claude/worktrees/<name>/<rest>`.
const WORKTREE = /\/\.claude\/worktrees\/([^/]+)(?:\/(.*))?$/

const within = (path: string, dir: string): string | null => {
  const base = dir.replace(/\/+$/, '')
  if (!base) return null
  if (path === base) return '.'
  return path.startsWith(base + '/') ? path.slice(base.length + 1) : null
}

/** A short path in parts: the stand-in `prefix` (`~`, a worktree name, or none), what joins it to the rest, and the rest. */
type ShortPath = { prefix: string; joint: string; rest: string }

const shorten = (path: string, context: PathContext): ShortPath => {
  const { cwd, home } = context
  if (!path.startsWith('/')) return { prefix: '', joint: '', rest: path }
  const worktree = WORKTREE.exec(path)
  const worktreeRoot = worktree ? `${path.slice(0, worktree.index)}/.claude/worktrees/${worktree[1]}` : ''
  if (worktree && within(cwd, worktreeRoot) === null) {
    const [, name, rest] = worktree
    return { prefix: name ?? '', joint: ' - ', rest: rest ?? '' }
  }
  const relative = within(path, cwd)
  if (relative !== null) return { prefix: '', joint: '', rest: relative }
  const underHome = home ? within(path, home) : null
  if (underHome !== null) return underHome === '.' ? { prefix: '~', joint: '', rest: '' } : { prefix: '~', joint: '/', rest: underHome }
  return { prefix: '', joint: '', rest: path }
}

/**
 * The path as a tool line shows it: `pool-06 - src/a.ts` for a file in the
 * worktree `pool-06`, `src/a.ts` beneath the session's directory, `~/notes.md`
 * beneath the home directory, and the path unchanged elsewhere.
 */
export const shortenPath = (path: string, context: PathContext): string => {
  const { prefix, joint, rest } = shorten(path, context)
  return `${prefix}${joint}${rest}`
}

/**
 * The path cut to `width` columns. Directories leave from the middle first, so
 * the first segment and the file's name and parents stay:
 * `pool-06 - src/…/ActivityLogTimeline/styles.module.css`.
 */
export const fitPath = (path: string, width: number): string => {
  if (path.length <= width) return path
  if (width < 2) return ''
  const segments = path.split('/')
  if (segments.length >= 3) {
    const [first] = segments
    for (let kept = segments.length - 2; kept >= 1; kept--) {
      const tail = segments.slice(segments.length - kept).join('/')
      const withFirst = `${first}/…/${tail}`
      if (withFirst.length <= width) return withFirst
    }
    const name = segments[segments.length - 1] ?? ''
    if (name && name.length + 2 <= width) return `…/${name}`
  }
  return path.slice(0, width - 1) + '…'
}

/**
 * The short path, fitted, as runs: `pool-06` in the tag tone, ` - src/…/`
 * dim, `a.ts` in the text tone. A literal `~` the model wrote is not a
 * stand-in and stays dim. A path cut so short that its prefix is gone draws
 * dim up to the file's name.
 */
export const pathRuns = (path: string, context: PathContext, width: number): Run[] => {
  const short = shorten(path, context)
  const fitted = fitPath(`${short.prefix}${short.joint}${short.rest}`, width)
  const runs: Run[] = []
  let body = fitted
  if (short.prefix && fitted.startsWith(short.prefix + short.joint)) {
    runs.push({ text: short.prefix, tone: 'tag' })
    body = fitted.slice(short.prefix.length)
  }
  const cut = body.lastIndexOf('/')
  const dirs = cut >= 0 ? body.slice(0, cut + 1) : ''
  const name = cut >= 0 ? body.slice(cut + 1) : body
  if (dirs) runs.push({ text: dirs, tone: 'dim' })
  if (name) runs.push({ text: name, tone: name.endsWith('…') && !dirs ? 'dim' : 'text' })
  return runs
}
