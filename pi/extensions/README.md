# Extensions

## Installation

The package now exposes **two extensions**: `ui.ts` and the independent `session-rename.ts`. Its explicit `package.json` manifest excludes all deprecated entry points and includes the turquoise theme. The package name remains `pi-customizations`.

After approving a migration, install from the `pi/` package directory:

```sh
cd "$HOME/dev/agent-customizations/pi"
npm ci --ignore-scripts
pi install "$PWD"
```

Keep the checkout and dependencies available. Package installation resolves the internal modules directly; do not wildcard-link `extensions/*.ts` or install the modules under `lib/ui/` as extensions.

### Migrating an existing installation

1. Remove the six old visual extension paths/symlinks from your active extension configuration: `assistant-background`, `code-brackets`, `half-bleed`, `recessed-tools`, `session-title-banner`, and `stable-input-layout`. Also remove any standalone `session-rename` registration if the package will now supply it.
2. Select the package above (or explicitly select only `extensions/ui.ts` and `extensions/session-rename.ts`). When using explicit file paths, keep them in the checkout; avoid symlinks that break relative module imports.
3. **Exit and restart Pi.** `/reload` is not sufficient when switching between legacy and unified implementations because prototype patches survive runtime reloads.

The old paths remain guarded deprecation shims. Their implementations are frozen, byte-for-byte, in `../legacy/`; those files are not installable entry points. If legacy and unified entry points are selected together, the first family loaded owns the process and the other is skipped with a warning, before registering tools, commands, or patches. Duplicate entry points are skipped too. Restart with only the intended family selected. Rollback uses the six legacy shims, without `ui.ts`, and a fresh process.

The migration commands above are manual steps. Repository tests use isolated configuration and do not change installed settings, symlinks, or package registrations.

## `ui.ts`: unified presentation

One entry point coordinates internal modules under `lib/ui/`:

- `header.ts`: fixed title and optional top rule.
- `footer.ts`: footer, editor/autocomplete layout, inventory, task links and workspace tools.
- `messages/`: assistant/thinking styling and user/custom message panels under one owner.
- `code.ts`: code-block styling and copying.
- `tools.ts`: compact tool summaries and disclosure.
- `settings.ts`: shared persistent preferences, read on session start and updated by commands.

Existing tools and commands are preserved. Message panels sit one uncolored gap column in from each side and keep one column of padding inside. Their top and bottom padding are thin sextant caps by default; font compatibility swaps those for whole blank rows, which take more space but render in any font. Tool rows and Pi's transcript notices (status, warnings, "Reloaded …") are indented to line up with message text. This setting concerns message panels, not all Unicode in Pi: code brackets and other native UI still use ordinary box-drawing characters.

### Options

Three independent options, each off by default and flipped by its own command:

| Command | Setting | When on |
|---|---|---|
| `/ui-toggle-compact-header` | `compactHeader` | Header drops its top rule: two rows instead of three |
| `/ui-toggle-compact-footer` | `compactFooter` | Footer collapses to three rows instead of seven |
| `/ui-toggle-font-compat` | `fontCompat` | Panels use whole blank top/bottom padding rows instead of thin sextant caps |

Changes apply immediately. Commands take no arguments and require interactive mode; header rendering applies only in supported fullscreen layouts.

Preferences belong to this extension in `ui.json` under `getAgentDir()` (normally `~/.pi/agent/`, respecting `PI_CODING_AGENT_DIR`). With all three on, it holds:

```json
{ "compactHeader": true, "compactFooter": true, "fontCompat": true }
```

Settings are shared across projects and clients using that agent directory, not tied to a conversation or connecting device. Commands update the current instance and future sessions; other running processes are not live-synchronized. No file is created until a preference is saved. Writes are atomic and preserve unrelated keys. Invalid settings warn and fall back to defaults; failed saves leave the display unchanged. Malformed JSON is never overwritten. The exploratory `session-title-banner.json` format was never deployed and is not read or migrated.

## Message appearance: `lib/ui/messages/`

Gives assistant prose and thinking text matching adaptive neutral-gray panels. Dark and light themes receive different grays to preserve contrast. Compatible mode uses ordinary rectangular backgrounds and full-row space padding. Unicode mode uses the same half-cell sides and partial-height caps as the user-message treatment. Switching modes updates existing/cached messages as well as new and streaming messages, without changing stored messages or signatures. Any assistant message (thinking or prose) that leads directly into a tool gets one blank separator row, so every message/tool boundary has exactly one gap row.

Pi does not expose a public renderer for built-in assistant messages. This experiment uses the current component structure: prose is a direct Markdown child, while thinking is wrapped separately. It should fail harmlessly if that structure changes.

## Code blocks: `lib/ui/code.ts`

Replaces Markdown's visible code fences with a muted, open-left bracket while preserving native syntax highlighting:

````text
typescript
│ const answer = 42;
│ console.log(answer);
└──
````

Language labels sit flush left without a top elbow or trailing rule. The lower arm is always `└──`, independent of the language or code width. Unlabeled blocks use `┌──` / `└──` arms. Long code lines wrap with a continuing left rule; labels shorten on narrow terminals. Inline code and indented (unfenced) code retain native rendering. This applies to fenced blocks rendered through Pi's Markdown component, including nested lists/quotes; source messages and model context are unchanged.

