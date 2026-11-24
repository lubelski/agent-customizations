# Shared skills

## Raw feedback

[`feedback/balsamiq-mcp.md`](feedback/balsamiq-mcp.md) collects dated Balsamiq observations and candidate lessons for later synthesis. It is not part of the installed skill bundle and need not be read for routine tasks. Preserve the distinction between observed behavior, user feedback, and proposed guidance; promote lessons deliberately rather than expanding the skill after every observation.

## Remember this for later

[`remember-this-for-later/`](remember-this-for-later/SKILL.md) captures a note in the middle of a task, so the user does not have to stop and write a rule. A later review turns the notes into rules. [`references/review.md`](remember-this-for-later/references/review.md) is the review procedure.

`scripts/notes.mjs` is the store. It needs Node 22 or later and has no dependencies. Notes live outside every repository, in `~/.local/share/agent-customizations/remember-this-for-later/notes/<origin-repository>/<id>.md`. Set `REMEMBER_THIS_FOR_LATER_HOME` to use a different directory. Each note is one Markdown file with front matter: status, title, scope guess, tags, repository, primary checkout, worktree, branch, commit, harness, and session id.

The store separates two things. The origin of a note is a fact, and the CLI records it. All worktrees of a repository share one origin folder. The scope of a rule (one repository, several, or universal) is a decision, and review makes it. The `scope_guess` field is only the guess of the agent that wrote the note.

Run the tests from the repository root:

```bash
node --test "skills/remember-this-for-later/tests/*.test.mjs"
```

The skill is not installed. Installation follows the Balsamiq copy policy below: review the repository version, then copy the bundle to `~/.agents/skills/remember-this-for-later/`. Claude Code also needs the link `~/.claude/skills/remember-this-for-later` to `../../.agents/skills/remember-this-for-later`.

## Balsamiq MCP

[`balsamiq-mcp/`](balsamiq-mcp/SKILL.md) is the canonical, source-controlled skill for Balsamiq work across projects. It includes authoring guidance and reference schemas/examples; it is not Tau-specific.

The user-level installation at `~/.agents/skills/balsamiq-mcp/` is an ordinary copy, **not a symlink**. Edit and review the repository version first, then explicitly copy the approved version into the installation. Do not automatically deploy on checkout or merge. If installed files have independent changes, reconcile those into source control before replacing them.

To refresh from the repository root after reviewing local differences (this copies the current bundle without deleting extra files):

```bash
source_dir="$PWD/skills/balsamiq-mcp"
installed="$HOME/.agents/skills/balsamiq-mcp"
test -f "$source_dir/SKILL.md" || exit 1
if [ -L "$installed" ] || { [ -e "$installed" ] && [ ! -d "$installed" ]; }; then
  printf 'Inspect unexpected installation: %s\n' "$installed" >&2
  exit 1
fi
# Inspect nested symlinks too; do not copy through them.
if [ -d "$installed" ] && [ -n "$(find "$installed" -type l -print -quit)" ]; then
  printf 'Installation contains symlinks; inspect before copying.\n' >&2
  exit 1
fi
mkdir -p "$installed"
cp -R "$source_dir/." "$installed/"
diff -qr "$source_dir" "$installed"
```

Review any extra installed files reported by `diff` rather than deleting them blindly. The initial import and copy refresh were explicitly authorized on 2026-11-10. Other skill installation policies below are unchanged.

## Shared writing skills

[avoid-ai-writing](https://github.com/conorbronsdon/avoid-ai-writing) is the active trial replacement for `deslop`. Its code is installed from upstream, not vendored in this repository. Both Pi and Claude Code use the same user-level snapshot. No MCP server, npm installation, hooks, or plugin is needed.

## Source

- Upstream: https://github.com/conorbronsdon/avoid-ai-writing
- Commit: `30971f1c50c6412a0c414e8c7b15032a32b21939`
- Skill version: `3.38.0`
- Source directory: `plugins/avoid-ai-writing/skills/avoid-ai-writing/`
- Install the bundle unchanged, with upstream root `LICENSE` added.

Keep the complete directory: `SKILL.md` requires `references/patterns.md`; scripts, detector, and examples support optional verification. Review upstream changes before replacing this snapshot. Do not clone the whole upstream repository into a recursively scanned skill directory.

## User-level installation

For a fresh installation, fetch the pinned official repository into a temporary checkout, then copy only its skill bundle into a stable user-level snapshot. Run this in Bash; it refuses to overwrite an existing installation (including dangling links).

```bash
(
set -eu
commit=30971f1c50c6412a0c414e8c7b15032a32b21939
release="$HOME/.local/share/agent-customizations/skills/avoid-ai-writing-${commit:0:7}"
shared="$HOME/.agents/skills/avoid-ai-writing"
claude="$HOME/.claude/skills/avoid-ai-writing"
for path in "$release" "$shared" "$claude"; do
  if [ -e "$path" ] || [ -L "$path" ]; then
    printf 'Already exists; inspect before changing: %s\n' "$path" >&2
    exit 1
  fi
done
source_dir=$(mktemp -d)
trap 'rm -rf "$source_dir"' EXIT
git -C "$source_dir" init -q
git -C "$source_dir" remote add origin https://github.com/conorbronsdon/avoid-ai-writing.git
git -C "$source_dir" fetch --depth 1 origin "$commit"
git -C "$source_dir" checkout --detach FETCH_HEAD
test "$(git -C "$source_dir" rev-parse HEAD)" = "$commit"
mkdir -p "$(dirname "$release")" "$(dirname "$shared")" "$(dirname "$claude")"
cp -R "$source_dir/plugins/avoid-ai-writing/skills/avoid-ai-writing" "$release"
cp "$source_dir/LICENSE" "$release/LICENSE"
ln -s "$release" "$shared"
ln -s ../../.agents/skills/avoid-ai-writing "$claude"
)
```

The current trial already uses this snapshot layout; no reinstall is needed. To update, review a new upstream commit, change the pin above, and stage a new snapshot before switching the two user-level links. Keep the previous snapshot for rollback. Do not track a floating branch or automatically pull changes into an active deployment.

Pi 1.5 discovers `~/.agents/skills` directly. Claude Code uses its symlink. Do not expose the repository root or `archive/` as a skill discovery path.

Before switching, record existing `deslop` symlink targets. Remove only those links from `~/.agents/skills/deslop` and `~/.claude/skills/deslop`; do not remove the helpers release they reference. Leave other consumers and source repositories unchanged.

Reload Pi with `/reload`; start a fresh Claude Code session. Invoke `/skill:avoid-ai-writing` in Pi or `/avoid-ai-writing` in Claude Code. Automatic selection follows the upstream description. The old skill can remain in an existing conversation's context until reload or restart.

## Rollback

The complete previously deployed skill is preserved at `archive/skills/deslop/`. Copy it to a stable directory outside this checkout, link `~/.agents/skills/deslop` to it, and link `~/.claude/skills/deslop` to `../../.agents/skills/deslop`. Remove the two `avoid-ai-writing` links only after confirming their targets still belong to this installation. Reload/restart both harnesses.

The initial deployment also saves the original symlink targets under `~/.local/share/agent-customizations/backups/`. Restoring those targets instead reproduces the prior helpers-managed deployment, provided the referenced release remains available.

This trial does not modify the helpers deployment tooling. A future helpers skill sync may restore `deslop`; check the active skill directories after such a sync. Avoid having both skills active with overlapping triggers.
