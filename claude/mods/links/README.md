# links

A row of clickable task links above the prompt, after `pi-customizations`' `set_footer_links`. The model keeps the list, so the ticket, the pull request and the mock page a task is about stay one click away.

## What it does

- **`set_links` tool.** Registered as `mcp__links__set_links` and listed in the model's tools from the first turn. Its input is `{ links: [{ label, url }] }`: up to 8 links, labels up to 32 characters, http or https URLs up to 2048 characters. Each call replaces the whole list. An empty list clears it. Duplicate URLs are dropped, and a bad list is refused with the reason, which the model reads.
- **The band.** While the list holds links, the band above the prompt draws their labels right-aligned in Claude's orange, underlined, separated by `·`. Each label is a plain `Button`: a click opens the URL with `open` on macOS or `xdg-open` elsewhere, and a toast says when neither could. A `Link` element would be an OSC 8 hyperlink, but on a terminal the engine does not know (Rex) it falls back to `label URL`, three times the width, so the band uses Buttons. The band stays empty while a survey holds it.
- **System prompt.** A `prompt.compose` section asks the model to call `set_links` in the same turn it learns of a linkable reference point relevant to the user, such as a pull request, work ticket, or local server. That covers ones it opens or starts itself, ones a subagent or background task reports back, and ones the user gives it, so the main session keeps the band current when subagents do the work. It also asks for the complete list each time, for a link to stay listed while its task is still the topic (a pull request stays after it merges), and for links to be removed when they are no longer relevant.
- **`/links`** prints the list. `/links clear` empties it.
- **Persistence.** The list lives in `$.state`, which survives a hot reload. At session start, with no state, the mod reads the conversation for the last `set_links` call and restores its list, so a resumed session gets its links back.

## Tests

```sh
claude plugin test mods/links
```

`tests/links.test.ts` covers label cleaning, URL deduplication, each refusal and the empty list.
