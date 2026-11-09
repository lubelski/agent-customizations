/** @deprecated Use ui.ts. Legacy implementation is frozen in ../legacy/. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import install from "../legacy/half-bleed.ts";
import { claimPresentation } from "../lib/ui/ownership.ts";

export * from "../legacy/half-bleed.ts";
export default function (pi: ExtensionAPI): void {
	if (claimPresentation(pi, "legacy", "half-bleed")) install(pi);
}
