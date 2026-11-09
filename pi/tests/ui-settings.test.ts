import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { UiSettingsStore, loadUiSettings, saveUiSettings, messageLayout } from "../lib/ui/settings.ts";

test("UI preferences default off, preserve unrelated keys, and reject malformed files", (t) => {
	const dir = mkdtempSync(join(tmpdir(), "ui-config-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const path = join(dir, "nested", "ui.json");
	assert.deepEqual(loadUiSettings(path), { compactHeader: false, compactFooter: false, fontCompat: false });
	assert.equal(existsSync(path), false);
	saveUiSettings(path, { compactHeader: true });
	assert.equal(loadUiSettings(path).compactHeader, true);
	writeFileSync(path, JSON.stringify({ other: 1, header: { showTopBar: false }, fontCompat: true }));
	assert.deepEqual(loadUiSettings(path), { compactHeader: false, compactFooter: false, fontCompat: true }, "old nested keys are ignored");
	saveUiSettings(path, { compactFooter: true });
	assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), { other: 1, header: { showTopBar: false }, fontCompat: true, compactFooter: true });
	assert.deepEqual(readdirSync(dirname(path)), ["ui.json"]);
	writeFileSync(path, '{"fontCompat":"true"}');
	assert.throws(() => loadUiSettings(path), /boolean/);
	for (const invalid of ["broken", "null", "[]", "42", '{"fontCompat":null}']) {
		writeFileSync(path, invalid);
		assert.throws(() => loadUiSettings(path));
		assert.throws(() => saveUiSettings(path, { compactHeader: false }));
		assert.equal(readFileSync(path, "utf8"), invalid);
	}
	assert.equal(messageLayout({ compactHeader: false, compactFooter: false, fontCompat: false }), "unicode");
	assert.equal(messageLayout({ compactHeader: false, compactFooter: false, fontCompat: true }), "compatible");
});

test("UI settings publish successful changes only, reload across instances, and unsubscribe", (t) => {
	const dir = mkdtempSync(join(tmpdir(), "ui-store-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const path = join(dir, "ui.json");
	const store = new UiSettingsStore(path);
	store.reload();
	let changes = 0;
	const unsubscribe = store.subscribe(() => { changes++; });
	assert.equal(store.toggle("compactHeader"), true);
	assert.equal(changes, 1);
	const next = new UiSettingsStore(path);
	next.reload();
	assert.equal(next.current.compactHeader, true);
	writeFileSync(path, "broken");
	assert.throws(() => store.toggle("compactHeader"));
	assert.equal(changes, 1);
	assert.equal(store.current.compactHeader, true);
	assert.throws(() => next.reload());
	assert.equal(next.current.compactHeader, false, "invalid settings fall back to defaults");
	rmSync(path);
	unsubscribe();
	store.toggle("compactHeader");
	assert.equal(changes, 1);
});
