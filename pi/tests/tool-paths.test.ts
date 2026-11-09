import assert from "node:assert/strict";
import test from "node:test";
import { jiti, tuiModule } from "./pi-runtime.ts";

test("tool paths shorten home, preserve both ends, and mark only substitutions", async () => {
	const { compactPath } = await jiti.import("../lib/ui/tool-paths.ts");
	const mark = text => "<accent>" + text + "</accent>";
	assert.equal(compactPath("/Users/me/src/a.ts", "/Users/me", 80, mark), "<accent>~</accent>/src/a.ts");
	assert.equal(compactPath("~/a.ts", "/Users/me", 80, mark), "~/a.ts");
	assert.equal(compactPath("/Users/me-other/a.ts", "/Users/me", 80, mark), "/Users/me-other/a.ts");
	assert.equal(compactPath("/Users/me", "/Users/me", 80, mark), "<accent>~</accent>");
	const fitted = compactPath("/Users/me/very/long/directory/file.ts", "/Users/me", 18);
	assert.ok(fitted.startsWith("~/"));
	assert.ok(fitted.includes("…"));
	assert.ok(fitted.endsWith("file.ts"));
	for (let width = 0; width < 30; width++) {
		assert.ok(tuiModule.visibleWidth(compactPath("/Users/me/日本語/long/file.ts", "/Users/me", width)) <= width);
	}
});
