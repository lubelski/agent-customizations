import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jiti, themeModule, tuiModule } from "./pi-runtime.ts";
import { UiSettingsStore } from "../lib/ui/settings.ts";

const { default: installMessages } = await jiti.import("../lib/ui/messages/index.ts");
const { setClipboard, copyColumns } = await jiti.import("../lib/ui/messages/copy.ts");
const { UserMessageComponent, AssistantMessageComponent } = await jiti.import("@earendil-works/pi-coding-agent");

test("each panel's top edge copies its raw text, showing COPY under the pointer", async () => {
	themeModule.initTheme("dark");
	const settings = new UiSettingsStore(join(mkdtempSync(join(tmpdir(), "copy-")), "ui.json"));
	settings.reload();
	const handlers = new Map();
	const commands = new Map();
	installMessages({ on: (name, handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]), registerCommand: (name, command) => commands.set(name, command) }, settings);
	const notes = [];
	const ctx = { mode: "tui", ui: { theme: themeModule.theme, notify: (...args) => notes.push(args), setStatus() {} } };
	for (const handler of handlers.get("session_start")) handler({}, ctx);
	const copied = [];
	setClipboard(async text => { copied.push(text); });

	const W = 40;
	const container = new tuiModule.Container();
	container.addChild(new UserMessageComponent("Hello **there**"));
	container.addChild(new AssistantMessageComponent({ content: [{ type: "thinking", thinking: "hmm" }, { type: "text", text: "Reply with `code`." }], stopReason: "stop" }));
	const rows = () => container.render(W).map(tuiModule.stripTerminalSequences);
	const before = rows();
	const replyTop = before.findIndex(line => line.includes("Reply")) - 1;
	const mouse = (type, x, y) => container.handleMouse({ type, button: type === "move" ? "none" : "left", x, y, width: W, height: before.length });
	assert.deepEqual(copyColumns(38), [33, 37]);
	const x = 35; // inside outer columns 34–37

	for (const mode of [false, true]) {
		settings.update({ fontCompat: mode });
		const base = rows();
		const top = base.findIndex(line => line.includes("Reply")) - 1;
		assert.doesNotMatch(base.join("\n"), /COPY/, "at rest the cells draw as the edge");
		mouse("move", x, 0);
		assert.match(rows()[0], /COPY. $/u, "label ends one fill cell short of the panel's end");
		assert.equal(rows().length, base.length, "the label does not change layout or gap collapse");
		mouse("move", 3, 1);
		assert.doesNotMatch(rows().join("\n"), /COPY/, "moving off clears the label");
		mouse("move", x, top);
		assert.match(rows()[top], /COPY/);
		assert.doesNotMatch(rows()[0], /COPY/);
		mouse("click", x, top);
		mouse("click", x, 0);
		mouse("click", 3, 0);
		mouse("move", 3, 1);
	}
	await new Promise(resolve => setImmediate(resolve));
	assert.deepEqual(copied, ["Reply with `code`.", "Hello **there**", "Reply with `code`.", "Hello **there**"]);
	assert.deepEqual(notes.at(-1), ["Copied", "info"]);
	assert.ok(replyTop > 0);

	await commands.get("plain-text").handler("", ctx);
	mouse("move", x, 0);
	assert.doesNotMatch(rows().join("\n"), /COPY/, "plain-text mode has no copy cells");
	setClipboard(async () => { throw new Error("no clipboard"); });
	await commands.get("plain-text").handler("", ctx);
	mouse("click", x, 0);
	await new Promise(resolve => setImmediate(resolve));
	assert.deepEqual(notes.at(-1), ["Could not copy message", "error"]);
});
