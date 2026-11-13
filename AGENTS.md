# Agent notes

This repository contains independent Claude Code and Pi customizations.

- `claude/`: read `claude/AGENTS.md` before changing mods. Its development commands are relative to `claude/`.
- `pi/`: Node package, extensions, themes, and tests. Run `npm ci --ignore-scripts` and `npm run check` from `pi/`.
- `.claude-plugin/marketplace.json`: root marketplace; plugin sources must point into `claude/mods/`.
- `skills/`: shared skill bundles. Read `skills/README.md` before changing or installing one.
- `.github/workflows/ci.yml`: Pi checks, with `pi/` as the run working directory, and the tests of the `skills/` scripts.

Keep the primary checkout on `main`; use Worktrunk task worktrees under `.wt/`.

## Migration boundary

Do not deploy or change installed Claude/Pi configuration without explicit approval. The original repositories and existing installations are intentionally left in place. Preserve plugin versions and the Pi package identity during repository consolidation.
