import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const transcripts = new Map();
for (const order of ["ui-first", "legacy-first"]) {
	test(`presentation ownership prevents mixed and duplicate loading: ${order}, including reload`, (t) => {
		const dir = mkdtempSync(join(tmpdir(), "ui-owner-"));
		t.after(() => rmSync(dir, { recursive: true, force: true }));
		const output = execFileSync(process.execPath, [fileURLToPath(new URL("./ui-entrypoint-probe.ts", import.meta.url)), order], {
			env: { ...process.env, PI_CODING_AGENT_DIR: dir }, encoding: "utf8", timeout: 30_000,
		});
		const result = JSON.parse(output);
		assert.equal(result.mode, order);
		transcripts.set(order, result.transcript);
	});
}

test("unified and legacy entry points render the same default transcript", () => {
	assert.ok(transcripts.has("ui-first") && transcripts.has("legacy-first"));
	assert.deepEqual(transcripts.get("ui-first"), transcripts.get("legacy-first"));
});

test("package exposes only UI and rename, preserving package identity and theme", () => {
	const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
	assert.equal(manifest.name, "pi-customizations");
	assert.deepEqual(manifest.pi.extensions, ["./extensions/ui.ts", "./extensions/session-rename.ts"]);
	assert.deepEqual(manifest.pi.themes, ["./themes/*.json"]);
});
