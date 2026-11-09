# Agent notes

These notes apply to `claude/`. Run development commands from this directory; the marketplace lives one level above it. Do not update existing installations without explicit approval.

This repository holds Claude Code mods: plugins with a hooks module that hook Claude Code's engine and redraw its UI. Each mod lives in `mods/<mod>/`. `../.claude-plugin/marketplace.json` lists every mod, so each one installs with `/plugin install <mod> --marketplace lubelski/agent-customizations`. `README.md` is for people, and each mod's own `README.md` describes what it draws.

## Layout of a mod

- `.claude-plugin/plugin.json` holds the name, version and description.
- `hooks/hooks.json` names the module: `{ "modules": ["./register.tsx"] }`.
- `hooks/register.tsx` exports `register: Register`, with types imported from `'claude-code'`.
- `tsconfig.json` extends `./.claude-plugin/types/tsconfig.json`. The engine writes that folder when it loads the mod, and git ignores it.
- `tests/*.test.ts` run under `claude plugin test`.

The API reference is the types file the engine writes, `mods/<mod>/.claude-plugin/types/claude-code/index.d.ts`. It is about 23,000 lines, so grep it for the name at hand (`'ui.render'`, `AssistantMessage: {`, `type CodeProps`). The `plugin-authoring` skill explains the model, and its `reference.md` is the long form.

## Workflow

1. Run a session with the mod loaded and hot-reloaded: `claude --plugin-dir mods/<mod>`. Edits reload when a turn ends.
2. Check the mod: `claude plugin validate mods/<mod>`. The `README_MISSING`, `LICENSE_MISSING` and `ICON_MISSING` lines are plugin-directory checks. They do not block loading.
3. Type-check it: `npx -p typescript@5 tsc -p mods/<mod>`. This needs the types folder from step 1.
4. Run its tests, where it has some: `claude plugin test mods/<mod>`.
5. Bump `version` in the mod's `plugin.json` for any change meant to reach installed copies. Machines pick it up with `claude plugin marketplace update agent-customizations` and a restart.
6. Add a new mod to `../.claude-plugin/marketplace.json` and to the list in `README.md`.

## API behavior learned the hard way

These held on Claude Code 2.1.317.

- **`next(e)` in a `ui.render` hook** resolves to the tree beneath. For an unhooked component, that tree is `{ type: 'engine', ref }`, Claude Code's own drawing.
- **An engine node may not sit under a `Box` with `overflow`.** The hook is skipped with `engine node under a Box with prop "overflow"`. Draw the content yourself (for example, `Markdown` from `e.props.text`) where a clipping box is needed.
- **An absolutely positioned `Box` does not clip itself**, even with `top`, `bottom` and `overflow="hidden"`. Clip it with `overflow="hidden"` on its parent. The half-block panel edges and the code rule depend on this.
- **Claude Code's rows paint their own backgrounds.** The user prompt row paints gray behind its text, so wrapping it in a colored `Box` shows two colors. Draw the row from `e.props.text` instead.
- **`$.session.messages()` lags a streaming reply.** A tool row drawn while its reply streams is not in the list yet. Treat an unlisted call as coming after everything listed.
- **A function that receives `$` must be a top-level function declaration** in the module, or one imported from the mod's own files. `claude plugin validate` refuses a closure inside `register` that takes `$`.
- **A plugin tool's `tool.call` result is a string or an array of content blocks.** `{ result: { ... } }` is refused with `does not match its output shape`. Return `{ result: 'text the model reads' }`.
- **Summary blocks** (`AssistantMessage` with `isSummary: true`) are Claude Code's condensed version of text written between tool calls, not the model's text.
- **A message row's `e.requestId` is the `uuid` of its `session.append` event**, for the prompt and for each block of the reply, and the append runs before the row's first render. A prompt renders first under the id `placeholder`, before its row is appended. Rows a `--resume` loads are never appended.
- **`isFirstOfReply` is true on every text block of a reply**, including one that follows a tool call, so it does not tell what row came before.

## Mods that hook the same component

`message-panels` and `code-brackets` both hook `AssistantMessage`, and nothing fixes their order in the chain. Each one checks what `next(e)` returned:

- A mod that draws a frame (a panel) wraps the tree beneath when it holds no engine node. When it does hold one, the mod draws Markdown in its place.
- A mod that draws a body (code segments) returns its body when the tree beneath is the engine node. When a mod beneath drew a tree, it swaps its body in for the `Markdown` element that draws the reply's text.

A new mod on the same component should follow the same rules.

## Style

Colors are raw hex values in a warm palette near Claude's orange (`#d97757`), muted for fills. They are constants at the top of each `register.tsx`. `message-panels` keeps a light and a dark palette and picks one from the `theme` setting. For `auto`, it reads the macOS appearance, since the mod API does not expose the terminal background. Each mod draws for `e.surface === 'terminal'` only and returns `next(e)` elsewhere.
