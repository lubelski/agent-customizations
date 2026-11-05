# code-brackets

Draws fenced code blocks in assistant replies the way `pi-customizations`' `code-brackets.ts` does. Everything here applies to the terminal surface only.

```text
ts
│ export const answer = 42
└──
```

- **Label.** The fence's language sits flush left. A fence with no language shows `┌──`.
- **Rule.** A muted `│` (`#6e6058`) runs beside the code. The code draws through Claude Code's `Code` element, which highlights by language.
- **Foot.** The block ends in `└──`.
- **Copy.** Clicking the rule or the label copies the block's code, without the fences or the label. A toast says `Copied`, or `Could not copy code` when the copy fails. The copy uses `$.ui.copy`: the terminal's clipboard tool, or an OSC 52 write. Clicks need a layout where Claude Code receives mouse events.

## Fence parsing

`splitFences` in `hooks/register.tsx` splits the reply's Markdown into prose and code segments. It reads fences of 3 or more backticks or tildes, indented by at most 3 spaces. A closing fence uses the same character and is at least as long as the opening one, so a longer fence can hold a shorter one. An unclosed fence runs to the end of the text, which keeps a reply that is still streaming readable. Fences inside block quotes, and fences indented 4 or more spaces, are not split out and keep Claude Code's rendering.

Summary blocks keep whatever the panel beneath drew, because their text is Claude Code's condensed version.

## Working with other mods

The mod works alone or with `message-panels`, in either chain order:

- If the result of `next(e)` is Claude Code's own row, the mod returns its own body: Markdown and code segments in a column. A panel mod above it wraps that body.
- If a mod beneath drew a tree, the mod finds the `Markdown` element whose text is the reply's text and swaps its body in at that spot.

## Tests

```sh
claude plugin test mods/code-brackets
```

`tests/fences.test.ts` covers closed fences, unclosed fences, a longer fence holding a shorter one, and tilde fences with no language.
