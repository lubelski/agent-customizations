# Statusline recipe, v1

A one-line Claude Code statusline, split into parts so you can build one with only the segments you want. It is a POSIX `sh` script that Claude Code runs on each refresh, and it never waits on the network.

A full build looks like this:

```
Opus 5.5/1M │ ██░░░░░░░░ 23% │ 5h:12% 7d:40% │ eff:high+think │ personal-config/home → ./.claude │ ⎇ main*+2 │ Reader First │ PR #123
```

## Parts

A script is [base.md](base.md), then any segments in display order, then [assemble.md](assemble.md). Each file has one `sh` code block.

| Part | Shows | Needs |
|---|---|---|
| [base.md](base.md) | Nothing. Reads input, sets colors and the separator. | `jq` |
| [segments/model.md](segments/model.md) | `Opus 5.5/1M` | |
| [segments/context-bar.md](segments/context-bar.md) | `██░░░░░░░░ 23%` | |
| [segments/rate-limits.md](segments/rate-limits.md) | `5h:12% 7d:40%` | |
| [segments/effort.md](segments/effort.md) | `eff:high+think` | |
| [segments/folders.md](segments/folders.md) | `personal-config/home → ./.claude` | |
| [segments/git.md](segments/git.md) | `⎇ main*+2` | `git` |
| [segments/session-tags.md](segments/session-tags.md) | `wt:name`, `agent:name`, output style, vim mode | |
| [segments/pr.md](segments/pr.md) | `PR #123` or `PRs:4` | The Git segment, `gh`, `perl` |
| [assemble.md](assemble.md) | Nothing. Joins the segments and prints. | |

Each segment sets one or more `*_part` variables, and a segment with nothing to show leaves its variable empty. The assemble block lists every segment's variable and skips empty ones, so you don't need to edit it when you leave segments out. Its list also sets the display order.

The only dependency between segments is PR on Git. PR reads the `in_repo` and `branch` that Git sets, so Git must come before it.

## Build

Pick the parts, then concatenate their code blocks in order. This extracts the `sh` block from each file, run from this folder:

```sh
build() {
  for f in "$@"; do
    awk '/^```sh$/{on=1; next} /^```$/{on=0} on' "$f"
  done
}

build base.md \
  segments/model.md segments/context-bar.md segments/rate-limits.md \
  segments/effort.md segments/folders.md segments/git.md \
  segments/session-tags.md segments/pr.md \
  assemble.md > ~/.claude/statusline-command.sh
chmod +x ~/.claude/statusline-command.sh
```

Pasting the blocks into a file by hand works the same way.

## Install

Point Claude Code at the script in `~/.claude/settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "~/.claude/statusline-command.sh"
}
```

Test it with sample input. The output has color escapes, which the terminal renders:

```sh
printf '{"model":{"display_name":"Opus 5.5"},"context_window":{"context_window_size":1000000,"used_percentage":23},"workspace":{"current_dir":"%s","project_dir":"%s"}}' "$PWD" "$PWD" \
  | ~/.claude/statusline-command.sh
```

## Changing it

- **Colors** are ANSI constants in base. `SEP` is the separator.
- **Input fields** are parsed in base by one `jq` call. The `read -r` lines and the `jq` expressions are matched by position, so add or remove both together.
- **A new segment** sets its own `*_part` variable. Add that variable to the list in assemble.

## Platforms

Tested on macOS. Nothing in it is specific to one machine. The PR segment handles the one platform difference, the `stat` flags for file times, with its `file_mtime` helper.
