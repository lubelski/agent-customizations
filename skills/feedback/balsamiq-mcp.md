# Balsamiq MCP — raw feedback

Dated observations for later synthesis, not instructions to load on every Balsamiq task. This directory is outside the installed `skills/balsamiq-mcp/` bundle. Keep observations, user reports, inferences, and candidate guidance distinct. Append corrections rather than silently rewriting earlier findings. Promote recurring lessons into the skill or detailed recipes into its references; record that disposition here.

## 2026-11-10 — User-arranged A/B comparison board

**Status:** Raw observation; candidate guidance not yet promoted.

**Sources:** [Roster A & B](https://balsamiq.cloud/saaajyz/pyqmfoa/r4D56), [former standalone B board](https://balsamiq.cloud/saaajyz/pyqmfoa/r8E8D). Links are mutable; measurements describe the readback on this date. Inspected fresh rendered previews and complete control hierarchies, not just the board names.

**User report:** The user reorganized rosters A and B and asked us to take notes about Balsamiq use. They did not ask us to modify the boards or turn this arrangement into a universal rule.

**Observed:**
- The former A board is now titled “Roster A & B” and contains both designs side by side. The former standalone B board still exists in the project list but returned an empty hierarchy and blank preview.
- Each design has its own yellow explanatory note above it. The notes use left-aligned prose with blank lines between paragraphs, rather than the previous dense centered paragraphs.
- Notes occupy approximately one design-column width: A 459 units, B 440. Their heights are almost equal (281 and 280). They are separate from the app silhouettes, with roughly 39–46 units between note bottoms and window tops.
- The windows are both 440 units wide, separated by 60 units. Their top edges are nearly aligned (y=328 and y=326), so the shared header, Favorites, and first project can be compared horizontally.
- Window heights remain different: A 640, B 543. This arrangement does not establish a same-height viewport requirement.
- The earlier row/text geometry is retained in the compared areas: title and metadata columns start 40 units inside each window, text boxes are 358 wide, and consecutive thread titles are 44 units apart.
- Plus controls are now included in each screen's returned hierarchy. Earlier MCP additions had landed at board root. We can observe current containment, but cannot infer the exact editor gesture used to achieve it.

**Interpretation (not yet confirmed as a general user preference):**
- Putting related alternatives on one canvas makes comparison possible without switching boards and remembering the previous design.
- A consistent “explanation above, design below” arrangement makes note ownership obvious. Left-aligned paragraph text is easier to scan than centered long-form prose.
- Same width, near-aligned tops, and shared row rhythm are useful comparison anchors even when the examples differ in height or collapsed state.
- Organizing the review canvas is a separate design task from organizing controls inside an application window. A successful single-screen layout does not automatically make a useful review board.

**Candidate guidance for later synthesis:**
- For a small set of closely related alternatives, consider a comparison board with one column per alternative and a similarly sized note above each. Do not automatically combine unrelated screens or create an excessively wide canvas.
- Prefer left alignment and paragraph separation for explanatory notes containing substantial prose. Short callouts can have different formatting.
- Keep each mock screen independently movable, including any controls added during later cleanup. Check actual grouping/containment after edits; visual proximity is not proof of group membership.
- Re-read the project table of contents after user reorganization. Names and old URLs can remain while contents move elsewhere; do not interpret an empty old board as loss of the design without checking its new location.
- Avoid “correcting” small manual offsets or unequal heights unless they interfere with the comparison or the user asks. Preserve the user's arrangement.

**Open questions:** Should side-by-side alternatives plus notes above become the default for comparison requests, or remain an offered arrangement? When does a comparison board become too wide? Does the user prefer long design notes on canvas, or concise notes with longer rationale elsewhere?

**Action taken:** Recorded feedback only. No Balsamiq edits, no skill changes, no installed-file refresh.
