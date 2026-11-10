---
name: balsamiq-mcp
description: Create, edit, inspect, and visually verify Balsamiq Cloud wireframes through its MCP server. Use for Balsamiq URLs, mockup creation, UI reconstruction, and troubleshooting hidden or unknown tool input schemas. Includes validated creation/edit examples and cached schema reference.
---

# Balsamiq MCP wireframing

Canonical source: `agent-customizations/skills/balsamiq-mcp/`. The user-level directory `~/.agents/skills/balsamiq-mcp/` is a copied installation, not a symlink. Make durable changes in the repository first, then explicitly refresh the installed copy; see `skills/README.md` in that repository.

## Start here

1. Discover the tools (`searchTools` / `describeTool` in codemode).
2. Call `list_balsamiq_projects` first, even with a supplied URL.
3. Call `get_balsamiq_project_toc` for the target project; inspect the target board with `get_balsamiq_board_content` before editing. Follow every `nextCursor`.
4. Preserve user content. Prefer new, named boards for variants. Creation returns the authoritative board URL.
5. After creation or editing, call `get_balsamiq_board_preview` and **look at the image**. A successful tool call is not evidence of a good layout.
6. Return direct links, and distinguish baseline reconstructions from proposed designs.

Official documentation: https://balsamiq.com/support/integrations/mcp/
Server: https://bais.balsamiq.com/mcp (OAuth).

The public docs checked during the KOReader task describe capabilities/setup, not the complete authoring schema. The declarations visible through codemode showed `args: unknown` for create/edit even though a full JSON Schema was available locally. Do NOT spend many calls guessing property names.

## Recover the schema when declarations say `unknown`

First see if the tool discovery API now exposes the full schema. Otherwise, on this machine the cached server definitions are in:

`/Users/will/.pi/agent/mcp-cache.json`

Only extract `servers.balsamiq.tools[].inputSchema` for the tools needed. Do not read or print OAuth tokens or `mcp-auth.json`. The cache is a very large one-line JSON file; use a bounded parser/filter rather than dumping it into context:

```sh
node -e '
const fs = require("fs");
const server = JSON.parse(fs.readFileSync(process.env.HOME + "/.pi/agent/mcp-cache.json", "utf8")).servers.balsamiq;
const tool = server.tools.find(t => t.name === "create_balsamiq_board");
const node = tool.inputSchema.properties.board.properties.children.items;
console.log(JSON.stringify(node.properties.control.anyOf.map(v => ({
  type: v.properties.controlType.const,
  required: v.required,
  properties: Object.keys(v.properties)
})), null, 2));
'
```

Saved references in this skill directory:
- `references/tool-schemas.json`: complete observed create/edit schemas plus server instructions. Use targeted extraction; do not load all of it just to check one property. Resolve `$ref` against the corresponding tool's inputSchema, not the enclosing reference file.
- `references/create-example.json`: validated KOReader menu layout tree, with project URL replaced by a placeholder.
- `references/edit-example.json`: validated absolute additions and patch shape, with target URL/ID placeholders.

Live schemas win if they differ from this snapshot. Cache formats and tool signatures can change. Extracting the schema fixed the issue; no new authentication or browser automation was necessary.

## Creation: layout tree

`create_balsamiq_board` input:

```json
{
  "projectUrl": "https://balsamiq.cloud/SPACE/PROJECT",
  "board": {
    "boardName": "Settings — baseline",
    "width": 540,
    "backgroundColor": "#FFFFFF",
    "layout": { "direction": "column", "gap": 12 },
    "children": [
      {
        "control": {
          "controlType": "text",
          "text": "Settings",
          "textColor": "#111111",
          "fontSize": 24
        }
      },
      {
        "control": {
          "controlType": "rectangle",
          "backgroundColor": "#EEEEEE",
          "borderStyle": "solid",
          "borderColor": "#111111"
        },
        "layout": { "direction": "row", "padding": 16, "gap": 12, "alignItems": "center" },
        "children": [
          { "control": { "controlType": "icon", "id": "fa-gear", "size": 24 } },
          { "control": { "controlType": "text", "text": "Device", "textColor": "#111111" } }
        ]
      }
    ]
  }
}
```

Key facts:
- Name goes in **`board.boardName`**, not top-level `name`.
- A node has `control: { controlType: ... }`, NOT `control: "text"`, and NOT `control: { type: ... }`.
- `width`, `height`, `layout`, `children`, `id`, `flexGrow`, `flexShrink` are node properties. Text/color/icon details go inside `control`.
- A control-less node can be a layout group or dimensioned spacer.
- Layout supports `direction: row|column`, `justifyContent`, `alignItems`, `gap`, `padding` (number or per-side object), `wrap`.
- Text requires **`textColor`**. It self-sizes unless deliberately constrained.
- Rectangle fill is **`backgroundColor`**, NOT `color` on creation. Icons and lines use `color`.
- Standalone icons use canonical FA6 Free IDs such as `fa-gear`, `fa-file-lines`, `fa-book-bookmark`; icon property `id` is separate from the node's optional reference `id`.
- `button-bar.text` is comma-separated; `selectedIndex` is zero-based.
- Creation injects a screen background; do NOT add a redundant full-board/device-frame rectangle. Set `board.backgroundColor` instead. Inner cards/sections can be rectangles with children.
- Put sticky notes/arrows/design annotations **last** in board.children; they stay outside the draggable screen.
- Fixed dimensions can trigger nonfatal `redundant-sizing` warnings. Keep them when matching an actual reference; otherwise allow content-driven sizing.
- Balsamiq markup is NOT Markdown: `*bold*`, `_italic_`, `:fa-gear:`. Prefer whole-control style props over redundant inline wrappers.

