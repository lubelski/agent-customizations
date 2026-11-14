# Rate limits

Shows the 5-hour and 7-day rate limit use, like `5h:12% 7d:40%`. Each uses the context bar's thresholds: green under 50%, yellow under 80%, red from 80%. Either one is hidden when Claude Code doesn't report it.

- Uses: `five_hour`, `seven_day`
- Sets: `limits_part`

```sh
# ── Rate limits ────────────────────────────────────────────────────────────
limit_color() {
  if [ "$1" -lt 50 ] 2>/dev/null; then
    printf '%s' "${GREEN}"
  elif [ "$1" -lt 80 ] 2>/dev/null; then
    printf '%s' "${YELLOW}"
  else
    printf '%s' "${RED}"
  fi
}

limits_part=""
pct5=""
pct7=""
[ -n "$five_hour" ] && pct5=$(printf '%.0f' "$five_hour" 2>/dev/null)
[ -n "$seven_day" ] && pct7=$(printf '%.0f' "$seven_day" 2>/dev/null)
if [ -n "$pct5" ]; then
  limits_part="$(limit_color "$pct5")5h:${pct5}%${RESET}"
fi
if [ -n "$pct7" ]; then
  [ -n "$limits_part" ] && limits_part="${limits_part} "
  limits_part="${limits_part}$(limit_color "$pct7")7d:${pct7}%${RESET}"
fi
```
