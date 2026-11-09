import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const transcripts = new Map();
for (const order of ["ui-first", "legacy-first"]) {
	test(`presentation ownership prevents mixed and duplicate loading: ${order}, including reload`, (t) => {
		const dir = mkdtempSync(join(tmpdir(), "ui-owner-"));
		t.after(() => rmSync(dir, { recursive: true, force: true }));
		writeFileSync(join(dir, "ui.json"), JSON.stringify({}));
		const output = execFileSync(process.execPath, [fileURLToPath(new URL("./ui-entrypoint-probe.ts", import.meta.url)), order], {
			env: { ...process.env, PI_CODING_AGENT_DIR: dir }, encoding: "utf8", timeout: 30_000,
		});
		const result = JSON.parse(output);
		assert.equal(result.mode, order);
		transcripts.set(order, result.transcript);
	});
}

test("unified panels have whole-column sides and thin caps; legacy keeps half-block edges", () => {
	assert.ok(transcripts.has("ui-first") && transcripts.has("legacy-first"));
	const ui = transcripts.get("ui-first").flat();
	const legacy = transcripts.get("legacy-first").flat();
	assert.doesNotMatch(ui.join("\n"), /[▐▌🬞🬏🬁🬀]/u, "no half-block sides or chamfered corners");
	assert.ok(ui.filter(line => /^ 🬭+ $/u.test(line)).length >= 2, "top caps sit inside one gap column");
	assert.ok(ui.filter(line => /^ 🬂+ $/u.test(line)).length >= 2);
	assert.ok(ui.some(line => line.startsWith("  A prompt")), "gap column, then padding column");
	assert.ok(legacy.some(line => line.startsWith("▐")));
});

test("package exposes only UI and rename, preserving package identity and theme", () => {
	const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
	assert.equal(manifest.name, "pi-customizations");
	assert.deepEqual(manifest.pi.extensions, ["./extensions/ui.ts", "./extensions/session-rename.ts"]);
	assert.deepEqual(manifest.pi.themes, ["./themes/*.json"]);
});
