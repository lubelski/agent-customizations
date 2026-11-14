# Git

Shows the branch of the repo the session is in, like `⎇ main*+2`. `*` means uncommitted or staged changes, and `+N` counts untracked files. On a detached HEAD it shows the short commit hash. It follows the current folder, not the start folder, and is hidden outside a repo.

Requires `git`. The [PR](pr.md) segment depends on this one.

- Uses: `cwd`
- Sets: `git_part`, plus `in_repo` and `branch` for the PR segment

```sh
# ── Git branch + status ────────────────────────────────────────────────────
# A function, not a string, so a cwd containing spaces does not word-split.
GIT() { git -C "$cwd" -c core.useBuiltinFSMonitor=false "$@"; }
git_part=""
branch=""
in_repo=0
if [ -n "$cwd" ] && [ -d "$cwd" ] && GIT rev-parse --git-dir > /dev/null 2>&1; then
  in_repo=1
  branch=$(GIT symbolic-ref --short HEAD 2>/dev/null \
           || GIT rev-parse --short HEAD 2>/dev/null)

  if [ -n "$branch" ]; then
    if GIT diff --quiet 2>/dev/null && GIT diff --cached --quiet 2>/dev/null; then
      dirty=""
    else
      dirty="${YELLOW}*${RESET}"
    fi

    untracked=$(GIT ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
    if [ "$untracked" -gt 0 ] 2>/dev/null; then
      untracked_marker="${GRAY}+${untracked}${RESET}"
    else
      untracked_marker=""
    fi

    git_part="${MAGENTA}⎇ ${branch}${RESET}${dirty}${untracked_marker}"
  fi
fi
```
