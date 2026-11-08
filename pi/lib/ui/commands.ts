import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { UiSettingsStore, UiPreset } from "./settings.ts";

export default function installUiCommands(pi: ExtensionAPI, settings: UiSettingsStore): void {
	const save = (ctx: ExtensionCommandContext, change: () => void, message: string) => {
		if (ctx.mode !== "tui") {
			ctx.ui.notify("UI appearance commands require interactive mode.", "warning");
			return;
		}
		try { change(); }
		catch (error) { ctx.ui.notify(`Could not save UI preferences: ${error}`, "error"); return; }
		ctx.ui.notify(`${message} (saved).`, "info");
	};
	for (const preset of ["compact", "mobile", "desktop"] as const satisfies readonly UiPreset[]) {
		pi.registerCommand(`ui-${preset}`, {
			description: preset === "compact" ? "Compact header/footer; leave message layout unchanged (saved)"
				: `${preset === "mobile" ? "Compact" : "Full"} header/footer with compatible message panels (saved)`,
			handler: async (args, ctx) => {
				if (args.trim()) { ctx.ui.notify(`Usage: /ui-${preset}`, "warning"); return; }
				save(ctx, () => settings.applyPreset(preset), `UI ${preset}`);
			},
		});
	}
	pi.registerCommand("ui-footer", {
		description: "Set footer density: compact|full|toggle (saved)",
		getArgumentCompletions: prefix => ["compact", "full", "toggle"].filter(value => value.startsWith(prefix)).map(value => ({ value, label: value })),
		handler: async (args, ctx) => {
			const action = args.trim() || "toggle";
			if (!["compact", "full", "toggle"].includes(action)) { ctx.ui.notify("Usage: /ui-footer [compact|full|toggle]", "warning"); return; }
			const compact = action === "toggle" ? !settings.current.footer.compact : action === "compact";
			save(ctx, () => settings.setFooterCompact(compact), `Footer ${compact ? "compact" : "full"}`);
		},
	});
	pi.registerCommand("ui-messages", {
		description: "Set message panels: compatible|unicode (saved; Unicode is opt-in)",
		getArgumentCompletions: prefix => ["compatible", "unicode"].filter(value => value.startsWith(prefix)).map(value => ({ value, label: value })),
		handler: async (args, ctx) => {
			const layout = args.trim();
			if (layout !== "compatible" && layout !== "unicode") {
				ctx.ui.notify(`Message layout: ${settings.current.messages.layout}. Usage: /ui-messages compatible|unicode`, "info");
				return;
			}
			save(ctx, () => settings.setMessageLayout(layout), `Message layout ${layout}`);
		},
	});
}
