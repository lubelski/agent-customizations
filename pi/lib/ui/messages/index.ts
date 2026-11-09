import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import installAssistant from "./assistant.ts";
import installPanels from "./panels.ts";
import { installGapCollapse } from "./gaps.ts";
import { messageLayout, type UiSettingsStore } from "../settings.ts";

/** One message-appearance module owns assistant/thinking and user/custom panels. */
export default function installMessages(pi: ExtensionAPI, settings: UiSettingsStore): void {
	const layout = () => messageLayout(settings.current);
	installAssistant(pi, layout);
	installPanels(pi, layout);
	installGapCollapse(() => layout() === "unicode");
}
