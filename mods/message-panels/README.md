# message-panels

Draws the Claude Code transcript in the style of `pi-customizations`' `assistant-background.ts`, `half-bleed.ts` and `recessed-tools.ts`. Everything here applies to the terminal surface only. Other surfaces draw Claude Code's own rows.

## What it changes

- **Assistant replies** draw as Markdown in a warm gray panel (`#2a2725`). The panel has no `⏺` bullet and no indent column.
- **Typed prompts** draw in a dark orange-brown panel (`#4a3226`) with warm off-white text (`#efe6df`). Other user-side rows keep Claude Code's drawing: task notifications, and messages from other agents or sessions.
- **Panel edges.** Each panel's fill is inset one cell on each side. The inset cells hold a `▐` on the left and a `▌` on the right, in the fill color, so the color reaches half a cell past the fill.
- **Panel caps.** Each panel has a half-height row above and below its text, in place of a full blank row of fill. The top cap is a row of `▄` and the bottom cap a row of `▀`, in the fill color on the terminal's own background. The corners are the quadrant blocks `▗ ▖` and `▝ ▘`, where a cap meets a side edge. `pi-customizations` draws the same caps with sextants, one third of a row high. This mod uses half blocks, which every terminal font has.
- **Summary blocks.** In the normal view, Claude Code condenses text the model wrote between tool calls. Those blocks draw as panels with a dim `summary` tag over the right end of the top cap. Ctrl+o shows the full text.
- **Tool calls** draw as one dim line each: `› <tool> · <main input>`, such as `› Bash · git status`. MCP tools show their name without the `mcp__<server>__` prefix. A call that errored or was interrupted keeps Claude Code's full row.
- **Tool output.** A call that succeeded shows no output. Ctrl+o shows everything.
- **Expanded tool rows.** In the ctrl+o view, under `--verbose`, and for a call that errored or was interrupted, the one-line label heads an indented block with one cell of margin on each side. The block lists the call's input as `key: value` lines, then its output: stdout and stderr for Bash, numbered content for Read, a colored patch for Edit and Write, text blocks for a plugin tool, and JSON for anything else. The input shows 8 lines and the output 12. A `▸ n more lines` button beneath reveals the rest, and `▴ less` folds it again. Which rows are revealed is kept in `$.state`, so a reload keeps them. A click on a tool row also expands it, and Claude Code paints that row's container in the `userMessageBackgroundHover` theme color across the full width. The block covers that paint with cells in the terminal's own background: its Box names a background string the painter does not style, so the fill is written unstyled.
- **Slash commands.** A command's echo draws as one dim line, `› /model`, whatever origin the engine stamped it with. The command's output draws dim beneath it, indented, and an error line draws in the error color.

## Spacing

The caps are the whole spacing. A group of calls with a failed one draws as the mod's own lines, the failed one in the error color. A group the engine summarizes for another reason (recalled memory, hook timing) keeps the engine's line, pulled up over its blank row with a top margin of -1. A panel has no blank row above or below it, and neither has a tool line or a slash command's echo. Two panels in a row leave one row of the terminal's background between their fills, half from each cap. A tool line sits half a row from the fill above or below it. The line that closes a turn, `Worked for 5s · done 5:27 PM`, is drawn by the mod: dim, with a `·` in the column where a tool line has its `›`, so its text aligns with a tool line's, and no blank row above it. The engine's props give the word and the duration. The clock is stamped on the line's first draw and kept for redraws. A line that waits on background agents stays the engine's. Other engine rows, such as mod notices, keep their blank row.

## Working with other mods

The assistant panel wraps whatever a mod beneath it drew for `AssistantMessage`. If the tree beneath holds Claude Code's own row, the mod draws Markdown from `e.props.text` instead. This lets `code-brackets` supply the panel's body in either chain order.
