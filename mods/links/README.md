# links

A row of clickable task links above the prompt, after `pi-customizations`' `set_footer_links`. The model keeps the list, so the ticket, the pull request and the mock page a task is about stay one click away.

## What it does

- **`set_links` tool.** Registered as `mcp__links__set_links` and listed in the model's tools from the first turn. Its input is `{ links: [{ label, url }] }`: up to 8 links, labels up to 32 characters, http or https URLs up to 2048 characters. Each call replaces the whole list. An empty list clears it. Duplicate URLs are dropped, and a bad list is refused with the reason, which the model reads.
- **The band.** While the list holds links, the band above the prompt draws them right-aligned in Claude's orange, underlined, separated by `·`. Each is a `Link` element, so a click opens it where the terminal opens links. The band stays empty while a survey holds it.
- **System prompt.** A `prompt.compose` section asks the model to keep the task's relevant links set with `set_links`, to send the complete list each time, and to clear stale ones.
- **`/links`** prints the list. `/links clear` empties it.
- **Persistence.** The list lives in `$.state`, which survives a hot reload. At session start, with no state, the mod reads the conversation for the last `set_links` call and restores its list, so a resumed session gets its links back.

## Tests

```sh
claude plugin test mods/links
```

`tests/links.test.ts` covers label cleaning, URL deduplication, each refusal and the empty list.
