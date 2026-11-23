# Archived customizations

These files are retained for rollback, not deployed or exposed to skill discovery.

## deslop

`skills/deslop/` is an exact copy of the user-level deployment before the avoid-ai-writing trial. It was imported from `~/.local/share/mercury-agent-helpers/current/skills/deslop`; deslop was not previously stored in agent-customizations. The original helpers source and release are unchanged. See `../skills/README.md` for installation and rollback instructions.

## technical-prose

`output-styles/technical-prose.md` is the Technical Prose output style. It applies ASD-STE100 rules to technical writing. Reader First (`claude/output-styles/reader-first.md`) replaced it as the default output style on 2026-11-23. To restore it, copy the file to `~/.claude/output-styles/` and set `"outputStyle": "Technical Prose"` in `~/.claude/settings.json`.
