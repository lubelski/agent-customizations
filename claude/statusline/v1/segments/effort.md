# Effort

Shows the effort level and whether extended thinking is on, like `eff:high+think`. Shows `think` alone when there is no effort level.

- Uses: `effort_level`, `thinking_enabled`
- Sets: `effort_part`

```sh
# ── Effort / thinking ──────────────────────────────────────────────────────
effort_part=""
if [ -n "$effort_level" ]; then
  effort_part="${GRAY}eff:${effort_level}${RESET}"
fi
if [ "$thinking_enabled" = "true" ]; then
  if [ -n "$effort_part" ]; then
    effort_part="${effort_part}${GRAY}+think${RESET}"
  else
    effort_part="${GRAY}think${RESET}"
  fi
fi
```
