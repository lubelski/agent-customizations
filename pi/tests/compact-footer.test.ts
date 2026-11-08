import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UiSettingsStore } from "../lib/ui/settings.ts";
import { jiti, themeModule, tuiModule, keybindingsModule } from "./pi-runtime.ts";

const { default: installFooter } = await jiti.import("../lib/ui/footer.ts");

test("compact footer preserves links, workspace, inventory and native autocomplete while toggling live", async (t) => {
	const dir = mkdtempSync(join(tmpdir(), "compact-footer-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const settings = new UiSettingsStore(join(dir, "ui.json"));
	settings.applyPreset("mobile");
	themeModule.initTheme("dark");
	const commands = new Map();
	const tools = new Map();
	const events = new Map();
	const entries = [];
	let renders = 0;
	let invalidations = 0;
	let footer;
	let editorFactory;
	let pending = false;
	const tui = { requestRender() { renders++; }, invalidate() { invalidations++; }, terminal: { rows: 24, columns: 80 } };
	const pi = {
		on: (name, handler) => events.set(name, handler), events: { on() {} },
		registerCommand: (name, value) => commands.set(name, value), registerTool: tool => tools.set(tool.name, tool), registerShortcut() {},
		getAllTools: () => [{ name: "mcp__linear__search", exposure: "codemode" }], getActiveTools: () => [], getCommands: () => [],
		appendEntry: (customType, data) => entries.push({ type: "custom", customType, data }),
	};
	const ctx = {
		mode: "tui", sessionManager: { getCwd: () => dir, getBranch: () => entries, getEntries: () => entries },
		model: { id: "test-model", provider: "test" }, getContextUsage: () => ({ percent: 12.5, contextWindow: 200000 }),
		hasPendingMessages: () => pending, isIdle: () => true,
		ui: {
			get theme() { return themeModule.theme; },
			getEditorComponent: () => editorFactory, setEditorComponent: value => { editorFactory = value; },
			setFooter: factory => { footer = factory(tui, themeModule.theme, {
				onBranchChange: () => () => {}, getGitBranch: () => "feature/mobile", getExtensionStatuses: () => new Map(),
			}); },
		},
	};
	installFooter(pi, settings);
	events.get("session_start")({}, ctx);
	const editor = editorFactory(tui, themeModule.getEditorTheme(), new keybindingsModule.KeybindingsManager());
	assert.equal(editor.getAutocompleteMaxVisible(), 3);
	const plain = width => footer.render(width).map(tuiModule.stripTerminalSequences);
	assert.equal(plain(80).length, 3);
	assert.match(plain(80)[0], /B: feature\/mobile/);
	assert.match(plain(80)[1], /C: 12.5%.*idle.*M: test-model/);
	pending = true;
	assert.match(plain(80)[1], /queued/);
	await tools.get("set_footer_links").execute("links", { links: [{ label: "ENG-233", url: "https://linear.app/test/issue/ENG-233" }] });
	assert.match(plain(80)[2], /ENG-233/);
	assert.match(footer.render(80)[2], /https:\/\/linear.app/);
	await tools.get("set_task_workspace").execute("workspace", { path: dir });
	assert.match(plain(100)[0], /compact-footer-/);
	for (const width of [0, 1, 2, 8, 20, 40, 100]) {
		assert.equal(plain(width).length, 3);
		for (const line of footer.render(width)) assert.ok(tuiModule.visibleWidth(line) <= width);
	}
	await commands.get("inventory").handler();
	assert.match(plain(100).join("\n"), /MCP: linear/);
	assert.match(plain(100).join("\n"), /inventory to collapse/);
	await commands.get("inventory").handler();
	settings.setFooterCompact(false);
	assert.equal(plain(80).length, 7);
	assert.equal(editor.getAutocompleteMaxVisible(), 6);
	assert.ok(renders > 0 && invalidations > 0);
	settings.setFooterCompact(true);
	assert.equal(plain(80).length, 3);
	editor.setAutocompleteProvider({
		getSuggestions: () => ({ items: Array.from({ length: 10 }, (_, i) => ({ value: `/hello${i}`, label: `/hello${i}` })), prefix: "/" }),
		applyCompletion: () => ({ lines: ["/hello"], cursorLine: 0, cursorCol: 6 }),
	});
	editor.setText("");
	editor.handleInput("/");
	await new Promise(resolve => setTimeout(resolve, 150));
	assert.ok(editor.isShowingAutocomplete());
	editor.render(80);
	assert.equal(editor.renderedAutocompleteHeight, 4, "three native suggestions plus overflow indicator");
	assert.deepEqual(footer.render(80), []);
	settings.setFooterCompact(false);
	editor.render(80);
	assert.equal(editor.getAutocompleteMaxVisible(), 6);
	editor.handleInput("\x1b");
	editor.render(80);
	assert.equal(plain(80).length, 7);
	settings.setFooterCompact(true);
	const beforeShutdown = renders;
	events.get("session_shutdown")({}, ctx);
	settings.applyPreset("desktop");
	assert.equal(renders, beforeShutdown, "shutdown removes live subscribers");
	footer.dispose();
});
