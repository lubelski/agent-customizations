/** @deprecated Use ui.ts. Legacy implementation is frozen in ../legacy/. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import install from "../legacy/code-brackets.ts";
import { claimPresentation } from "../lib/ui/ownership.ts";

export * from "../legacy/code-brackets.ts";
export default function (pi: ExtensionAPI): void {
	if (claimPresentation(pi, "legacy", "code-brackets")) install(pi);
}
