import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { claimPresentation } from "../lib/ui/ownership.ts";
import { UiSettingsStore } from "../lib/ui/settings.ts";
import installMessages from "../lib/ui/messages/index.ts";
import installCode from "../lib/ui/code.ts";
import installTools from "../lib/ui/tools.ts";
import installHeader from "../lib/ui/header.ts";
import installFooter from "../lib/ui/footer.ts";
import installUiCommands from "../lib/ui/commands.ts";

/** The only active presentation entry point. Renderer modules are not extensions. */
export default function ui(pi: ExtensionAPI): void {
	if (!claimPresentation(pi, "ui", "ui")) return;
	const settings = new UiSettingsStore(join(getAgentDir(), "ui.json"));
	pi.on("session_start", (_event, ctx) => {
		try {
			settings.reload();
		} catch (error) {
			if (ctx.hasUI) ctx.ui.notify(`Could not load ${settings.path}; using UI defaults: ${error}`, "warning");
		}
	});
	installUiCommands(pi, settings);
	installMessages(pi, settings);
	installCode(pi);
	installTools(pi, () => settings.current.messages.layout === "compatible");
	installHeader(pi, settings);
	installFooter(pi, settings);
}
