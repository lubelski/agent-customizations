# Model

Shows the model name and context window size, like `Opus 5.5/1M`. Drops the `Claude ` prefix from the display name.

- Uses: `model`, `context_window_size`
- Sets: `model_part`

```sh
# ── Model + context window size tag ────────────────────────────────────────
[ -n "$model" ] || model="unknown"
[ -n "$context_window_size" ] || context_window_size=0

# Integer math only, so no bc or printf is spawned just to format a label.
ctx_tag=""
if [ "$context_window_size" -ge 1000000 ] 2>/dev/null; then
  ctx_tag="$(( (context_window_size + 500000) / 1000000 ))M"
elif [ "$context_window_size" -ge 1000 ] 2>/dev/null; then
  ctx_tag="$(( (context_window_size + 500) / 1000 ))K"
fi

short_model=${model#Claude }

model_part="${CYAN}${BOLD}${short_model}${RESET}"
if [ -n "$ctx_tag" ]; then
  model_part="${model_part}${GRAY}/${ctx_tag}${RESET}"
fi
```
