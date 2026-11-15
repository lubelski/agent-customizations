# Alfred agent launchers

Four keywords open **new iTerm windows**, not tabs or existing sessions.
Results are named **Pi**, **Claude in iTerm**, **Opus**, and **Fable**.
Only Claude retains the suffix to distinguish it from the Claude desktop app. Each has a dark icon with a white lettermark (`Pi`, `C`, `O`,
`F`): turquoise accents for Pi, Anthropic terracotta/orange for Claude models.
The short keywords remain unchanged:

```text
pi
pi --model opus
pi --provider anthropic --model claude-opus-4-6
claude
claude --model sonnet
opus
opus high
fable low "Explain this repository"
```

Arguments use shell-style quoting, but are passed literally: no variable expansion,
command substitution, globbing, pipes, or redirection. Quote multiword prompts.
Unmatched quotes fail without opening a window (see Alfred's workflow debugger).
`opus` and `fable` bundle copies of the repo's [Claude launchers](../claude/bin/README.md):
medium effort by default, optional first effort argument. Model availability depends
on your CLI/account; the workflow does not configure providers or authentication.

Sessions start in `~/dev`. Change `AGENT_DIRECTORY` in the workflow's Alfred variables
to choose another existing directory (leading `~` is supported). The new window runs
an interactive login zsh, loading normal shell configuration, with Pi's user bin,
`~/.local/bin`, and Homebrew added to PATH. When the CLI exits, the window remains
at a shell prompt. No global Claude/Pi settings or shell aliases are changed.

## Requirements

macOS, Alfred Powerpack, iTerm2, `/usr/bin/python3` (Xcode Command Line Tools), and
installed/authenticated Pi and Claude CLIs. macOS may ask permission for Alfred to
control iTerm; allow it under System Settings → Privacy & Security → Automation.

## Install / update

From the repo root, either build and import through Alfred:

```sh
python3 alfred/build.py /tmp/Agent-Launchers.alfredworkflow
open /tmp/Agent-Launchers.alfredworkflow
```

Or install directly into your **active** preferences bundle:

```sh
python3 alfred/install.py "$HOME/Library/Application Support/Alfred/Alfred.alfredpreferences"
```

For synced preferences, pass their actual `.alfredpreferences` path instead.
Choose one installation method to avoid duplicate keywords. The direct installer
updates only its own fixed workflow folder; Alfred's `prefs.plist` overrides are
preserved. Installation is a copy, independent of the checkout/worktree. Re-run to
update; remove **Agent Launchers** in Alfred Preferences to uninstall.

## Icon assets

The committed 512×512 PNGs in `icons/` are copied to the workflow root. Alfred
uses `<keyword-object-uid>.png` for each result and `icon.png` as the fallback.
No image dependencies are needed to install or build. To regenerate on macOS:

```sh
uv run --no-project alfred/generate_icons.py
```

The generator uses isolated, pinned Pillow and macOS Arial Bold; use `--font`
to specify another font path on other systems. Icons are white-on-black with
`#D97757` Claude accents and `#40D9CE` Pi accents, with transparent outer corners.

## Validation

```sh
python3 -m unittest discover -s alfred -p 'test_*.py' -v
```

For a live smoke test without starting a paid session, run `pi --help` and
`claude --help` through Alfred. Check that each creates its own iTerm window.
