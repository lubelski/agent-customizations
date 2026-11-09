import assert from "node:assert/strict";
import test from "node:test";
import {
	capPanelRows,
	chamferPanelLine,
	shapePanelCaps,
	stabilizeThinkingToolSpacing,
	trimToolRulePadding,
} from "../lib/transcript-layout.ts";

const identity = (line: string): string => line;
const codePointWidth = (line: string): number => [...line].length;

test("assistant panel gets fractional top and bottom caps", () => {
	const lines = ["▐      ▌", "▐ prose ▌", "▐      ▌"];
	assert.deepEqual(shapePanelCaps(lines, identity, codePointWidth), [
		"🬞🬭🬭🬭🬭🬭🬭🬏",
		"▐ prose ▌",
		"🬁🬂🬂🬂🬂🬂🬂🬀",
	]);
});

test("blank Markdown rows inside a panel are not mistaken for caps", () => {
	const lines = ["▐     ▌", "▐ one ▌", "▐     ▌", "▐ two ▌", "▐     ▌"];
	const shaped = shapePanelCaps(lines, identity, codePointWidth);
	assert.equal(shaped[2], "▐     ▌");
	assert.match(shaped[0], /^🬞/u);
	assert.match(shaped[4], /^🬁/u);
});

test("non-panel rows are left untouched", () => {
	const line = "Thinking...";
	assert.equal(chamferPanelLine(line, "top", identity, codePointWidth), line);
	assert.deepEqual(shapePanelCaps(["", line], identity, codePointWidth), ["", line]);
});

test("thinking followed directly by a tool gets one stable separator", () => {
	const lines = ["", "Thinking..."];
	const layout = { hasThinking: true, hasProse: false, hasToolCall: true };
	assert.deepEqual(stabilizeThinkingToolSpacing(lines, layout), ["", "Thinking...", ""]);
	assert.deepEqual(stabilizeThinkingToolSpacing(["", "Thinking...", ""], layout), ["", "Thinking...", ""]);
});

test("prose followed by a tool also gets one separator, but never two", () => {
	const lines = ["", "🬞🬭🬭🬏", "▐ ok ▌", "🬁🬂🬂🬀"];
	const layout = { hasThinking: false, hasProse: true, hasToolCall: true };
	const spaced = stabilizeThinkingToolSpacing(lines, layout);
	assert.deepEqual(spaced, [...lines, ""]);
	assert.equal(stabilizeThinkingToolSpacing(spaced, layout), spaced);
});

test("thinking without a following tool is left alone", () => {
	const lines = ["", "Thinking..."];
	assert.equal(stabilizeThinkingToolSpacing(lines, {
		hasThinking: true,
		hasProse: false,
		hasToolCall: false,
	}), lines);
});

test("tool rules stop at content and Pi's pre-tool separator is removed", () => {
	const lines = ["", "│       ", "│ read  ", "│ done  ", "│       "];
	assert.deepEqual(trimToolRulePadding(lines, identity), ["│ read  ", "│ done  "]);
});

test("blank rows inside tool output remain intact", () => {
	const lines = ["", "│       ", "│ call  ", "│       ", "│ tail  ", "│       "];
	assert.deepEqual(trimToolRulePadding(lines, identity), [
		"│ call  ",
		"│       ",
		"│ tail  ",
	]);
});

test("square panels: blank outer rows of each background run become thin caps", () => {
	const bg = "\x1b[48;2;1;2;3m";
	const strip = (line: string) => line.replace(/\x1b\[[0-9;]*m|\x1b\][^\x07]*\x07/g, "");
	const lines = [`\x1b]133;A\x07${bg}    \x1b[49m`, `${bg} hi \x1b[49m`, `${bg}    \x1b[49m`, "plain", `${bg}    \x1b[49m`, `${bg} x  \x1b[49m`];
	const capped = capPanelRows(lines, strip, codePointWidth);
	assert.equal(capped[0], "\x1b]133;A\x07\x1b[49m\x1b[38;2;1;2;3m🬭🬭🬭🬭\x1b[39m", "OSC markers stay at column 0");
	assert.equal(capped[1], lines[1]);
	assert.equal(strip(capped[2]), "🬂🬂🬂🬂");
	assert.equal(capped[3], "plain");
	assert.equal(strip(capped[4]), "🬭🬭🬭🬭");
	assert.equal(capped[5], lines[5], "a non-blank last row is not capped");
});