Observed working creation controls include text, rectangle, icon, horizontal-line, progress-bar, sticky-note; see full schemas for others.

## Editing: absolute controls, not layout nodes

Read existing IDs first. Tool input:

```json
{
  "boardUrl": "https://balsamiq.cloud/SPACE/PROJECT/BOARD",
  "patches": [
    { "id": "EXISTING_ID", "props": { "width": 540, "height": 720 } }
  ],
  "additions": [
    {
      "controlType": "text",
      "x": 34, "y": 61, "width": 492, "height": 32, "zOrder": 2,
      "text": "Document settings ▸", "textColor": "#111111", "fontSize": 20
    }
  ],
  "deletions": ["ANOTHER_EXISTING_ID"]
}
```

- Additions are **flat**, no `control` wrapper or flexbox tree.
- Additions require **x, y, width, height, zOrder, controlType** plus type-specific requirements.
- Most addition dimensions have a **minimum of 10** (even line bounding boxes); arrows have a different minimum. Check schema.
- Patches use **`{ id, props: { ... } }`**, not `{ id, width, height }`.
- Patches use the **read-side vocabulary**. E.g. a rectangle's returned `color` is patchable even though new rectangles use `backgroundColor`.
- Addition alpha values are string enums like `"0.5"`; create-tree alpha values are numbers. Do not assume create/edit schemas are identical.
- Added controls land at board root; they do not automatically become children of the existing screen group.
- Deleting a grouped root cascades to its contents. Read before choosing deletions.
- Editing is atomic, and re-anchors content to the top-left. Re-read positions/IDs after a change rather than accumulating old coordinate assumptions.
- Edit history is recorded in project versions, not editor Undo. Inform the user before significant edits to their existing work; a copy or project history can preserve the previous design.

## Visual verification through codemode

```js
const result = await tools.mcp__balsamiq__get_balsamiq_board_preview({ boardUrl });
for (const item of result.content ?? []) {
  if (item.type === "image") image(item);
  else if (item.text) text(item.text);
}
```

Check clipping, spacing, selected states, labels, annotations, and whether the result actually matches the source. A screenshot reconstruction should state icon substitutions and schematic spacing. For application menus, capture actual runtime labels when possible: device capabilities, plugins, and document types can change a static source-defined menu.

## Repeated-list geometry and visual QA

Lessons from the Tau roster review (2026-11-10): a rendered preview is not a passed layout review.

- Prefer reusable constraint-based row/header layouts at creation time; use absolute-position edits for cleanup rather than as the primary layout strategy.
- Distinguish small visual icon bounds from intended interactive hit areas. A compact glyph does not specify an accessible click target in the eventual product.
- After collaborative edits, verify unchanged content and annotation positions against the pre-edit readback, not only the new preview.
- Define shared columns first: leading inset, fixed-width icon slot, text column, trailing action slot. Naturally sized status glyphs must not determine text indentation.
- Size repeated title and metadata controls to the available text column, not their current string's measured width. Reserve accessory space and a gutter first, then give every row the same remaining width (for example x=40 through x=398 before an action at x=410). Use explicit numeric text widths for this intentional constraint despite generic auto-sizing advice. Keep a deliberate one-line height for compact rows; a fixed box alone is not evidence of ellipsis behavior. Verify long text in the preview and label manually shortened examples as schematic.
- Use separate controls for separate actions (for example plus and overflow). Do not align controls using spaces inside text.
- Choose title-line alignment or whole-row centering for accessories explicitly; use the same rule for every status and favorite icon.
- Align Show more / Show fewer with the associated text column unless a different hierarchy is intentional.
- Measure rendered row pitch and group gaps. A two-line row is not necessarily compact just because its font is small.
- Compare variants using the same viewport dimensions and equivalent fixture content; distinguish intentional collapsed states from incidental content-driven window heights.
- Inspect generated screen bounds separately from chrome and annotation bounds. Creation can add a grab margin (observed: requested 440-wide content inside a 472-wide background); do not mistake excess right/bottom strips for intended UI. Read geometry before correcting it, and do not add a redundant outer frame.
- Review long titles, long metadata, narrow windows, missing metadata, and mixed status icons. Hand-shortened sample text does not prove automatic truncation works.
- Keep annotations outside the app silhouette with a visible gutter. Preserve user-moved notes; do not regenerate their positions during layout cleanup.
- After edits, re-read actual bounds and re-render. Check text-column x positions, action right edges, title/accessory centers, row pitch, chrome width, and footer position. Treat layout behavior inferred from one board as a hypothesis, not a universal tool guarantee.
- Empty text controls may render as the default “Some text” (observed during Tau reconstruction). Omit absent labels rather than submitting empty text.

## Avoid these traps

- Repeated union-schema errors are not proof of an auth or server failure; usually the shape is wrong. Inspect the complete schema instead of guessing.
- Do not create placeholder boards repeatedly while probing. Reuse one task-owned board, then complete it.
- Do not claim pixel-perfect output when substituting icons or approximating dimensions.
- A successful create may include warnings: review them, then render.
- Do not expose credentials while locating schemas.
