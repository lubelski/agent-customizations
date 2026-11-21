import { copyToClipboard } from "@earendil-works/pi-coding-agent";
import { Markdown, sliceByColumn, TuiAltScreen, visibleWidth } from "@earendil-works/pi-tui";
import { clearCodeCopyHover } from "../../code-copy.ts";

/**
 * Per-panel copy target, as in the Claude message-panels mod: four cells of a
 * panel's top edge, ending one cell short of the fill's last column. At rest
 * they draw as the edge does; under the pointer they read COPY, and a click
 * copies the panel's text as written (Markdown, no panel glyphs).
 *
 * Panels sit inside a one-column gutter, so mouse x is one more than the
 * panel's own column and the event width two more than its own width.
 */
export const COPY_LABEL = "COPY";
const COPY_INSET = 1;
const GUTTER = 1;

let hovered: WeakRef<object> | undefined;
let notify: ((message: string, type?: "info" | "error") => void) | undefined;
let clipboard: (text: string) => Promise<void> = copyToClipboard;

/** Tests substitute the clipboard so running them does not overwrite it. */
export function setClipboard(write: typeof clipboard): void { clipboard = write; }

export function setCopyNotifier(callback: typeof notify): void { notify = callback; }

/** Columns of the copy cells within a panel `width` wide, or undefined when too narrow. */
export function copyColumns(width: number): [number, number] | undefined {
	const end = width - COPY_INSET; // exclusive: one fill cell shows past the label
	const start = end - COPY_LABEL.length;
	return start >= 1 ? [start, end] : undefined;
}

/** Container mouse routing calls this on every pointer move, before children may re-claim hover. */
export function clearCopyHover(): boolean {
	const had = hovered?.deref() !== undefined;
	hovered = undefined;
	return clearCodeCopyHover() || had;
}

const PANEL_COLOR = /\x1b\[(?:38|48);((?:2;\d+;\d+;\d+)|(?:5;\d+))m/;

/** Overlay COPY on the top row while hovered. The label sits on the panel color. */
export function decorateCopy(lines: string[], owner: object): string[] {
	if (hovered?.deref() !== owner || !lines.length) return lines;
	const top = lines[0]!;
	const width = visibleWidth(top);
	const columns = copyColumns(width);
	const color = PANEL_COLOR.exec(top)?.[1];
	if (!columns || !color) return lines;
	const [start, end] = columns;
	const label = `\x1b[0m\x1b[1;48;${color}m${COPY_LABEL}\x1b[0m`;
	return [sliceByColumn(top, 0, start) + label + sliceByColumn(top, end, width - end), ...lines.slice(1)];
}

type PanelMouse = { type: string; button?: string; x: number; y: number; width: number };

/** Hover and click handling for one panel's copy cells; `text` is read at click time. */
export function copyMouse(owner: object, text: () => string, event: PanelMouse): { handled: true; render?: boolean } | undefined {
	if (event.y !== 0) return undefined;
	const columns = copyColumns(event.width - 2 * GUTTER);
	const x = event.x - GUTTER;
	if (!columns || x < columns[0] || x >= columns[1]) return undefined;
	if (event.type === "move") {
		hovered = new WeakRef(owner);
		// Pi redraws after a move only when asked to.
		return { handled: true, render: true };
	}
	if (event.type !== "click" || event.button !== "left") return event.type === "press" ? { handled: true } : undefined;
	void clipboard(text()).then(() => notify?.("Copied", "info"), () => notify?.("Could not copy message", "error"));
	return { handled: true };
}

/**
 * A panel's own mouse handler shadows Markdown.prototype.handleMouse, which
 * holds the code-block copy cells. Pass what the panel's cells do not take on
 * to it, in the Markdown's own columns (inside the gutter).
 */
export function panelMouse(owner: object, text: () => string, event: PanelMouse): unknown {
	const handled = copyMouse(owner, text, event);
	if (handled) return handled;
	const fallback = (Markdown.prototype as unknown as { handleMouse?: (event: PanelMouse) => unknown }).handleMouse;
	return fallback?.call(owner, { ...event, x: event.x - GUTTER, width: event.width - 2 * GUTTER });
}

const ORIGINAL_MOUSE_EVENT = Symbol.for("will.pi.copy-hover.original-mouse-event");
type MouseRouter = { handleMouseEvent(raw: { button: number; release?: boolean }): void; requestRender(): void };

/**
 * Hover has no leave event, and Pi's layout dispatch skips containers, so the
 * container-level clear in gaps.ts never sees live pointer moves. Clear hover
 * on every pointer move at the screen level instead; the copy cells under the
 * pointer re-claim it during dispatch. Redraw when a label may have gone away.
 */
export function installHoverRouting(): void {
	const target = TuiAltScreen.prototype as unknown as MouseRouter & Record<PropertyKey, unknown>;
	if (typeof target.handleMouseEvent !== "function") return;
	const original = (target[ORIGINAL_MOUSE_EVENT] ??= target.handleMouseEvent) as MouseRouter["handleMouseEvent"];
	target.handleMouseEvent = function (this: MouseRouter, raw) {
		// Motion with no button held (button code 3, motion flag 32).
		const move = !raw.release && (raw.button & 32) !== 0 && (raw.button & 3) === 3;
		const had = move && clearCopyHover();
		original.call(this, raw);
		if (had) this.requestRender();
	};
}
