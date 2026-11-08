import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UiSettingsStore, loadUiSettings } from "../lib/ui/settings.ts";

import { jiti, themeModule, layoutModule, tuiModule } from "./pi-runtime.ts";

test("title bar reserves a title between matching divider rows and restores the layout on reload", async (t) => {
	const dir = mkdtempSync(join(tmpdir(), "header-settings-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const settingsPath = join(dir, "ui.json");
	const { default: installHeader, renderTitleBanner } = await jiti.import("../lib/ui/header.ts");
	const extension = (api) => {
		const settings = new UiSettingsStore(settingsPath);
		settings.reload();
		installHeader(api, settings);
	};
	const { getThemeByName } = themeModule;
	const { renderLayoutFrame } = layoutModule;
	const { stripTerminalSequences, visibleWidth } = tuiModule;
	const theme = getThemeByName("dark");
	const handlers = new Map();
	const commands = new Map();
	const api = { on: (name, handler) => handlers.set(name, handler), registerCommand: (name, command) => commands.set(name, command) };
	extension(api);
	const original = { render: () => ["conversation"], invalidate() {} };
	const tui = { layoutRoot: original, setLayoutRoot(root) { this.layoutRoot = root; }, requestRender() {} };
	let widget;
	let title = "First title";
	const ctx = {
		mode: "tui",
		sessionManager: { getSessionName: () => title, getCwd: () => "/project" },
		getContextUsage: () => ({ tokens: 29000, contextWindow: 272000, percent: 10.7 }),
		ui: {
			setWidget(_key, factory) { widget?.dispose?.(); widget = factory?.(tui, theme); },
			notify() { assert.fail("Unexpected unsupported-layout warning"); },
		},
	};
	for (let reload = 0; reload < 3; reload++) {
		handlers.get("session_start")({}, ctx);
		assert.notEqual(tui.layoutRoot, original);
		assert.deepEqual(widget.render(80), []);
		for (const width of [1, 6, 20, 80]) {
			const frame = renderLayoutFrame(tui.layoutRoot, width, 24, () => {});
			assert.equal(visibleWidth(frame.lines[0]), width);
			assert.equal(frame.lines[1], renderTitleBanner(title, width, theme, "/project", "29k / 272k - 10.7%")[1]);
			assert.equal(frame.lines.length, 24);
			assert.equal(stripTerminalSequences(frame.lines[0]), "─".repeat(width));
			assert.equal(frame.lines[0], frame.lines[2]);
			if (width >= 20) assert.match(stripTerminalSequences(frame.lines[3]), /conversation/);
		}
		title = "Renamed";
		handlers.get("session_info_changed")();
		assert.match(stripTerminalSequences(renderLayoutFrame(tui.layoutRoot, 80, 24, () => {}).lines[1]), /Renamed/);
		handlers.get("session_shutdown")({}, ctx);
		assert.equal(tui.layoutRoot, original);
	}
	for (const name of ["dark", "light"]) {
		const themed = getThemeByName(name);
		const lines = renderTitleBanner("Title", 20, themed);
		assert.equal(stripTerminalSequences(lines[1]), "       Title        ");
		assert.equal(stripTerminalSequences(lines[0]), "─".repeat(20));
		assert.equal(lines[0], lines[2]);
	}

	const fallback = stripTerminalSequences(renderTitleBanner(undefined, 80, theme, "/project")[1]);
	assert.ok(fallback.includes("/project"));
	assert.ok(!fallback.includes("Untitled"));
	assert.equal(fallback.slice(Math.floor((80 - 8) / 2), Math.floor((80 - 8) / 2) + 8), "/project");

	const decorated = stripTerminalSequences(renderTitleBanner("Title", 80, theme, "/a/very/long/directory/with/a/project", "24k / 200k tok")[1]);
	assert.equal(visibleWidth(decorated), 80);
	assert.equal(decorated.indexOf("Title"), Math.floor((80 - 5) / 2));
	assert.match(decorated, /^  \/a\/.*\.\..*project/);
	assert.ok(decorated.endsWith("24k / 200k tok  "));
	for (const width of [1, 5, 12, 20, 40]) {
		const plain = stripTerminalSequences(renderTitleBanner("An important title", width, theme)[1]);
		const withSides = stripTerminalSequences(renderTitleBanner("An important title", width, theme, "/日本語/long/directory", "24k / 200k tok")[1]);
		assert.equal(visibleWidth(withSides), width);
		assert.equal(visibleWidth(withSides.slice(0, withSides.indexOf(plain.trim()))), visibleWidth(plain.slice(0, plain.indexOf(plain.trim()))));
	}

	// Toggle changes both rendering and layout allocation, and a fresh extension loads the saved preference.
	ctx.ui.notify = () => {};
	handlers.get("session_start")({}, ctx);
	const command = commands.get("header-bar");
	assert.deepEqual(command.getArgumentCompletions("o").map((item) => item.value), ["on", "off"]);
	assert.equal(command.getArgumentCompletions("bad"), null);
	await command.handler("off", ctx);
	assert.equal(JSON.parse(readFileSync(settingsPath, "utf8")).header.showTopBar, false);
	for (const width of [1, 6, 20, 80]) {
		const frame = renderLayoutFrame(tui.layoutRoot, width, 24, () => {});
		assert.equal(frame.lines[0], renderTitleBanner(title, width, theme, "/project", "29k / 272k - 10.7%", false)[0]);
		assert.match(stripTerminalSequences(frame.lines[2]), /conversation/);
	}
	handlers.get("session_shutdown")({}, ctx);
	extension(api);
	handlers.get("session_start")({}, ctx);
	assert.match(stripTerminalSequences(renderLayoutFrame(tui.layoutRoot, 80, 24, () => {}).lines[0]), /Renamed/);
	await commands.get("header-bar").handler("", ctx);
	assert.equal(loadUiSettings(settingsPath).header.showTopBar, true);
	await commands.get("header-bar").handler("off", ctx);
	await commands.get("header-bar").handler("on", ctx);
	await commands.get("header-bar").handler("invalid", ctx);
	assert.equal(loadUiSettings(settingsPath).header.showTopBar, true);
	// Failed saves leave the active layout unchanged and preserve the bad file.
	writeFileSync(settingsPath, "broken");
	await commands.get("header-bar").handler("off", ctx);
	assert.equal(stripTerminalSequences(renderLayoutFrame(tui.layoutRoot, 80, 24, () => {}).lines[0]), "─".repeat(80));
	handlers.get("session_shutdown")({}, ctx);
	rmSync(settingsPath);

	let warned = false;
	ctx.ui.notify = () => { warned = true; };
	tui.layoutRoot = undefined;
	handlers.get("session_start")({}, ctx);
	assert.ok(warned);
	assert.deepEqual(widget.render(80), []);
	handlers.get("session_shutdown")({}, ctx);
	assert.equal(tui.layoutRoot, undefined);

	for (const width of [0, 1, 2, 5, 6, 20, 80]) {
		for (const title of [undefined, "日本語 🎉", "\x1b[31mred\ntext"]) {
			for (const showTopBar of [true, false]) {
				const lines = renderTitleBanner(title, width, theme, "", "", showTopBar);
				assert.equal(lines.length, width ? (showTopBar ? 3 : 2) : 0);
				for (const line of lines) assert.equal(visibleWidth(line), width);
			}
		}
	}
});
