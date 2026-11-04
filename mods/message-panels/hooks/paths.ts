// A tool line names a file by its path. An absolute path spends most of the
// line on the directories every call shares, so the line shows a short form:
// a worktree's name, the session's directory or `~` stands for the leading
// part, and a path still too wide drops directories from its middle.

export type PathContext = { cwd: string; home: string | undefined }

// A Claude Code worktree: `<repo>/.claude/worktrees/<name>/<rest>`.
const WORKTREE = /\/\.claude\/worktrees\/([^/]+)(?:\/(.*))?$/

const within = (path: string, dir: string): string | null => {
  const base = dir.replace(/\/+$/, '')
  if (!base) return null
  if (path === base) return '.'
  return path.startsWith(base + '/') ? path.slice(base.length + 1) : null
}

/**
 * The path as a tool line shows it: `pool-06 - src/a.ts` for a file in the
 * worktree `pool-06`, `src/a.ts` beneath the session's directory, `~/notes.md`
 * beneath the home directory, and the path unchanged elsewhere.
 */
export const shortenPath = (path: string, context: PathContext): string => {
  const { cwd, home } = context
  if (!path.startsWith('/')) return path
  const worktree = WORKTREE.exec(path)
  const worktreeRoot = worktree ? `${path.slice(0, worktree.index)}/.claude/worktrees/${worktree[1]}` : ''
  if (worktree && within(cwd, worktreeRoot) === null) {
    const [, name, rest] = worktree
    return `${name} - ${rest ?? ''}`
  }
  const relative = within(path, cwd)
  if (relative !== null) return relative
  const underHome = home ? within(path, home) : null
  if (underHome !== null) return underHome === '.' ? '~' : `~/${underHome}`
  return path
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
