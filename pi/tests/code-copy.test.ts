import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jiti, tuiModule, themeModule } from "./pi-runtime.ts";
import { UiSettingsStore } from "../lib/ui/settings.ts";

const { stripTerminalSequences } = tuiModule;

/** The label row of the last code block and the first copy cell after its label. */
function target(lines: string[]) {
 const plain = lines.map(stripTerminalSequences);
 const foot = plain.findLastIndex(line => line.includes("└"));
 // The code rule runs in the foot's column; a quote's own │ sits left of it.
 const column = [...plain[foot]].indexOf("└");
 let y = foot - 1;
 while (y > 0 && [...plain[y]][column] === "│") y--;
 const label = plain[y].trimEnd();
 return { y, x: label.length + 1, plain };
}

test("the cells after a block's label show COPY under the pointer and copy the original block", async () => {
 const { default: extension } = await jiti.import("../lib/ui/code.ts");
 const { installCodeCopy, clearCodeCopyHover } = await jiti.import("../lib/code-copy.ts");
 const { attachMessageRendering } = await jiti.import("../lib/message-controls.ts");
 const { getMarkdownTheme } = await jiti.import("@earendil-works/pi-coding-agent");
 const { Markdown } = tuiModule;
 themeModule.initTheme("dark");
 extension({ on() {} });
 const copied = [];
 const notices = [];
 for (let reload = 0; reload < 3; reload++) {
  installCodeCopy(Markdown.prototype, async text => { copied.push(text); }, message => notices.push(message));
  for (const [source, expected] of [
   ["```ts\n\tconst 界 = 1;\n\nlong_long_long_long_line\n```", "\tconst 界 = 1;\n\nlong_long_long_long_line"],
   ["> ```js\n> x();\n> ```", "x();"],
   ["- item\n\n  ```js\n  nested();\n  ```", "nested();"],
   ["    indented\n\n```\nsecond\n```", "second"],
   ["```\nfirst\n```\n\n```\nsecond\n```", "second"],
   ["```js\nstreaming", "streaming"],
  ]) {
   const block = new Markdown(source, 1, 1, getMarkdownTheme());
   const mode = { plain: false };
   attachMessageRendering(block, mode);
   for (const width of [40, 12, 40, 40]) {
    const lines = block.render(width);
    assert.ok(lines.every(line => !line.includes("pi-code")), "metadata never reaches terminal");
    const { x, y, plain } = target(lines);
    assert.doesNotMatch(plain.join("\n"), /COPY/, "at rest the cells are blank");
    const event = { type: "click", button: "left", x: x + 2, y, width, height: lines.length, screenX: x, screenY: y, shift: false, alt: false, ctrl: false };
    // Pi's TUI redraws after a move only when the result asks for it.
    assert.deepEqual(block.handleMouse({ ...event, type: "move", button: "none" }), { handled: true, render: true }, source);
    const hovered = block.render(width).map(stripTerminalSequences);
    assert.equal(hovered[y].slice(x, x + 4), "COPY", source);
    assert.equal(hovered.length, lines.length, "the label does not change layout");
    clearCodeCopyHover();
    assert.doesNotMatch(block.render(width).map(stripTerminalSequences).join("\n"), /COPY/);
    assert.equal(block.handleMouse(event)?.handled, true, source);
    await Promise.resolve();
    assert.equal(copied.at(-1), expected);
    for (const change of [{ x: x - 1 }, { x: x + 4 }, { y: y + 1 }, { type: "drag" }, { type: "wheel" }, { button: "right" }, { shift: true }]) {
     assert.equal(block.handleMouse({ ...event, ...change }), undefined, JSON.stringify(change));
    }
    mode.plain = true;
    block.render(width);
    assert.equal(block.handleMouse(event), undefined);
    mode.plain = false;
   }
   block.setText("no code now");
   block.render(40);
   assert.equal(block.handleMouse({ type: "click", button: "left", x: 1, y: 2 }), undefined);
  }
 }
 assert.ok(notices.includes("Copied"));

 // Too narrow for the label, the gap and four cells: no target.
 const narrow = new Markdown("```typescript\nx\n```", 0, 0, getMarkdownTheme());
 const lines = narrow.render(12);
 assert.equal(narrow.handleMouse({ type: "click", button: "left", x: 11, y: 0, width: 12, height: lines.length }), undefined);

 installCodeCopy(Markdown.prototype, async () => { throw new Error("clipboard unavailable"); }, message => notices.push(message));
 const block = new Markdown("```\nx\n```", 0, 0, getMarkdownTheme());
 block.render(20);
 block.handleMouse({ type: "click", button: "left", x: 5, y: 0 });
 await Promise.resolve();
 assert.equal(notices.at(-1), "Could not copy code");
});

test("code-block copy cells work inside an assistant panel", async () => {
 themeModule.initTheme("dark");
 const { default: installMessages } = await jiti.import("../lib/ui/messages/index.ts");
 const { default: extension } = await jiti.import("../lib/ui/code.ts");
 const { installCodeCopy } = await jiti.import("../lib/code-copy.ts");
 const { AssistantMessageComponent } = await jiti.import("@earendil-works/pi-coding-agent");
 const settings = new UiSettingsStore(join(mkdtempSync(join(tmpdir(), "code-copy-")), "ui.json"));
 settings.reload();
 const handlers = new Map();
 installMessages({ on: (name, handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]), registerCommand() {} }, settings);
 extension({ on() {} });
 const ctx = { mode: "tui", ui: { theme: themeModule.theme, notify() {}, setStatus() {} } };
 for (const handler of handlers.get("session_start") ?? []) handler({}, ctx);
 const copied = [];
 installCodeCopy(tuiModule.Markdown.prototype, async text => { copied.push(text); }, () => {});

 const W = 40;
 const container = new tuiModule.Container();
 container.addChild(new AssistantMessageComponent({ content: [{ type: "text", text: "Run:\n\n```sh\nnpm run check\n```\n\nDone." }], stopReason: "stop" }));
 const rows = () => container.render(W).map(stripTerminalSequences);
 const base = rows();
 const y = base.findIndex(line => /\bsh\s*$/.test(line.trimEnd()) || line.trimEnd().endsWith(" sh"));
 assert.ok(y > 0, base.join("\n"));
 const x = base[y].indexOf("sh") + 3;
 const mouse = (type, mx) => container.handleMouse({ type, button: type === "move" ? "none" : "left", x: mx, y, width: W, height: base.length });
 mouse("move", x + 1);
 assert.equal(rows()[y].slice(x, x + 4), "COPY", rows()[y]);
 mouse("move", 0);
 assert.doesNotMatch(rows()[y], /COPY/, "moving off clears the label");
 mouse("click", x + 1);
 await Promise.resolve();
 assert.deepEqual(copied, ["npm run check"]);
});
