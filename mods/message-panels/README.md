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

Messages keep exactly one blank row between them, never two. Ink has no margin collapse, so the mod builds it from 3 rules:

1. A panel has one blank row above it and none below. A panel right after another panel has none: the bottom cap above and its own top cap already leave one row of the terminal's background between the two fills.
2. Claude Code's own rows, such as `Worked for 5s` and mod notices, start with a blank row. That gives the gap below a panel.
3. A tool line has a blank row above it only when the previous visible row is a message. A run of tool calls stays tight.

For rule 3, the mod reads the conversation with `$.session.messages({ as: 'api' })` and finds the block before each call. Thinking blocks are skipped. A user message that carries tool results counts as plumbing, not as a prompt. A call of the reply still streaming is not in that list yet, so the last listed row decides its gap.

For rule 1, the mod hooks `session.append`, which every stored row passes before it is kept, and records for each visible row the kind of the visible row before it (a panel, or a line such as a tool row or the turn's duration line), keyed by the row's uuid. A message row renders under that uuid as `e.requestId`, so its hook looks up what came before it. A prompt draws under the id `placeholder` until its row is stored, and takes the last stored row. Rows a `--resume` loads are not appended, so they keep the full blank row.

## Working with other mods

The assistant panel wraps whatever a mod beneath it drew for `AssistantMessage`. If the tree beneath holds Claude Code's own row, the mod draws Markdown from `e.props.text` instead. This lets `code-brackets` supply the panel's body in either chain order.
