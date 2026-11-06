# Agent customizations

Personal customizations for Claude Code and Pi, combined from `claude-customizations` and `pi-customizations` with both Git histories preserved.

## Projects

- **[Claude Code](claude/README.md):** message panels, code brackets, and task links. Mods live in `claude/mods/`; the root `.claude-plugin/marketplace.json` is the plugin marketplace.
- **[Pi](pi/README.md):** transcript styling, compact tools, session naming, footer and input layout extensions, and the turquoise theme. The Node package and tests live in `pi/`.

## Shared skills

[Shared writing skills](skills/README.md) documents the pinned `avoid-ai-writing` trial for user-level Pi and Claude Code. The previous `deslop` deployment is preserved under [archive/](archive/README.md) for rollback. This explicitly authorized skill deployment is separate from the runtime migration below.

## Migration status

This is a private consolidation repository. Existing installations still use the original repositories; creating this repo does not deploy or migrate them. Installation commands in the project documentation are for a future, explicit migration only. Do not run them as part of repository setup.

The original repositories remain unchanged. Their main-branch histories (including local commits present at import time) are retained through unsquashed subtree imports. Source branches and untracked/generated files were not imported.

## Development

Run Claude commands from `claude/` (see [agent notes](claude/AGENTS.md)). Run Pi checks with Node 24+ and Python 3:

```sh
cd pi
npm ci --ignore-scripts
npm run check
```

GitHub Actions runs Pi checks on Linux and macOS; it does not deploy anything. Claude validation/tests require a compatible locally installed Claude Code CLI.
