# Folders

Shows the folder where the session started, as `parent/folder` in white. It does not change when the session `cd`s.

When the current folder differs from the start folder, a second element follows after a gray `→`, in yellow. Inside the start folder it is a relative path like `./src`. Anywhere else it is `parent/folder`.

| Start | Current | Shows |
|---|---|---|
| `~/dev/personal-config/home` | same | `personal-config/home` |
| `~/dev/personal-config/home` | `~/dev/personal-config/home/.claude` | `personal-config/home → ./.claude` |
| `~/dev/personal-config/home` | `~/dev/other` | `personal-config/home → dev/other` |

The start folder comes from `workspace.project_dir`. If that is missing, it falls back to the current folder.

- Uses: `project_dir`, `cwd`
- Sets: `folder_part`

```sh
# ── Folders ────────────────────────────────────────────────────────────────
short_path() {
  _name=${1##*/}
  [ -n "$_name" ] || { printf '%s' "$1"; return; }
  _parent=${1%/*}
  _parent=${_parent##*/}
  if [ -n "$_parent" ]; then
    printf '%s/%s' "$_parent" "$_name"
  else
    printf '%s' "$_name"
  fi
}

start_dir=${project_dir:-$cwd}
folder_part=""
if [ -n "$start_dir" ]; then
  folder_part="${WHITE}$(short_path "$start_dir")${RESET}"
  if [ -n "$cwd" ] && [ "$cwd" != "$start_dir" ]; then
    case "$cwd" in
      "$start_dir"/*) cur_label="./${cwd#"$start_dir"/}" ;;
      *)              cur_label=$(short_path "$cwd") ;;
    esac
    folder_part="${folder_part} ${GRAY}→${RESET} ${YELLOW}${cur_label}${RESET}"
  fi
fi
```
