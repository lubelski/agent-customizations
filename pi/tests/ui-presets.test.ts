import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UiSettingsStore, loadUiSettings } from "../lib/ui/settings.ts";
import installCommands from "../lib/ui/commands.ts";

test("presets and individual controls persist concrete settings with atomic notifications", async (t) => {
	const dir = mkdtempSync(join(tmpdir(), "ui-presets-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const path = join(dir, "ui.json");
	const settings = new UiSettingsStore(path);
	settings.reload();
	const commands = new Map();
	const notifications = [];
	const ctx = { mode: "tui", ui: { notify: (...args) => notifications.push(args) } };
	installCommands({ registerCommand: (name, command) => commands.set(name, command) }, settings);
	const run = (name, args = "") => commands.get(name).handler(args, ctx);
	let updates = 0;
	settings.subscribe(() => { updates++; assert.deepEqual(settings.current, loadUiSettings(path)); });
	await run("ui-mobile", "bad argument");
	assert.equal(existsSync(path), false);
	await run("ui-mobile");
	assert.deepEqual(settings.current, { header: { showTopBar: false }, footer: { compact: true }, messages: { layout: "compatible" } });
	assert.equal(updates, 1, "a preset is one write and one live update, not intermediate layouts");
	await run("ui-messages", "unicode");
	await run("ui-compact");
	assert.equal(settings.current.messages.layout, "unicode", "compact does not change font preference");
	await run("ui-desktop");
	assert.deepEqual(settings.current, { header: { showTopBar: true }, footer: { compact: false }, messages: { layout: "compatible" } });
	await run("ui-mobile");
	settings.setHeaderTopBar(true);
	await run("ui-footer", "full");
	await run("ui-footer", "toggle");
	assert.equal(settings.current.header.showTopBar, true, "individual overrides do not revert other preset settings");
	assert.equal(settings.current.footer.compact, true);
	await run("ui-footer", "compact");
	await run("ui-messages", "compatible");
	const resumed = new UiSettingsStore(path);
	resumed.reload();
	assert.deepEqual(resumed.current, settings.current);
	const saved = readFileSync(path, "utf8");
	await run("ui-footer", "invalid");
	await run("ui-messages", "invalid");
	assert.equal(readFileSync(path, "utf8"), saved);
	assert.ok(!saved.includes("preset"));
	const lastGood = settings.current;
	writeFileSync(path, "broken");
	await run("ui-desktop");
	assert.equal(readFileSync(path, "utf8"), "broken");
	assert.equal(settings.current, lastGood);
	assert.equal(notifications.at(-1)[1], "error");
	rmSync(path);
	ctx.mode = "rpc";
	await run("ui-mobile");
	assert.equal(existsSync(path), false, "noninteractive invocations do not change preferences");
});

test("new settings validate types and preserve unknown keys when applying presets", (t) => {
	const dir = mkdtempSync(join(tmpdir(), "ui-presets-config-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const path = join(dir, "ui.json");
	const store = new UiSettingsStore(path);
	for (const value of [{ footer: { compact: "true" } }, { footer: [] }, { messages: { layout: "auto" } }, { messages: null }]) {
		writeFileSync(path, JSON.stringify(value));
		assert.throws(() => loadUiSettings(path));
	}
	writeFileSync(path, JSON.stringify({ other: 1, header: { extra: 2 }, footer: { extra: 3 }, messages: { extra: 4, layout: "unicode" } }));
	store.reload();
	store.applyPreset("compact");
	assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), {
		other: 1, header: { extra: 2, showTopBar: false }, footer: { extra: 3, compact: true }, messages: { extra: 4, layout: "unicode" },
	});
});
