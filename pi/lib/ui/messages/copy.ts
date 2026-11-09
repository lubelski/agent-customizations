import { copyToClipboard } from "@earendil-works/pi-coding-agent";
import { sliceByColumn, visibleWidth } from "@earendil-works/pi-tui";

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
	return had;
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
export function copyMouse(owner: object, text: () => string, event: PanelMouse): { handled: true } | undefined {
	if (event.y !== 0) return undefined;
	const columns = copyColumns(event.width - 2 * GUTTER);
	const x = event.x - GUTTER;
	if (!columns || x < columns[0] || x >= columns[1]) return undefined;
	if (event.type === "move") {
		hovered = new WeakRef(owner);
		return { handled: true };
	}
	if (event.type !== "click" || event.button !== "left") return event.type === "press" ? { handled: true } : undefined;
	void clipboard(text()).then(() => notify?.("Copied", "info"), () => notify?.("Could not copy message", "error"));
	return { handled: true };
}
