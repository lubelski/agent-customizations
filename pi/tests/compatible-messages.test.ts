import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UiSettingsStore } from "../lib/ui/settings.ts";
import { jiti, themeModule, tuiModule } from "./pi-runtime.ts";

const { default: installMessages } = await jiti.import("../lib/ui/messages/index.ts");
const { AssistantMessageComponent, UserMessageComponent, CustomMessageComponent } = await jiti.import("@earendil-works/pi-coding-agent");
const specialEdges = /[▐▌\u{1FB00}-\u{1FB3B}]/u;

test("compatible panels avoid block glyphs and switch existing/cached/streaming messages live", async (t) => {
	const dir = mkdtempSync(join(tmpdir(), "compatible-panels-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const settings = new UiSettingsStore(join(dir, "ui.json"));
	settings.reload();
	const events = new Map();
	const commands = new Map();
	installMessages({ on: (name, handler) => events.set(name, handler), registerCommand: (name, command) => commands.set(name, command) }, settings);
	for (const theme of ["dark", "light"]) {
		themeModule.initTheme(theme);
		const ctx = { mode: "tui", ui: { theme: themeModule.theme, notify() {} } };
		events.get("session_start")({}, ctx);
		const message = Object.freeze({ content: Object.freeze([
			Object.freeze({ type: "thinking", thinking: "A **decision**.", thinkingSignature: "unchanged" }),
			Object.freeze({ type: "text", text: "A **reply**.\n\n```js\nx();\n```" }),
		]), stopReason: "stop" });
		const assistant = new AssistantMessageComponent(message, true);
		const user = new UserMessageComponent("A prompt with 日本語.");
		const custom = new CustomMessageComponent({ role: "custom", customType: "test", content: "Custom text", display: true, timestamp: 0 });
		const components = [assistant, user, custom];
		for (const layout of ["compatible", "unicode", "compatible", "unicode", "compatible"] as const) {
			settings.update({ fontCompat: layout === "compatible" });
			for (const width of [8, 40, 100]) {
				for (const component of components) {
					// Render twice at the same width to exercise native Markdown caches.
					const first = component.render(width);
					const second = component.render(width);
					assert.deepEqual(second, first);
					const plain = second.map(tuiModule.stripTerminalSequences).join("\n");
					if (layout === "compatible") {
						assert.doesNotMatch(plain, specialEdges);
						// One uncolored gap column outside the panel on each side.
						if (width >= 3) for (const line of second) {
							assert.match(line, /^(?:\x1b\][^\x07]*\x07)*\x1b\[49m /, "OSC markers stay at column 0, then the gap");
							assert.ok(line.endsWith("\x1b[49m "), JSON.stringify(line));
						}
					}
					else assert.match(plain, specialEdges);
					assert.ok(second.every(line => tuiModule.visibleWidth(line) <= width));
				}
			}
			assert.equal(assistant.lastMessage, message);
			assert.equal(assistant.lastMessage.content[0].thinkingSignature, "unchanged");
		}
		const streaming = new AssistantMessageComponent({ content: [{ type: "text", text: "Partial" }] });
		streaming.updateContent({ content: [{ type: "text", text: "More **streaming** text" }] }, true);
		assert.doesNotMatch(streaming.render(80).map(tuiModule.stripTerminalSequences).join("\n"), specialEdges);
		await commands.get("plain-text").handler("", ctx);
		const plainUser = new UserMessageComponent("A **bold** prompt.");
		assert.match(plainUser.render(80).map(tuiModule.stripTerminalSequences).join("\n"), /\*\*bold\*\*/, "user prompts follow /plain-text");
		assert.match(user.render(80).map(tuiModule.stripTerminalSequences).join("\n"), /─{10}/, "existing user prompts switch too");
		assert.match(assistant.render(80).map(tuiModule.stripTerminalSequences).join("\n"), /\*\*reply\*\*/);
		settings.update({ fontCompat: false });
		assert.doesNotMatch(assistant.render(80).map(tuiModule.stripTerminalSequences).join("\n"), specialEdges, "plain text overrides panel style");
		settings.update({ fontCompat: true });
	}
});
