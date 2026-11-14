# PR

Shows the open PR for the current branch, like `PR #123`. When the branch has none, it shows the count of open PRs in the repo, like `PRs:4`. Hidden when there are none, or when `gh` is missing or signed out.

This segment never waits on the network. It renders from a cache file in `~/.claude/cache/statusline/`, keyed by folder and branch. When the cache is older than `PR_TTL` (90 seconds), it starts a detached refresh under a lock directory. The refresh gives `gh` `PR_NET_TIMEOUT` (8 seconds), and a lock older than 120 seconds is treated as left behind and removed. One `gh pr list` call covers both the branch's PR and the count.

Requires the [Git](git.md) segment before it, `gh`, `perl` for the timeout, and `shasum` or `sha1sum` for the cache key. Both ship with macOS and most Linux distributions.

- Uses: `cwd`, and `in_repo` and `branch` from the Git segment
- Sets: `pr_part`

```sh
# ── Open PRs (cached; refreshed out of band, never blocks) ─────────────────
# File mtime in epoch seconds. GNU stat (Linux) uses -c %Y, BSD stat (macOS) -f %m.
if stat -c %Y / > /dev/null 2>&1; then
  file_mtime() { stat -c %Y "$1" 2>/dev/null || echo 0; }
else
  file_mtime() { stat -f %m "$1" 2>/dev/null || echo 0; }
fi

pr_part=""
PR_TTL=90
PR_NET_TIMEOUT=8
if [ "$in_repo" = "1" ] && [ -n "$branch" ] && command -v gh > /dev/null 2>&1; then
  cache_dir="$HOME/.claude/cache/statusline"
  [ -d "$cache_dir" ] || mkdir -p "$cache_dir" 2>/dev/null
  key=$(printf '%s' "${cwd}|${branch}" | { shasum 2>/dev/null || sha1sum 2>/dev/null; } | cut -d' ' -f1)
  if [ -n "$key" ] && [ -d "$cache_dir" ]; then
    cache_file="$cache_dir/pr-$key"
    lock_dir="$cache_dir/pr-$key.lock"

    # Render from whatever the cache holds right now.
    if [ -f "$cache_file" ]; then
      cached=$(cat "$cache_file" 2>/dev/null)
      case "$cached" in
        '#'*) pr_part="${BLUE}PR ${cached}${RESET}" ;;
        n:*)  pr_part="${BLUE}PRs:${cached#n:}${RESET}" ;;
      esac
    fi

    # Decide whether a refresh is due.
    now=$(date +%s)
    mtime=0
    [ -f "$cache_file" ] && mtime=$(file_mtime "$cache_file")
    [ -n "$mtime" ] || mtime=0

    if [ $(( now - mtime )) -ge "$PR_TTL" ]; then
      # Clear a lock left behind by a killed refresh.
      if [ -d "$lock_dir" ]; then
        lock_mtime=$(file_mtime "$lock_dir")
        [ $(( now - lock_mtime )) -ge 120 ] && rmdir "$lock_dir" 2>/dev/null
      fi

      if mkdir "$lock_dir" 2>/dev/null; then
        (
          trap 'rmdir "$lock_dir" 2>/dev/null' EXIT INT TERM

          remote=$(git -C "$cwd" remote get-url origin 2>/dev/null)
          value=""
          if [ -n "$remote" ]; then
            prs=$(perl -e 'alarm shift; exec @ARGV' "$PR_NET_TIMEOUT" \
                    gh pr list --state open --repo "$remote" \
                       --limit 100 --json number,headRefName 2>/dev/null)
            if [ -n "$prs" ]; then
              value=$(printf '%s' "$prs" | jq -r --arg b "$branch" '
                ( map(select(.headRefName == $b)) | first ) as $mine
                | if $mine then "#\($mine.number)"
                  elif length > 0 then "n:\(length)"
                  else "" end
              ' 2>/dev/null)
            fi
          fi

          # Write atomically so a render never sees a half-written file. Always
          # write, even when empty, so failures don't retry on every render.
          printf '%s' "$value" > "$cache_file.tmp" 2>/dev/null \
            && mv "$cache_file.tmp" "$cache_file" 2>/dev/null
        ) < /dev/null > /dev/null 2>&1 &
      fi
    fi
  fi
fi
```