In fullscreen mode, click any vertical `│` cell to copy the entire block’s original code, including indentation and unwrapped lines. A temporary toast confirms copying or reports clipboard failure. Success dims after 0.9 seconds and disappears after 1.6; errors remain for 3.2 seconds. Each result restarts the timer and increments a visible counter so repeated clicks are distinguishable. Labels and lower arms are not click targets; code selection and scrolling remain native. Plain-text mode disables these hit areas. `/copy-code` remains the keyboard alternative.

Pi has no public fence-layout setting, so this uses a guarded, reload-safe token-renderer patch. Unsupported token layouts fall back to Pi's rendering.

## Message panel edges: `lib/ui/messages/panels.ts`

Shapes transcript panels:

- user, custom and assistant panels sit one gap column in from each side, with one column of padding inside, so sides are whole cells;
- by default their top and bottom padding rows become square caps one third of a row tall;
- four cells of each user or assistant panel's top edge, ending one cell short of its end, are a copy target: they draw as the edge at rest, read `COPY` under the pointer, and a click copies that panel's text as written (Markdown, no panel glyphs). Each panel copies only its own text; thinking has no copy target, and `/plain-text` mode turns it off. Hover needs Pi's fullscreen mode outside tmux/screen, where pointer motion is reported;
- with those caps, a panel drops the blank gap row next to anything it abuts (another panel, thinking text or a tool row), since its cap already separates them; gaps between rows without caps stay;
- tool panels lose their filled background and right edge, leaving one thin, very low-contrast left rule;
- the tool rule starts and ends with rendered tool content rather than extending through box padding;
- Pi's standalone pre-tool separator is removed to tighten the transition from assistant prose;
- tool errors use an error-colored left rule.

The caps require Symbols for Legacy Computing sextants. Font compatibility avoids them, keeping whole blank padding rows. Tool rules and disclosure remain the same in both modes. `/plain-text` is still a separate session-local view, not a font-compatibility setting.

## Native cursor (built into Pi 1.2)

Set `"showHardwareCursor": true` in `~/.pi/agent/settings.json`. Pi now removes its software cursor itself; the terminal controls the native cursor shape. The former `native-cursor.ts` extension is retired. Remove its installed symlink and any explicit settings entry when upgrading.

## Tool disclosure: `lib/ui/tools.ts`

Makes tool activity secondary to the assistant's prose while preserving access to its details:

- completed, collapsed tools occupy two muted rows, the same height they had while streaming: tool name plus a path, command, query, or URL when available, then `└` with the last output line;
- codemode rows list up to three distinct static tool/discovery call names in source order, with repeat counts and `+N more`; narrow widths show fewer names. These are source call sites, not execution counts—loops and branches are not evaluated. Comments/string examples are ignored; dynamic calls and unparseable/oversized scripts fall back gracefully;
- clicking either row or using Pi's native expand shortcut opens a ten-row text preview, plus the summary and control rows;
- click `+10 more` to grow the preview incrementally, or `show all` to restore native full output (including images);
- click the summary again to collapse; reopening starts at ten rows, and preview-body clicks do not unexpectedly change its size;
- `/tool-detail more|all|collapse` controls the last opened/clicked tool; Ctrl+O followed by this command provides a keyboard path (when opening several tools, it targets the last one);
- image output stays hidden until `show all`, so image escape sequences are never clipped;
- running tools use the two-row streaming view below;
- tool titles and output use the theme's dim text color;
- failed tools use an error-colored row with a failure marker;
- saved results and model context are unchanged.

This uses a guarded component render/input patch because tool renderers alone do not control Pi's separately appended images. Completed tools own their header/control hit areas; previews use native text components without images, and full disclosure uses native rendering. Pending and running tools draw their own two rows instead (see below). Reloading does not stack the wrappers.


### Streaming tools

While a tool call streams in and runs, it stays exactly two rows, so the transcript does not grow and shrink:

```text
› codemode · read, bash
└ return [a, b];
```

The first row is the summary. The second shows the latest line of the streaming payload (code, command, file content or edit text, else JSON), syntax-highlighted, or the latest output line once it runs. Click the tool to open it and watch the whole payload stream with a `│` rule ending in `└`; click again to close. On completion it keeps the same two rows, with the `└` row showing the last output line.

## `session-rename.ts`

Automatically names a session from the conversation after the first user-agent turn, then refreshes the generated name every five turns. Generated names contain only a concise topic so they remain easy to scan in the footer and session picker. When the initial request links to a GitHub pull request, Linear ticket, or similar work item, the name uses its human-readable title when the conversation or retrieved tool context provides it instead of relying on the item ID alone. Each generated refresh receives the previous title as a continuity anchor: preserve its core topic, keep it unchanged when still accurate, and broaden it only when the session's goal warrants it rather than chasing the latest subtask. Manual names are never overwritten.

Commands:

```text
/rename                  Generate a topic now
/rename "Custom topic"   Set a manual name
/rename settings         Configure model, thinking level, and timing
```

