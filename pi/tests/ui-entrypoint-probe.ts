// Runs in a fresh child process: ownership intentionally lasts for the process.
import assert from "node:assert/strict";
import { jiti, piRoot, tuiModule, themeModule } from "./pi-runtime.ts";

const { AssistantMessageComponent, UserMessageComponent, ToolExecutionComponent, Theme } = await jiti.import(`${piRoot}/dist/index.js`);
const legacy = ["assistant-background", "code-brackets", "half-bleed", "recessed-tools", "session-title-banner", "stable-input-layout"];
const loaded = new Map();
for (const name of ["ui", ...legacy]) loaded.set(name, (await jiti.import(`../extensions/${name}.ts`)).default);
const snapshot = () => [AssistantMessageComponent.prototype.render, AssistantMessageComponent.prototype.updateContent,
	ToolExecutionComponent.prototype.render, Theme.prototype.bg, Theme.prototype.fg, tuiModule.Markdown.prototype.renderToken];

function runtime() {
	const handlers = new Map();
	const commands = new Map();
	const tools = new Map();
	const shortcuts = new Map();
	const add = (map, name, value) => { assert.ok(!map.has(name), `Duplicate registration: ${name}`); map.set(name, value); };
	const api = {
		on(name, handler) { const list = handlers.get(name) ?? []; list.push(handler); handlers.set(name, list); return () => {}; },
		registerCommand: (name, value) => add(commands, name, value),
		registerTool: (value) => add(tools, value.name, value),
		registerShortcut: (name, value) => add(shortcuts, name, value),
		events: { on() {} },
	};
	const warnings: string[] = [];
	const ctx = { mode: "tui", hasUI: true, sessionManager: { getBranch: () => [] }, ui: {
		notify: (text) => warnings.push(text), get theme() { return themeModule.theme; },
		setStatus() {}, setWidget() {}, setFooter() {}, getEditorComponent() {}, setEditorComponent() {},
	} };
	return { api, commands, tools, warnings, async emit(name) { for (const handler of handlers.get(name) ?? []) await handler({}, ctx); } };
}

function renderedTranscript() {
	const result = [];
	for (const width of [20, 80]) {
		const assistant = new AssistantMessageComponent({ content: [
			// Thinking deliberately diverges from the legacy panels (three-line fold).
			{ type: "text", text: "A reply.\n\n```ts\nconst x = 1;\n```" },
		], stopReason: "stop" }, true);
		const user = new UserMessageComponent("A **prompt** with 日本語.");
		const tool = new ToolExecutionComponent("read", "test", { path: "/project/test.ts" }, {}, undefined, { requestRender() {} });
		tool.updateResult({ content: [{ type: "text", text: "one\ntwo\nthree" }] }, false);
		result.push(user.render(width), assistant.render(width), tool.render(width));
		tool.setExpanded(true);
		result.push(tool.render(width));
	}
	return result.map((lines) => lines.map(tuiModule.stripTerminalSequences));
}

const mode = process.argv[2];
let transcript;
themeModule.initTheme("dark");
const first = mode === "legacy-first" ? legacy : ["ui"];
const second = mode === "legacy-first" ? ["ui"] : legacy;
for (let reload = 0; reload < 3; reload++) {
	const r = runtime();
	for (const name of first) loaded.get(name)(r.api);
	const installed = snapshot();
	const counts = [r.commands.size, r.tools.size];
	for (const name of second) loaded.get(name)(r.api);
	assert.deepEqual(snapshot(), installed, "losing family must not touch prototypes");
	assert.deepEqual([r.commands.size, r.tools.size], counts, "losing family must not register commands or tools");
	// Duplicate entry points from another installation are blocked too.
	for (const name of first) loaded.get(name)(r.api);
	assert.deepEqual(snapshot(), installed);
	await r.emit("session_start");
	const rendered = renderedTranscript();
	if (transcript) assert.deepEqual(rendered, transcript, "reload must not stack renderer patches");
	transcript = rendered;
	assert.ok(r.warnings.some((text) => text.includes("restart Pi")));
	assert.deepEqual([...r.tools.keys()].sort(), ["set_footer_links", "set_task_workspace"]);
	assert.deepEqual([...r.commands.keys()].sort(), (mode === "legacy-first"
		? ["copy-code", "inventory", "plain-text", "tool-detail"]
		: ["copy-code", "inventory", "plain-text", "tool-detail", "ui-toggle-compact-footer", "ui-toggle-compact-header", "ui-toggle-font-compat"]).sort());
	await r.emit("session_shutdown");
}
console.log(JSON.stringify({ mode, transcript }));
