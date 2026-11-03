# Claude customizations

Personal mods for [Claude Code](https://claude.com/claude-code), the counterpart of [`pi-customizations`](https://github.com/lubelski/pi-customizations) for Pi. Each mod is a Claude Code plugin with a hooks module, in its own folder under `mods/`. The repository root is a plugin marketplace, so each mod installs with one command.

## Included mods

- [`message-panels`](mods/message-panels) draws assistant replies and typed prompts as shaded panels with half-block edges, in a warm palette near Claude's orange. Tool calls shrink to one dim line each, such as `› Bash · git status`, and successful tool output stays hidden until ctrl+o. Rows keep one blank row between messages, never two.
- [`code-brackets`](mods/code-brackets) draws each fenced code block in an assistant reply as its language label, a muted `│` rule beside the highlighted code, and a short `└──` foot. Clicking the rule or the label copies that block's code, without fences or label. It works alone or inside `message-panels`, in either order.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install message-panels --marketplace lubelski/claude-customizations
/plugin install code-brackets --marketplace lubelski/claude-customizations
```

Answer `y` to add the marketplace, then pick a scope. The repository is private, so the machine needs a git credential for github.com (an SSH key, or `gh auth login` then `gh auth setup-git`).

## Update

After a mod's version changes on `main`, run this on each machine, then restart Claude Code:

```sh
claude plugin marketplace update claude-customizations
```

## Develop

See [`AGENTS.md`](AGENTS.md) for the full workflow and the API behavior these mods depend on.

Run a session with a mod loaded from its folder, with edits hot-reloaded:

```sh
claude --plugin-dir mods/message-panels
```

Check a mod before committing:

```sh
claude plugin validate mods/message-panels
```

The engine writes the API types to `mods/<mod>/.claude-plugin/types/` when it loads the mod. Git ignores that folder. Once it exists, `npx -p typescript@5 tsc -p mods/<mod>` type-checks the mod. Run a mod's tests with `claude plugin test mods/<mod>`.
