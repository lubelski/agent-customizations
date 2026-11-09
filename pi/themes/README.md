# Themes

## Installation

Link the themes into Pi's user theme directory:

```sh
mkdir -p "$HOME/.pi/agent/themes"
for name in turquoise turquoise-light; do
  ln -sfn \
    "$HOME/dev/agent-customizations/pi/themes/$name.json" \
    "$HOME/.pi/agent/themes/$name.json"
done
```

Select `turquoise` through `/settings`, or set `"theme": "turquoise-light/turquoise"` to follow the terminal's appearance, then run `/reload`.

## `turquoise`

A dark theme based on Pi's built-in dark palette. It keeps blue user-message panels, neutral body text, semantic green/yellow/red states, and replaces the violet/pink family used by accents, active borders, inline code, list bullets, custom messages, syntax types, and thinking levels with turquoise and teal. Thinking-level colors are deliberately subdued because they draw the editor's horizontal rules.

The custom extensions compose with the theme as follows:

- assistant prose and thinking text share the same adaptive neutral-gray panel;
- user messages use the theme's blue `userMessageBg`;
- tool rules mix the theme's `toolPendingBg` and `borderMuted`;
- footer run state uses the theme's teal `accent`;
- ordinary footer text uses the theme's neutral `text` and `dim` colors.

## `turquoise-light`

The light counterpart, based on Pi's built-in light palette with the same violet-to-turquoise substitutions. Panels are pale tints, and the thinking-level ramp runs from light gray through pale teal to green.

Unlike Pi's `system` theme, this palette is Pi-specific and does not derive hues from the terminal's ANSI colors.