Settings are stored in `~/.pi/agent/rename.json`. `afterSteps: 0` disables automatic naming; `everySteps: 0` names a session only once. The default naming model is `openai-codex/gpt-5.6-luna`; an empty `model` falls back to that model.

This extension is adapted from [`@moguw/pi-session-rename`](https://github.com/Mieluoxxx/pi-ext/tree/main/extensions/pi-session-rename) under the MIT license. Remove that package before enabling this version so its `/rename` command and automatic naming handler do not run twice:

```sh
pi remove npm:@moguw/pi-session-rename
```

## Header: `lib/ui/header.ts`

Shows the session title, directory, and context usage in a fixed fullscreen header. The top rule is optional; hiding it reduces the header from three rows to two without removing the title or bottom rule.

`/ui-toggle-compact-header` turns this on or off. The title and bottom rule remain visible in both modes.

## Footer/editor: `lib/ui/footer.ts`

### Compact footer

`/ui-toggle-compact-footer` reduces the collapsed footer from seven rows to **three**:

1. Branch and active workspace/worktree path, middle-truncated to fit.
2. Context percentage, idle/working/queued state, and model ID.
3. Clickable task links, or the inventory summary when there are no links.

Links truncate rather than adding rows. `/inventory` and Alt+I still expand the full MCP/extension list; when links occupy the third row, the expanded inventory adds its summary below them. Usage totals, separate primary-checkout/worktree fields, model provider/thinking level, and queue-key reminders remain available in the full footer. Narrow layouts prioritize branch, context, and run state over long paths/model names.

Autocomplete uses three suggestions in compact mode. Pi requires at least three suggestions, so a long list adds its native overflow indicator as a fourth row—temporarily one row taller than the compact footer. Full mode retains six suggestions plus the indicator. Short menus are padded to the selected footer height. Switching density updates both the footer and the editor immediately.

### Full footer

The default full footer keeps a seven-row collapsed pane below the editor:

- while idle, the pane shows project, usage, context, model, task links, MCP servers, and active visual extensions;
- the agent-facing `set_footer_links` tool replaces the session's clickable task links, with short labels for resources such as Linear tickets, local mock or Storybook pages, and pull requests;
- task links are branch-local session state, survive resume and reload, and can be cleared by setting an empty list;
- `set_task_workspace({ path: "/absolute/task/directory" })` updates `F`, `B`, and `W` together when the agent claims or switches worktrees; it uses Git metadata, not worktree naming conventions. This is display-only: tool cwd, relative path resolution, and the title banner's session directory are unchanged;
- the workspace selection survives resume/reload on the active session branch. Git metadata refreshes after each agent run; detached HEAD displays `B: -`. Pass `path: null` to restore the session directory. Missing saved directories fall back to the session directory. Shell `cd` and incidental reads do not implicitly select a workspace;
- `F:` shows the repository's primary checkout, falling back to the task/session directory when there is no primary checkout (including bare-backed worktrees); `B:` shows the active branch and `W:` the linked worktree root, or `-` outside a linked worktree;
- location (`F:`, `B:`, `W:`), usage (`U:`), context (`C:`), and model (`M:`) stay left; queue guidance stays right in an equal-width column;
- unprefixed links are right-aligned and bottom-anchored on the model row, one line above the final summary/relay row; they wrap upward across up to three existing rows alongside usage, context, and model; overflow ends in an ellipsis rather than increasing footer height;
- the final left-aligned row combines inventory counts: `E: 2x MCP servers, 5x extensions (/inventory to expand)`; this row can use the full width;
- `/inventory` (or `Alt+I`) toggles the full inline list below the summary, labeled MCP or EXT, with reported MCP status when available; expanded entries wrap across the available width rather than truncating the list;
- expansion intentionally grows the dock; collapse restores seven rows, and reload starts collapsed; autocomplete temporarily hides the inventory;
- the MCP status names servers with registered, non-hidden tools, including native codemode and deferred tools; names are deduplicated, and legacy `pi-mcp-adapter` snapshots remain supported (this is not a connection-health indicator);
- EXT automatically groups available non-built-in tools and extension commands by their source package or extension filename, alongside UI customizations that publish scoped footer statuses; web access, the journal, and future tool/command packages do not need custom footer integration;
- inactive direct tools and hidden tools are excluded; codemode/deferred tools remain available and count, while MCP tools stay in the MCP list; built-ins, skills, prompt templates, and external CLIs are not extension inventory entries;
- hook-only extensions without tools, commands, or a scoped status cannot be discovered through these public APIs; counts describe discoverable providers, not a complete installed-extension inventory or connection-health check; the list refreshes from runtime metadata on each render;
- the top three right-side rows wrap live run/queue state plus a compact reminder: `↵` steers the next turn, `⌥↵` queues work after the task, and `⌥↑` returns the queue to the editor for revision;
- while autocomplete is open, up to six choices plus its scroll indicator replace the collapsed session information in the same space;
- short autocomplete lists are padded to the same height, so filtering does not move the input;
- the custom editor preserves the cursor marker for Pi's built-in native cursor handling.
