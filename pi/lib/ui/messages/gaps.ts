import { Container, stripTerminalSequences } from "@earendil-works/pi-tui";

/**
 * With thin caps, a panel's bottom cap already separates it from the next
 * panel's top cap, so the blank gap rows between them are redundant. Pi joins
 * transcript components in a Container that also records child heights for
 * mouse hit-testing, so rows are removed per child and clicks are offset to match.
 * Only rows at a child's edges (or wholly blank children) are removed, so each
 * child's own row mapping shifts by at most its leading-row count.
 */

// Caps may or may not have the gutter yet: Containers inside a message see them before it is added.
const BOTTOM_CAP = /^ ?🬂+ ?$/u;
const TOP_CAP = /^ ?🬭+ ?$/u;
/** Invisible SGR prefix on folded-thinking rows, so they can abut panels too. */
export const THINKING_MARK = "\x1b[23;23m";
const ORIGINAL_RENDER = Symbol.for("will.pi.ui.container.original-render");
const ORIGINAL_MOUSE = Symbol.for("will.pi.ui.container.original-mouse");

type Child = { render(width: number): string[]; handleMouse?: (event: MouseEvent) => unknown; [key: string]: unknown };
type MouseEvent = { y: number; height: number; width: number; [key: string]: unknown };
type Layout = { width: number; children: { component: Child; height: number }[] };
type Patched = { children: Child[]; mouseLayout?: Layout; handleInput?: unknown };

const isBottomCap = (line: string) => line.includes("🬂") && BOTTOM_CAP.test(stripTerminalSequences(line));
const isTopCap = (line: string) => line.includes("🬭") && TOP_CAP.test(stripTerminalSequences(line));
const isThinking = (line: string) => line.includes(THINKING_MARK);
const isBlank = (line: string) => stripTerminalSequences(line).trim() === "";

/**
 * Remove blank rows between a bottom cap and the next top cap, or between
 * thinking and a cap; returns rows removed from each part's start.
 */
export function collapsePanelGaps(parts: string[][]): number[] {
	const skips = parts.map(() => 0);
	let capPart = -1;
	let afterThinking = false;
	let pending: [number, number][] = [];
	for (let part = 0; part < parts.length; part++) {
		const lines = parts[part]!;
		for (let row = 0; row < lines.length; row++) {
			const line = lines[row]!;
			if (capPart >= 0 && isBlank(line)) { pending.push([part, row]); continue; }
			// Gaps inside one component would shift its own mouse rows; leave them.
			const abuts = isTopCap(line) || (!afterThinking && isThinking(line));
			if (pending.length && part !== capPart && abuts) {
				for (const [p, r] of [...pending].reverse()) parts[p]!.splice(r, 1);
				for (const [p] of pending) if (p !== capPart) skips[p]!++;
				row -= pending.filter(([p]) => p === part).length;
			}
			pending = [];
			afterThinking = isThinking(line);
			capPart = isBottomCap(line) || afterThinking ? part : -1;
		}
	}
	return skips;
}

/** Install once; active only while `enabled()` (thin caps). Reload-safe. */
export function installGapCollapse(enabled: () => boolean): void {
	const target = Container.prototype as unknown as Patched & Record<PropertyKey, unknown>;
	const render = (target[ORIGINAL_RENDER] ??= target.render) as (this: Patched, width: number) => string[];
	const mouse = (target[ORIGINAL_MOUSE] ??= target.handleMouse) as (this: Patched, event: MouseEvent) => unknown;
	const collapsed = new WeakMap<object, Collapsed>();
	target.render = function (this: Patched, width: number): string[] {
		collapsed.delete(this);
		if (!enabled()) return render.call(this, width);
		const parts = this.children.map(child => child.render(width).slice());
		const full = parts.map(lines => lines.length);
		const skips = collapsePanelGaps(parts);
		this.mouseLayout = { width, children: this.children.map((component, i) => ({ component, height: full[i]! })) };
		if (parts.some((lines, i) => lines.length !== full[i])) collapsed.set(this, { width, full, shown: parts.map(lines => lines.length), skips });
		return parts.flat();
	};
	// Pi hit-tests children by the heights recorded above (uncollapsed), so map
	// the click from collapsed rows back to uncollapsed ones and let Pi dispatch.
	target.handleMouse = function (this: Patched, event: MouseEvent): unknown {
		const layout = collapsed.get(this);
		if (!layout || layout.width !== event.width) return mouse.call(this, event);
		if (event.y < 0 || event.y >= event.height) return undefined;
		let shownY = 0, fullY = 0;
		for (let i = 0; i < layout.full.length; i++) {
			if (event.y < shownY + layout.shown[i]!) {
				const height = layout.full.reduce((sum, rows) => sum + rows, 0);
				return mouse.call(this, { ...event, y: fullY + layout.skips[i]! + event.y - shownY, height });
			}
			shownY += layout.shown[i]!;
			fullY += layout.full[i]!;
		}
		return undefined;
	};
}

type Collapsed = { width: number; full: number[]; shown: number[]; skips: number[] };
