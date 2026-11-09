import assert from "node:assert/strict";
import test from "node:test";
import { jiti, tuiModule, themeModule } from "./pi-runtime.ts";

const { default: installAssistant } = await jiti.import("../lib/ui/messages/assistant.ts");
const extension = (api) => installAssistant(api, () => "unicode");
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

const fold = component => component.contentContainer.children.find(child => child.constructor.name === "ThinkingFold");
const long = Array.from({ length: 60 }, (_, index) => `word${index}`).join(" ");

for (const theme of ["dark", "light"]) {
 test(`thinking has no panel or padding rows, stays italic and muted, and folds to three lines: ${theme}`, () => {
  start(theme);
  const thinking = Object.freeze({ type: "thinking", thinking: long, thinkingSignature: "opaque-fixture" });
  const message = Object.freeze({ content: Object.freeze([thinking, Object.freeze({ type: "text", text: "Reply." })]), stopReason: "stop" });
  const component = new AssistantMessageComponent(message, true);
  const lines = rows(component);
  // Spacer, three folded thinking rows, spacer, then the reply panel.
  assert.equal(lines[0].trim(), "");
  assert.ok(lines.slice(1, 4).every(line => /word/.test(line)));
  assert.match(lines[3], /… $/);
  assert.equal(lines[4].trim(), "");
  assert.match(lines[5], /^ 🬭+ $/u, "the reply keeps its panel; thinking has none");
  assert.doesNotMatch(lines.slice(0, 4).join("\n"), /🬭|🬂|▐/);
  const markdown = fold(component).markdown;
  assert.equal(markdown.defaultTextStyle.italic, true);
  assert.equal(markdown.defaultTextStyle.bgColor, undefined);
  assert.equal(markdown.paddingY, 0);
  assert.equal(component.lastMessage.content[0], thinking, "message and signature untouched");
  // Click expands and collapses; the state survives Pi rebuilding the content.
  assert.deepEqual(fold(component).handleMouse({ type: "click", button: "left" }), { handled: true });
  component.updateContent(message);
  assert.ok(rows(component).filter(line => /word/.test(line)).length > 3);
  assert.match(rows(component).join("\n"), /word59/);
  fold(component).handleMouse({ type: "click", button: "left" });
  assert.equal(rows(component).filter(line => /word/.test(line)).length, 3);
  assert.equal(fold(component).handleMouse({ type: "scroll" }), undefined);
  // Short thinking is not folded and gets no ellipsis.
  const short = new AssistantMessageComponent({ content: [{ type: "thinking", thinking: "Brief." }], stopReason: "stop" }, true);
  assert.doesNotMatch(rows(short).join("\n"), /…/);
  for (const width of [10, 30, 120]) assert.ok(component.render(width).every(line => tuiModule.visibleWidth(line) <= width));
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
 assert.equal(rows(component).filter(line => line.startsWith(" 🬭")).length, 1, "only the reply has a panel");
 assert.equal(rows(component).at(-1).trim(), "", "one gap row before the tool");
 await commands.get("plain-text").handler("", ctx);
 component.invalidate();
 const plain = rows(component).join("\n");
 assert.match(plain, /First \*\*decision\*\*/);
 assert.doesNotMatch(plain, /🬭|🬂|▐/);
 await commands.get("plain-text").handler("", ctx);
 component.updateContent(message, false);
 assert.equal(component.isStreaming, false);
 assert.equal(component.lastMessage, message);
});

test("reload does not stack folds; empty thinking stays empty; errors survive", () => {
 start();
 extension(api);
 extension(api);
 const component = new AssistantMessageComponent({ content: [{ type: "thinking", thinking: "Done" }], stopReason: "aborted" }, true);
 assert.equal(component.contentContainer.children.filter(child => child.constructor.name === "ThinkingFold").length, 0, "styled lazily");
 rows(component);
 assert.equal(component.contentContainer.children.filter(child => child.constructor.name === "ThinkingFold").length, 1);
 rows(component);
 assert.equal(component.contentContainer.children.filter(child => child.constructor.name === "ThinkingFold").length, 1);
 assert.match(rows(component).join("\n"), /Operation aborted/);
 component.updateContent({ content: [{ type: "thinking", thinking: "  " }], stopReason: "stop" });
 assert.deepEqual(rows(component), []);
});
