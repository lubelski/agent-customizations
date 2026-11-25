# Context bar

Shows context window use as a 10-block bar and a percentage, like `██░░░░░░░░ 23%`. Green under 50%, yellow under 80%, red from 80%. Hidden until Claude Code reports usage.

- Uses: `used`
- Sets: `ctx_part`

```sh
# ── Context bar ────────────────────────────────────────────────────────────
ctx_part=""
if [ -n "$used" ]; then
  used_int=$(printf '%.0f' "$used" 2>/dev/null) || used_int=0
  [ -n "$used_int" ] || used_int=0
  [ "$used_int" -ge 0 ] 2>/dev/null || used_int=0
  [ "$used_int" -le 100 ] 2>/dev/null || used_int=100
  filled=$(( used_int / 10 ))
  empty=$(( 10 - filled ))

  if [ "$used_int" -lt 50 ]; then
    bar_color="${GREEN}"
  elif [ "$used_int" -lt 80 ]; then
    bar_color="${YELLOW}"
  else
    bar_color="${RED}"
  fi

  bar=""
  i=0
  while [ $i -lt $filled ]; do
    bar="${bar}█"
    i=$(( i + 1 ))
  done
  i=0
  while [ $i -lt $empty ]; do
    bar="${bar}░"
    i=$(( i + 1 ))
  done

  ctx_part="${bar_color}${bar}${RESET}${GRAY} ${used_int}%${RESET}"
fi
```
