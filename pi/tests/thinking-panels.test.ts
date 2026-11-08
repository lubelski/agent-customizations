import assert from "node:assert/strict";
import test from "node:test";
import { jiti, tuiModule, themeModule } from "./pi-runtime.ts";

const { default: extension } = await jiti.import("../lib/ui/messages/assistant.ts");
const { AssistantMessageComponent } = await jiti.import("@earendil-works/pi-coding-agent");
const commands = new Map();
const events = new Map();
const api = { on(name, handler) { events.set(name, handler); }, registerCommand(name, value) { commands.set(name, value); } };
extension(api);

function start(theme = "dark") {
 themeModule.initTheme(theme);
 const ctx = { mode: "tui", ui: { theme: themeModule.theme, setStatus() {}, notify() {} } };
 events.get("session_start")({}, ctx);
 return ctx;
}
const rows = component => component.render(80).map(tuiModule.stripTerminalSequences);

for (const theme of ["dark", "light"]) {
 test(`thinking uses identical prose rendering, even when hidden: ${theme}`, () => {
  start(theme);
  const text = "A **decision** and `code`.\n\nAnother paragraph.";
  const thinking = Object.freeze({ type: "thinking", thinking: text, thinkingSignature: "opaque-fixture" });
  const message = Object.freeze({ content: Object.freeze([thinking]), stopReason: "stop" });
  const component = new AssistantMessageComponent(message, true);
  const prose = new AssistantMessageComponent({ content: [{ type: "text", text }], stopReason: "stop" });
  assert.deepEqual(component.render(80), prose.render(80));
  assert.equal(component.lastMessage, message);
  assert.equal(component.lastMessage.content[0], thinking);
  assert.equal(component.hideThinkingBlock, true);
  assert.ok(component.contentContainer.children.some(child => child instanceof tuiModule.Markdown));
  assert.ok(!component.contentContainer.children.some(child => child instanceof tuiModule.MouseRegion));
  component.setHideThinkingBlock(true);
  component.invalidate();
  assert.deepEqual(component.render(80), prose.render(80));
  for (const width of [10, 30, 120]) {
   assert.ok(component.render(width).every(line => tuiModule.visibleWidth(line) <= width));
  }
 });
}

test("thinking streams, keeps order, and participates in plain-text mode", async () => {
 const ctx = start();
 const component = new AssistantMessageComponent({ content: [{ type: "thinking", thinking: "First" }] }, true);
 assert.match(rows(component).join("\n"), /First/);
 const message = { content: [
  { type: "thinking", thinking: "First **decision**" },
  { type: "thinking", thinking: "Second decision" },
  { type: "text", text: "Progress commentary" },
  { type: "toolCall", id: "test", name: "read", arguments: { path: "fixture" } },
 ], stopReason: "toolUse" };
 component.updateContent(message, true);
 const formatted = rows(component).join("\n");
 assert.ok(formatted.indexOf("First") < formatted.indexOf("Second"));
 assert.ok(formatted.indexOf("Second") < formatted.indexOf("Progress"));
 assert.doesNotMatch(formatted, /Thinking\.\.\./);
 assert.equal(component.hasToolCalls, true);
 assert.equal(component.isStreaming, true);
 assert.equal(rows(component).filter(line => line.startsWith("🬞")).length, 2);
 await commands.get("plain-text").handler("", ctx);
 component.invalidate();
 const plain = rows(component).join("\n");
 assert.match(plain, /First \*\*decision\*\*/);
 assert.doesNotMatch(plain, /🬞|▐/);
 component.updateContent(message, false);
 assert.equal(component.isStreaming, false);
 assert.equal(component.lastMessage, message);
});

test("reload does not stack panels; empty thinking stays empty; errors survive", () => {
 start();
 extension(api);
 extension(api);
 const component = new AssistantMessageComponent({ content: [{ type: "thinking", thinking: "Done" }], stopReason: "aborted" }, true);
 assert.equal(rows(component).filter(line => line.startsWith("🬞")).length, 1);
 assert.match(rows(component).join("\n"), /Operation aborted/);
 component.updateContent({ content: [{ type: "thinking", thinking: "  " }], stopReason: "stop" });
 assert.deepEqual(rows(component), []);
});
