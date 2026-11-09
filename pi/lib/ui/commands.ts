import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { UiSetting, UiSettingsStore } from "./settings.ts";

const COMMANDS: readonly [string, UiSetting, string][] = [
	["ui-toggle-compact-header", "compactHeader", "Compact header: drop the top rule"],
	["ui-toggle-compact-footer", "compactFooter", "Compact footer: three rows instead of seven"],
	["ui-toggle-font-compat", "fontCompat", "Font compatibility: whole-row padding and gaps instead of half-block glyphs"],
];

/** Each command flips one saved preference; the three are independent. */
export default function installUiCommands(pi: ExtensionAPI, settings: UiSettingsStore): void {
	for (const [name, key, label] of COMMANDS) {
		pi.registerCommand(name, {
			description: `Toggle ${label.charAt(0).toLowerCase()}${label.slice(1)} (saved)`,
			handler: async (args, ctx) => {
				if (ctx.mode !== "tui") { ctx.ui.notify("UI appearance commands require interactive mode.", "warning"); return; }
				if (args.trim()) { ctx.ui.notify(`Usage: /${name}`, "warning"); return; }
				let next: boolean;
				try { next = settings.toggle(key); }
				catch (error) { ctx.ui.notify(`Could not save UI preferences: ${error}`, "error"); return; }
				ctx.ui.notify(`${label.split(":")[0]} ${next ? "on" : "off"} (saved).`, "info");
			},
		});
	}
}
