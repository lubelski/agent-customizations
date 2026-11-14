# Session tags

Small tags that only appear in some sessions. Each one is independent, so keep any subset of the lines below.

| Tag | Example | Shown when |
|---|---|---|
| Worktree | `wt:my-branch` | The session runs in a Claude Code worktree. |
| Agent | `agent:reviewer` | The session runs as a named agent. |
| Output style | `Reader First` | The output style is not `default`. |
| Vim mode | `NORMAL` | Vim mode is on. |

- Uses: `worktree_name`, `agent_name`, `output_style`, `vim_mode`
- Sets: `worktree_part`, `agent_part`, `style_part`, `vim_part`

```sh
# ── Session tags (only present in some sessions) ───────────────────────────
worktree_part=""
[ -n "$worktree_name" ] && worktree_part="${BLUE}wt:${worktree_name}${RESET}"

agent_part=""
[ -n "$agent_name" ] && agent_part="${MAGENTA}agent:${agent_name}${RESET}"

style_part=""
if [ -n "$output_style" ] && [ "$output_style" != "default" ]; then
  style_part="${GRAY}${output_style}${RESET}"
fi

vim_part=""
[ -n "$vim_mode" ] && vim_part="${YELLOW}${vim_mode}${RESET}"
```
