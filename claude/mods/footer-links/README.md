# footer-links

A row of clickable task links above the prompt, after `pi-customizations`' `set_footer_links`. The model keeps the list, so the ticket, the pull request and the mock page a task is about stay one click away.

## What it does

- **`set_footer_links` tool.** Registered as `mcp__footer-links__set_footer_links` and listed in the model's tools from the first turn. Its short name matches Pi's `set_footer_links`. Its input is `{ links: [{ label, url, group? }] }`: up to 12 links, labels and groups up to 32 characters, http or https URLs up to 2048 characters. Each call replaces the whole list. An empty list clears it. Duplicate URLs are dropped, and a bad list is refused with the reason, which the model reads.
- **Groups.** A link may carry a `group` key, one for each piece of work: a ticket, its pull request and its agent session share one key. Links with the same key draw together, and groups keep the order in which their keys first appear. Links with no key form one group of their own. The key is not drawn. A list with no keys draws as it did before groups existed.
- **The band.** While the list holds links, the band above the prompt draws their labels right-aligned in Claude's orange, underlined, separated by `·`. Groups are separated by a dim `│`, and the band wraps between groups, never inside one: `SPM-1 · SPM-2 │ SPM-3 · #12 · Atlas │ SPM-4 · #13 · Atlas`. A list with no groups wraps between links. Each label is a plain `Button`: a click opens the URL with `open` on macOS or `xdg-open` elsewhere, and a toast says when neither could. A `Link` element would be an OSC 8 hyperlink, but on a terminal the engine does not know (Rex) it falls back to `label URL`, three times the width, so the band uses Buttons. The band stays empty while a survey holds it.
- **System prompt.** A `prompt.compose` section asks the model to call `set_footer_links` in the same turn it learns of a linkable reference point relevant to the user, such as a pull request, work ticket, or local server. That covers ones it opens or starts itself, ones a subagent or background task reports back, and ones the user gives it, so the main session keeps the band current when subagents do the work. It asks the model to group links by piece of work, not by kind, with the ticket first in its group and no parenthetical that only repeats which work a link belongs to. It also asks for the complete list each time, for a link to stay listed while its task is still the topic (a pull request stays after it merges), and for links to be removed when they are no longer relevant.
- **`/footer-links`** prints the list. `/footer-links clear` empties it.
- **Persistence.** The list lives in `$.state`, which survives a hot reload. At session start, with no state, the mod reads the conversation for the last `set_footer_links` call and restores its list, so a resumed session gets its links back. It also reads `mcp__links__set_links` calls, the tool's name before the mod was renamed from `links`.

## Tests

```sh
claude plugin test mods/footer-links
```

`tests/footer-links.test.ts` covers label cleaning, URL deduplication, each refusal, the empty list, group order, the band as drawn with and without groups, and the restore of a list from the transcript under the old and the new tool name.
