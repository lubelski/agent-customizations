/** @deprecated Use ui.ts. Legacy implementation is frozen in ../legacy/. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import install from "../legacy/stable-input-layout.ts";
import { claimPresentation } from "../lib/ui/ownership.ts";

export * from "../legacy/stable-input-layout.ts";
export default function (pi: ExtensionAPI): void {
	if (claimPresentation(pi, "legacy", "stable-input-layout")) install(pi);
}
