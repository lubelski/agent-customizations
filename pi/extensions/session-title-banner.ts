/** @deprecated Use ui.ts. Legacy implementation is frozen in ../legacy/. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import install from "../legacy/session-title-banner.ts";
import { claimPresentation } from "../lib/ui/ownership.ts";

export * from "../legacy/session-title-banner.ts";
export default function (pi: ExtensionAPI): void {
	if (claimPresentation(pi, "legacy", "session-title-banner")) install(pi);
}
