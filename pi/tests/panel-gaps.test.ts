import assert from "node:assert/strict";
import { test } from "node:test";
import { jiti, tuiModule } from "./pi-runtime.ts";

const { collapsePanelGaps, installGapCollapse, THINKING_MARK } = await jiti.import("../lib/ui/messages/gaps.ts");
const top = " 🬭🬭🬭 ", bottom = " 🬂🬂🬂 ";

test("blank rows between abutting panels collapse only across component edges", () => {
	const parts = [[top, " a   ", bottom], [""], ["  ", top, " b   ", bottom, ""], ["› tool"], ["", top, " c   ", bottom]];
	assert.deepEqual(collapsePanelGaps(parts), [0, 1, 1, 0, 1]);
	assert.deepEqual(parts, [[top, " a   ", bottom], [], [top, " b   ", bottom], ["› tool"], [top, " c   ", bottom]],
		"a cap separates a panel from anything next to it");
	const plain = [["› tool"], [""], ["› other"], [""], ["text"]];
	collapsePanelGaps(plain);
	assert.deepEqual(plain, [["› tool"], [""], ["› other"], [""], ["text"]], "gaps between non-panel rows stay");
	const inside = [[top, " a   ", bottom, "", top, " b   ", bottom]];
	assert.deepEqual(collapsePanelGaps(inside), [0]);
	assert.equal(inside[0].length, 7, "gaps inside one component are left alone");
});

test("container collapse keeps mouse rows aligned and is switchable", () => {
	let enabled = true;
	installGapCollapse(() => enabled);
	const clicks = [];
	const child = (lines, name) => ({ render: () => lines, handleMouse: event => { clicks.push([name, event.y]); return { handled: true }; } });
	const container = new tuiModule.Container();
	container.addChild(child([top, " a   ", bottom], "a"));
	container.addChild(child([""], "spacer"));
	container.addChild(child(["", top, " b   ", bottom], "b"));
	const lines = container.render(5);
	assert.deepEqual(lines, [top, " a   ", bottom, top, " b   ", bottom]);
	container.handleMouse({ type: "click", button: "left", x: 1, y: 4, width: 5, height: lines.length });
	assert.deepEqual(clicks.at(-1), ["b", 2], "row 4 is b's own row 2 once its leading gap is restored");
	container.handleMouse({ type: "click", button: "left", x: 1, y: 1, width: 5, height: lines.length });
	assert.deepEqual(clicks.at(-1), ["a", 1]);
	enabled = false;
	assert.equal(container.render(5).length, 8);
	installGapCollapse(() => enabled);
	assert.equal(container.render(5).length, 8, "reinstall does not stack");
});

test("thinking rows abut panels on either side, but keep gaps from each other and tools", () => {
	const think = `${THINKING_MARK}  hmm`;
	const parts = [[top, " a   ", bottom], [""], [think, think], [""], [top, " b   ", bottom], ["", think], [""], [think], ["", "› tool"]];
	collapsePanelGaps(parts);
	assert.deepEqual(parts, [[top, " a   ", bottom], [], [think, think], [], [top, " b   ", bottom], [think], [""], [think], ["", "› tool"]],
		"thinking without a cap keeps its gap from other thinking and tools");
	// Caps before the message gutter is added (inside the message's own container).
	const inner = [["🬂🬂🬂"], [""], ["🬭🬭🬭"]];
	collapsePanelGaps(inner);
	assert.deepEqual(inner, [["🬂🬂🬂"], [], ["🬭🬭🬭"]]);
});

test("Pi's transcript notices are indented one more column, in both modes", async () => {
	let enabled = false;
	installGapCollapse(() => enabled);
	class ThemedText extends tuiModule.Text {}
	const container = new tuiModule.Container();
	container.addChild(new ThemedText("Reloaded keybindings", 1, 0));
	container.addChild(new tuiModule.Text("other text", 1, 0));
	container.addChild(new ThemedText("unpadded", 0, 0));
	for (const mode of [false, true]) {
		enabled = mode;
		const lines = container.render(30).map(tuiModule.stripTerminalSequences);
		assert.ok(lines[0].startsWith("  Reloaded"));
		assert.ok(lines[1].startsWith(" other"), "only Pi's ThemedText notices move");
		assert.ok(lines[2].startsWith("unpadded"));
		assert.ok(container.render(30).every(line => tuiModule.visibleWidth(line) <= 30));
	}
});
