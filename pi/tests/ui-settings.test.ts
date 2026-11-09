import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { UiSettingsStore, loadUiSettings, saveHeaderTopBar } from "../lib/ui/settings.ts";

test("UI preferences default safely, preserve unrelated keys, and reject malformed files", (t) => {
	const dir = mkdtempSync(join(tmpdir(), "ui-config-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const path = join(dir, "nested", "ui.json");
	assert.deepEqual(loadUiSettings(path), { header: { showTopBar: true }, footer: { compact: false }, messages: { layout: "compatible" } });
	assert.equal(existsSync(path), false);
	saveHeaderTopBar(path, false);
	assert.equal(loadUiSettings(path).header.showTopBar, false);
	writeFileSync(path, JSON.stringify({ footer: { compact: true }, header: { other: true, showTopBar: false } }));
	saveHeaderTopBar(path, true);
	assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { footer: { compact: true }, header: { other: true, showTopBar: true } });
	assert.deepEqual(readdirSync(dirname(path)), ["ui.json"]);
	writeFileSync(path, "{}");
	assert.equal(loadUiSettings(path).header.showTopBar, true);
	writeFileSync(path, '{"header":{"showTopBar":"false"}}');
	assert.throws(() => loadUiSettings(path), /boolean/);
	for (const invalid of ["broken", "null", "[]", "42", '{"header":null}', '{"header":[]}']) {
		writeFileSync(path, invalid);
		assert.throws(() => loadUiSettings(path));
		assert.throws(() => saveHeaderTopBar(path, false));
		assert.equal(readFileSync(path, "utf8"), invalid);
	}
});

test("UI settings publish successful changes only, reload across instances, and unsubscribe", (t) => {
	const dir = mkdtempSync(join(tmpdir(), "ui-store-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const path = join(dir, "ui.json");
	const store = new UiSettingsStore(path);
	store.reload();
	let changes = 0;
	const unsubscribe = store.subscribe(() => { changes++; });
	store.setHeaderTopBar(false);
	assert.equal(changes, 1);
	assert.equal(store.current.header.showTopBar, false);
	const next = new UiSettingsStore(path);
	next.reload();
	assert.equal(next.current.header.showTopBar, false);
	writeFileSync(path, "broken");
	assert.throws(() => store.setHeaderTopBar(true));
	assert.equal(changes, 1);
	assert.equal(store.current.header.showTopBar, false);
	assert.throws(() => next.reload());
	assert.equal(next.current.header.showTopBar, true, "invalid settings fall back to defaults");
	rmSync(path);
	unsubscribe();
	store.setHeaderTopBar(true);
	assert.equal(changes, 1);
});
