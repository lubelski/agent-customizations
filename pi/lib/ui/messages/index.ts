import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import installAssistant from "./assistant.ts";
import installPanels from "./panels.ts";
import type { UiSettingsStore } from "../settings.ts";

/** One message-appearance module owns assistant/thinking and user/custom panels. */
export default function installMessages(pi: ExtensionAPI, settings: UiSettingsStore): void {
	const layout = () => settings.current.messages.layout;
	installAssistant(pi, layout);
	installPanels(pi, layout);
}
