# Base

Every statusline built from this recipe starts with this block. It reads Claude Code's JSON from stdin, defines the colors and separator, and parses every field the segments use in one `jq` call.

Requires `jq`.

Fields that no chosen segment uses can be dropped, but the `read -r` lines and the `jq` expressions are matched by position, so remove both together. The segment files list the fields they use.

```sh
#!/bin/sh
# Statusline for Claude Code.
#
# Hard rule: this script must never block on the network. Anything slow is
# served from a cache and refreshed by a detached background job.
input=$(cat)

# ── ANSI colors (work in dimmed terminal context) ──────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
WHITE='\033[97m'
CYAN='\033[96m'
GREEN='\033[92m'
YELLOW='\033[93m'
RED='\033[91m'
MAGENTA='\033[95m'
BLUE='\033[94m'
GRAY='\033[90m'

SEP="${GRAY} │ ${RESET}"

# ── Parse JSON input (one jq pass, one field per line) ─────────────────────
{
  read -r model
  read -r context_window_size
  read -r used
  read -r cwd
  read -r project_dir
  read -r five_hour
  read -r seven_day
  read -r effort_level
  read -r thinking_enabled
  read -r output_style
  read -r vim_mode
  read -r agent_name
  read -r worktree_name
} <<EOF
$(printf '%s' "$input" | jq -r '
  (.model.display_name // "unknown"),
  (.context_window.context_window_size // 0),
  (.context_window.used_percentage // ""),
  (.workspace.current_dir // .cwd // ""),
  (.workspace.project_dir // ""),
  (.rate_limits.five_hour.used_percentage // ""),
  (.rate_limits.seven_day.used_percentage // ""),
  (.effort.level // ""),
  (.thinking.enabled // false),
  (.output_style.name // ""),
  (.vim.mode // ""),
  (.agent.name // ""),
  (.worktree.name // "")
' 2>/dev/null)
EOF
```
