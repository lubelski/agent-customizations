import assert from "node:assert/strict";
import { test } from "node:test";
import { jiti, tuiModule } from "./pi-runtime.ts";

const { collapsePanelGaps, installGapCollapse } = await jiti.import("../lib/ui/messages/gaps.ts");
const top = " 🬭🬭🬭 ", bottom = " 🬂🬂🬂 ";

test("blank rows between abutting panels collapse only across component edges", () => {
	const parts = [[top, " a   ", bottom], [""], ["  ", top, " b   ", bottom, ""], ["› tool"], ["", top, " c   ", bottom]];
	assert.deepEqual(collapsePanelGaps(parts), [0, 1, 1, 0, 0]);
	assert.deepEqual(parts, [[top, " a   ", bottom], [], [top, " b   ", bottom, ""], ["› tool"], ["", top, " c   ", bottom]],
		"gaps next to non-panel rows stay");
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
