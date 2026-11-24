# Agent notes

This repository contains independent Claude Code and Pi customizations.

- `claude/`: read `claude/AGENTS.md` before changing mods. Its development commands are relative to `claude/`.
- `pi/`: Node package, extensions, themes, and tests. Run `npm ci --ignore-scripts` and `npm run check` from `pi/`.
- `.claude-plugin/marketplace.json`: root marketplace; plugin sources must point into `claude/mods/`.
- `skills/`: shared skill bundles. Read `skills/README.md` before changing or installing one.
- `.github/workflows/ci.yml`: Pi checks, with `pi/` as the run working directory, and the tests of the `skills/` scripts.

Keep the primary checkout on `main`; use Worktrunk task worktrees under `.wt/`.

## Pull request structure and evidence

PR descriptions should roughly follow this structure; adapt it to the scope rather than adding empty sections:

- **Overview**: briefly explain what the PR does and why.
- **Visual Preview** (when relevant): show screenshots or videos of visual changes, attached using the method below.
- **Changes**: summarize the meaningful implementation changes and validation performed.
- **Notes** (optional): call out anything unusual or otherwise not covered above that is worth mentioning, such as limitations, migration requirements, or follow-up work.

Attach screenshots and videos directly to the **PR body** using GitHub CLI's `--attach` flag, rather than committing evidence files or adding image-only comments:

```sh
gh pr edit <number> \
  --attach '/absolute/path/dark.png#Dark theme: collapsed and expanded tool errors' \
  --attach '/absolute/path/light.png#Light theme: collapsed and expanded tool errors'
```

Without a body flag, this preserves the existing PR body and appends the uploaded attachments. Repeat `--attach` for multiple files; text after `#` supplies image alt text. For placement within a section, use `--body-file` with local image references and matching `--attach` paths; the CLI rewrites those references to uploaded asset URLs. Verify the result with `gh pr view <number> --json body --jq .body`.

Describe what the evidence shows and distinguish live application captures from renderer fixtures or mockups. Keep evidence files out of Git unless they are intentionally maintained documentation or test assets.

## Migration boundary

Do not deploy or change installed Claude/Pi configuration without explicit approval. The original repositories and existing installations are intentionally left in place. Preserve plugin versions and the Pi package identity during repository consolidation.
