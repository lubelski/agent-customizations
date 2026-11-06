# Shared writing skills

`avoid-ai-writing/` is the active trial replacement for `deslop`. Both Pi and Claude Code use the same user-level snapshot. No MCP server, npm installation, hooks, or plugin is needed.

## Source

- Upstream: https://github.com/conorbronsdon/avoid-ai-writing
- Commit: `30971f1c50c6412a0c414e8c7b15032a32b21939`
- Skill version: `3.38.0`
- Source directory: `plugins/avoid-ai-writing/skills/avoid-ai-writing/`
- Contents copied unchanged, with upstream root `LICENSE` added.

Keep the complete directory: `SKILL.md` requires `references/patterns.md`; scripts, detector, and examples support optional verification. Review upstream changes before replacing this snapshot. Do not clone the whole upstream repository into a recursively scanned skill directory.

## User-level installation

From this repository's root, copy the skill into a versioned directory outside the checkout, then link both harnesses to that snapshot:

```sh
release="$HOME/.local/share/agent-customizations/skills/avoid-ai-writing-30971f1"
mkdir -p "$(dirname "$release")" "$HOME/.agents/skills" "$HOME/.claude/skills"
# Stop and compare if the release or either destination already exists.
cp -R skills/avoid-ai-writing "$release"
ln -s "$release" "$HOME/.agents/skills/avoid-ai-writing"
ln -s ../../.agents/skills/avoid-ai-writing "$HOME/.claude/skills/avoid-ai-writing"
```

Pi 1.5 discovers `~/.agents/skills` directly. Claude Code uses its symlink. Do not expose the repository root or `archive/` as a skill discovery path.

Before switching, record existing `deslop` symlink targets. Remove only those links from `~/.agents/skills/deslop` and `~/.claude/skills/deslop`; do not remove the helpers release they reference. Leave other consumers and source repositories unchanged.

Reload Pi with `/reload`; start a fresh Claude Code session. Invoke `/skill:avoid-ai-writing` in Pi or `/avoid-ai-writing` in Claude Code. Automatic selection follows the upstream description. The old skill can remain in an existing conversation's context until reload or restart.

## Rollback

The complete previously deployed skill is preserved at `archive/skills/deslop/`. Copy it to a stable directory outside this checkout, link `~/.agents/skills/deslop` to it, and link `~/.claude/skills/deslop` to `../../.agents/skills/deslop`. Remove the two `avoid-ai-writing` links only after confirming their targets still belong to this installation. Reload/restart both harnesses.

The initial deployment also saves the original symlink targets under `~/.local/share/agent-customizations/backups/`. Restoring those targets instead reproduces the prior helpers-managed deployment, provided the referenced release remains available.

This trial does not modify the helpers deployment tooling. A future helpers skill sync may restore `deslop`; check the active skill directories after such a sync. Avoid having both skills active with overlapping triggers.
