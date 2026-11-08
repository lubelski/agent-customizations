import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type Mode = "ui" | "legacy";
type Ownership = { mode: Mode; active: Set<string> };
const KEY = Symbol.for("will.pi.presentation-owner.v1");
const shared = globalThis as typeof globalThis & { [KEY]?: Ownership };

/**
 * Prototype patches outlive an extension runtime. Keep the selected family for
 * the entire process, but release individual entries on shutdown for /reload.
 * First family loaded wins; the other never registers commands/tools or patches.
 */
export function claimPresentation(pi: ExtensionAPI, mode: Mode, name: string): boolean {
	const owner = shared[KEY] ??= { mode, active: new Set() };
	if (owner.mode !== mode || owner.active.has(name)) {
		pi.on("session_start", (_event, ctx) => {
			if (ctx.hasUI) ctx.ui.notify(
				`Skipped ${name}: ${owner.mode} presentation already owns this process. Load only ui.ts or the deprecated visual extensions, then restart Pi (not /reload).`,
				"warning",
			);
		});
		return false;
	}
	owner.active.add(name);
	pi.on("session_shutdown", () => { owner.active.delete(name); });
	if (mode === "legacy") {
		pi.on("session_start", (_event, ctx) => {
			if (ctx.hasUI) ctx.ui.notify(`${name} is deprecated. Replace the six visual extensions with ui.ts and restart Pi.`, "warning");
		});
	}
	return true;
}
