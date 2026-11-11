# Model launchers

`opus` and `fable` start interactive Claude Code sessions with the corresponding model alias. An optional first argument selects thinking effort: `low`, `medium`, `high`, `xhigh`, or `max`. The default is `medium`.

They use the `claude` executable on PATH and forward the remaining arguments unchanged. A first argument that is not an effort level is passed through too. Permissions and other Claude settings are left alone. Supported effort levels may vary by model; Claude handles model-specific validation.

```sh
opus
fable
opus high --continue
fable low "Explain this repository"
opus max
fable "Explain this repository"
```

Requires a Claude Code version supporting both model aliases and `--effort medium`, plus account access to those models. The aliases follow Claude Code's model selection rather than pinning a model version.

## Install locally

From the repository root, after checking that these names do not replace existing commands:

```sh
mkdir -p "$HOME/.local/bin"
install -m 755 claude/bin/opus claude/bin/fable "$HOME/.local/bin/"
```

Ensure `~/.local/bin` is on PATH. Installation copies the scripts; it does not depend on a checkout or worktree remaining in place. Run the install command again after editing them. Remove `~/.local/bin/opus` and `~/.local/bin/fable` to uninstall.
