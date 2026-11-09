export type StripTerminalSequences = (line: string) => string;
export type VisibleWidth = (line: string) => number;

export const LEFT_PANEL_EDGE = "▐"; // right half block
export const RIGHT_PANEL_EDGE = "▌"; // left half block
export const BLANK_PANEL_LINE = /^▐ *▌$/u;
export const BLANK_TOOL_RULE_LINE = /^│ *$/u;

/** Compatible panels: one uncolored gap column on each side of the panel, which keeps its own one-column padding. */
export function renderWithGutter(render: (width: number) => string[], width: number): string[] {
	if (width < 3) return render(width);
	return render(width - 2).map(line => {
		// Keep leading OSC markers (e.g. OSC 133 prompt zones) at column 0: terminals
		// that see OSC 133;A mid-line start a fresh line, breaking the panel.
		const marker = /^(?:\x1b\][^\x07\x1b]*(?:\x07|\x1b\\))*/.exec(line)![0];
		return `${marker}\x1b[49m ${line.slice(marker.length)}\x1b[49m `;
	});
}

const LEADING_MARKERS = /^(?:\x1b\][^\x07\x1b]*(?:\x07|\x1b\\))*/;
const LEADING_BACKGROUND = /^\x1b\[48;((?:2;\d+;\d+;\d+)|(?:5;\d+))m/;

/**
 * Square panels with thin caps: within each run of background-filled rows, a
 * blank first or last row becomes a one-third-height bar in the panel color.
 * Side edges stay whole columns; only the top and bottom padding shrink.
 */
export function capPanelRows(lines: string[], strip: StripTerminalSequences, visibleWidth: VisibleWidth): string[] {
	const result = [...lines];
	const background = (line: string) => {
		const marker = LEADING_MARKERS.exec(line)![0];
		return LEADING_BACKGROUND.exec(line.slice(marker.length))?.[1];
	};
	const cap = (index: number, fill: string) => {
		const line = result[index]!;
		const plain = strip(line);
		const color = background(line);
		if (!color || plain.trim() !== "") return;
		const marker = LEADING_MARKERS.exec(line)![0];
		result[index] = `${marker}\x1b[49m\x1b[38;${color}m${fill.repeat(visibleWidth(plain))}\x1b[39m`;
	};
	for (let start = 0; start < result.length;) {
		if (!background(result[start]!)) { start++; continue; }
		let end = start;
		while (end + 1 < result.length && background(result[end + 1]!)) end++;
		if (end > start) {
			cap(start, "🬭");
			cap(end, "🬂");
		}
		start = end + 1;
	}
	return result;
}

export type ThinkingLayout = {
	hasThinking: boolean;
	hasProse: boolean;
	hasToolCall: boolean;
};

export function chamferPanelLine(
	line: string,
	edge: "top" | "bottom",
	strip: StripTerminalSequences,
	visibleWidth: VisibleWidth,
): string {
	const plain = strip(line);
	const left = line.indexOf(LEFT_PANEL_EDGE);
	const right = line.lastIndexOf(RIGHT_PANEL_EDGE);
	if (!BLANK_PANEL_LINE.test(plain) || left < 0 || right <= left) return line;

	const middleWidth = visibleWidth(plain) - 2;
	const fill = edge === "top" ? "🬭" : "🬂";
	const leftCorner = edge === "top" ? "🬞" : "🬁";
	const rightCorner = edge === "top" ? "🬏" : "🬀";
	return line.slice(0, left) + leftCorner + fill.repeat(middleWidth) + rightCorner + line.slice(right + 1);
}

/** Shape only the outer padding rows; blank rows inside Markdown stay intact. */
export function shapePanelCaps(
	lines: string[],
	strip: StripTerminalSequences,
	visibleWidth: VisibleWidth,
): string[] {
	const blankPanelLines: number[] = [];
	for (let index = 0; index < lines.length; index++) {
		if (BLANK_PANEL_LINE.test(strip(lines[index]))) blankPanelLines.push(index);
	}
	if (blankPanelLines.length < 2) return lines;

	const top = blankPanelLines[0];
	const bottom = blankPanelLines.at(-1)!;
	if (top === bottom) return lines;

	const result = [...lines];
	result[top] = chamferPanelLine(result[top], "top", strip, visibleWidth);
	result[bottom] = chamferPanelLine(result[bottom], "bottom", strip, visibleWidth);
	return result;
}

/** Remove Pi's separator and the vertical rule's box padding, not tool content. */
export function trimToolRulePadding(lines: string[], strip: StripTerminalSequences): string[] {
	let start = 0;
	let end = lines.length;

	if (strip(lines[start] ?? "").trim() === "") start++;
	if (end > start && BLANK_TOOL_RULE_LINE.test(strip(lines[start] ?? ""))) start++;
	if (end > start && BLANK_TOOL_RULE_LINE.test(strip(lines[end - 1] ?? ""))) end--;
	return start === 0 && end === lines.length ? lines : lines.slice(start, end);
}

/**
 * Pi omits the spacer between an assistant message and the separately rendered
 * tools that follow it. Add exactly one so every message/tool boundary has one gap row.
 */
export function stabilizeThinkingToolSpacing(lines: string[], layout: ThinkingLayout): string[] {
	if (!(layout.hasThinking || layout.hasProse) || !layout.hasToolCall) return lines;
	if (lines.length === 0 || lines.at(-1)?.trim() === "") return lines;
	return [...lines, ""];
}
