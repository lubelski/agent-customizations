# Assemble

Every statusline built from this recipe ends with this block. It joins the non-empty segments with `SEP` and prints the line.

The list names every segment in this recipe. A segment that was not included leaves its variable unset, which counts as empty, so the list does not need editing when segments are left out. To change the order, reorder the list.

```sh
# ── Assemble status line ───────────────────────────────────────────────────
output=""
for part in \
  "$model_part" "$ctx_part" "$limits_part" "$effort_part" \
  "$folder_part" "$git_part" "$worktree_part" "$agent_part" \
  "$style_part" "$vim_part" "$pr_part"
do
  [ -n "$part" ] || continue
  if [ -n "$output" ]; then
    output="${output}${SEP}${part}"
  else
    output="$part"
  fi
done

# %b expands the \033 escapes without treating branch names etc. as a format
# string. A branch like "fix/100%-cpu" would break printf "$output".
printf '%b\n' "$output"
```
