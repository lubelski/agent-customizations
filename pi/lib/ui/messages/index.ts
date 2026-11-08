import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import installAssistant from "./assistant.ts";
import installPanels from "./panels.ts";

/** One message-appearance module owns assistant/thinking and user/custom panels. */
export default function installMessages(pi: ExtensionAPI): void {
	installAssistant(pi);
	installPanels(pi);
}
