import {
	AssistantMessageComponent,
	BranchSummaryMessageComponent,
	CompactionSummaryMessageComponent,
	CustomMessageComponent,
	SkillInvocationMessageComponent,
	Theme,
	ToolExecutionComponent,
	UserMessageComponent,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { foregroundAnsi, Markdown, mixColors, stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import {
	renderWithGutter,
	capPanelRows,
	trimToolRulePadding,
} from "../../transcript-layout.ts";
import { attachMessageRendering } from "../../message-controls.ts";
import { plainDivider, plainTextState } from "./assistant.ts";
import { copyMouse, decorateCopy } from "./copy.ts";

import type { MessageLayout } from "../settings.ts";

let getLayout: () => MessageLayout = () => "compatible";

const TOOL_BACKGROUNDS = new Set([
	"toolPendingBg",
	"toolSuccessBg",
	"toolErrorBg",
]);

const PANEL_BACKGROUNDS = new Set([
	"userMessageBg",
	"customMessageBg",
	...TOOL_BACKGROUNDS,
]);

const ORIGINAL_BG = Symbol.for("will.pi.half-bleed.original-bg");
const ORIGINAL_FG = Symbol.for("will.pi.half-bleed.original-fg");
const ORIGINAL_RENDER = Symbol.for("will.pi.half-bleed.original-render");

const PANEL_COMPONENTS = [
	UserMessageComponent,
	ToolExecutionComponent,
	CustomMessageComponent,
	BranchSummaryMessageComponent,
	CompactionSummaryMessageComponent,
	SkillInvocationMessageComponent,
];

type PatchableTheme = Theme & {
	getBgAnsi(color: string): string;
	getColorMode(): Parameters<typeof foregroundAnsi>[1];
};

type Renderable = {
	invalidate?(): void;
	render(width: number): string[];
};

function patchPanelComponent(ComponentClass: { prototype: Renderable }): void {
	const target = ComponentClass.prototype as Renderable & Record<PropertyKey, unknown>;
	const original = (target[ORIGINAL_RENDER] as Renderable["render"] | undefined) ?? target.render;

	if (!Object.hasOwn(target, ORIGINAL_RENDER)) {
		Object.defineProperty(target, ORIGINAL_RENDER, { value: original, configurable: true });
	}

	const layouts = new WeakMap<Renderable, MessageLayout>();
	target.render = function (this: Renderable, width: number): string[] {
		const layout = getLayout();
		if (layouts.get(this) !== layout) {
			this.invalidate?.();
			layouts.set(this, layout);
		}
		if (ComponentClass === ToolExecutionComponent) {
			return trimToolRulePadding(original.call(this, width), stripTerminalSequences);
		}
		if (ComponentClass === UserMessageComponent) attachPlainText(this);
		return renderWithGutter(layout === "unicode"
			? w => capPanelRows(original.call(this, w), stripTerminalSequences, visibleWidth)
			: w => original.call(this, w), width);
	};
}

const plainControls = new WeakSet<object>();

/** User prompts follow the same /plain-text toggle as assistant prose. */
function attachPlainText(component: Renderable): void {
	const children = (component as { children?: unknown[] }).children ?? [];
	for (const child of children) {
		if (!(child instanceof Markdown) || plainControls.has(child)) continue;
		attachMessageRendering(child as unknown as Parameters<typeof attachMessageRendering>[0], plainTextState, plainDivider);
		// Cap at the Markdown level so the copy label can sit on the cap row.
		const render = child.render.bind(child);
		child.render = (width: number) => {
			if (plainTextState.plain) return render(width);
			const lines = getLayout() === "unicode" ? capPanelRows(render(width), stripTerminalSequences, visibleWidth) : render(width);
			return decorateCopy(lines, child);
		};
		const message = component as unknown as { text?: string };
		(child as unknown as { handleMouse?: unknown }).handleMouse = (event: Parameters<typeof copyMouse>[2]) =>
			plainTextState.plain ? undefined : copyMouse(child, () => message.text ?? (child as unknown as { text: string }).text, event);
		plainControls.add(child);
	}
}

function patchPanelBackgrounds(): void {
	const target = Theme.prototype as unknown as Record<PropertyKey, unknown> & { bg: Theme["bg"] };
	const original = (target[ORIGINAL_BG] as Theme["bg"] | undefined) ?? target.bg;

	if (!Object.hasOwn(target, ORIGINAL_BG)) {
		Object.defineProperty(target, ORIGINAL_BG, { value: original, configurable: true });
	}

	target.bg = function (this: PatchableTheme, color: Parameters<Theme["bg"]>[0], text: string): string {
		if (!PANEL_BACKGROUNDS.has(color) || text.length < 2 || text[0] !== " " || text.at(-1) !== " ") {
			return original.call(this, color, text);
		}

		if (TOOL_BACKGROUNDS.has(color)) {
			// Tool panels should read as transcript scaffolding, not as messages.
			// Replace their filled box with one thin, low-salience left rule. Keep
			// errors distinct without restoring the full error background.
			const edgeColor = color === "toolErrorBg"
				? this.colors.error
				: mixColors(this.colors.toolPendingBg, this.colors.borderMuted, 0.25);
			const edge = foregroundAnsi(edgeColor, this.getColorMode());
			return `\x1b[49m${edge}│\x1b[39m${text.slice(1)}`;
		}

		return original.call(this, color, text);
	} as Theme["bg"];
}

function restoreRemovedExperiments(): void {
	// `/reload` keeps patched prototypes alive. Restore prior wrappers before
	// installing this revision so experiments never stack.
	const assistant = AssistantMessageComponent.prototype as unknown as Renderable & Record<PropertyKey, unknown>;
	const originalRender = assistant[ORIGINAL_RENDER] as Renderable["render"] | undefined;
	if (originalRender) {
		assistant.render = originalRender;
		delete assistant[ORIGINAL_RENDER];
	}

	const theme = Theme.prototype as unknown as Record<PropertyKey, unknown> & {
		bg: Theme["bg"];
		fg: Theme["fg"];
	};
	const originalBg = theme[ORIGINAL_BG] as Theme["bg"] | undefined;
	if (originalBg) {
		theme.bg = originalBg;
		delete theme[ORIGINAL_BG];
	}
	const originalFg = theme[ORIGINAL_FG] as Theme["fg"] | undefined;
	if (originalFg) {
		theme.fg = originalFg;
		delete theme[ORIGINAL_FG];
	}
}

export default function (_pi: ExtensionAPI, layout: () => MessageLayout = () => "compatible"): void {
	getLayout = layout;
	restoreRemovedExperiments();
	patchPanelBackgrounds();
	for (const ComponentClass of PANEL_COMPONENTS) patchPanelComponent(ComponentClass);

}
