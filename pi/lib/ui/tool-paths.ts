import { sliceByColumn, visibleWidth } from "@earendil-works/pi-tui";

/** Display-only shortening; preserve both ends and highlight only an inserted home alias. */
export function compactPath(path: string, home: string, width: number, markHome = (text: string) => text): string {
	const root = home.replace(/\/+$/, "");
	const replaced = !!root && (path === root || path.startsWith(root + "/"));
	let shown = replaced ? "~" + path.slice(root.length) : path;
	if (visibleWidth(shown) > width) {
		if (width < 3) return width > 0 ? "…" : "";
		const left = Math.ceil((width - 1) / 2);
		const right = width - left - 1;
		shown = sliceByColumn(shown, 0, left, true) + "…" + sliceByColumn(shown, visibleWidth(shown) - right, right, true);
	}
	return replaced && shown.startsWith("~") ? markHome("~") + shown.slice(1) : shown;
}
