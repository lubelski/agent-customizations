import {
	AssistantMessageComponent,
	copyToClipboard,
	type ExtensionAPI,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	backgroundAnsi,
	foregroundAnsi,
	Markdown,
	MouseRegion,
	rgbColor,
	stripTerminalSequences,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import {
	capPanelRows,
	renderWithGutter,
	stabilizeThinkingToolSpacing,
	type ThinkingLayout,
} from "../../transcript-layout.ts";

import { attachMessageRendering, codeBlocks, type MessageControlState } from "../../message-controls.ts";
import type { MessageLayout } from "../settings.ts";

const controls = new WeakSet<object>();
const state: MessageControlState = { plain: false };
export const plainTextState = state;
export const plainDivider = (text: string): string => activeTheme ? activeTheme.fg("mdCodeBlockBorder", text) : text;
let latestSource = "";

const ORIGINAL_RENDER = Symbol.for("will.pi.assistant-background.original-render");
const WRAPPED_RENDER = Symbol.for("will.pi.assistant-background.wrapped-render");
const APPLIED_STYLE = Symbol.for("will.pi.assistant-background.applied-style");
const ORIGINAL_UPDATE = Symbol.for("will.pi.assistant-background.original-update");
const WRAPPED_UPDATE = Symbol.for("will.pi.assistant-background.wrapped-update");

let activeTheme: Theme | undefined;
let getLayout: () => MessageLayout = () => "compatible";
const APPLIED_LAYOUT = Symbol.for("will.pi.ui.assistant-layout");

type DefaultTextStyle = {
	bgColor?: (text: string) => string;
	[key: string]: unknown;
};

// Explicit runtime seam: intersecting with Markdown would conflict with its private fields.
type MarkdownInternals = {
	invalidate(): void;
	defaultTextStyle?: DefaultTextStyle;
	paddingY: number;
	[APPLIED_STYLE]?: (text: string) => string;
	[APPLIED_LAYOUT]?: MessageLayout;
};

type AssistantInternals = {
	hideThinkingBlock: boolean;
	thinkingVisibilityOverrides: Map<number, boolean>;
	updateContent(message: unknown, isStreaming?: boolean): void;
	contentContainer?: { children?: unknown[] };
	lastMessage?: {
		content?: Array<{ type: string; text?: string; thinking?: string }>;
	};
	render(width: number): string[];
};

function assistantBackground(text: string): string {
	if (!activeTheme) return text;

	// Neutral grays chosen to sit clearly above the terminal background while
	// preserving strong contrast with the theme's ordinary Markdown colors.
	const color = activeTheme.appearance === "dark"
		? rgbColor(48, 48, 52)
		: rgbColor(226, 226, 230);
	const mode = activeTheme.getColorMode();
	const background = backgroundAnsi(color, mode);

	return `${background}${text}\x1b[49m`;
}

function messageLayout(component: AssistantInternals): ThinkingLayout {
	const content = component.lastMessage?.content ?? [];
	return {
		hasThinking: content.some((part) => part.type === "thinking" && part.thinking?.trim()),
		hasProse: content.some((part) => part.type === "text" && part.text?.trim()),
		hasToolCall: content.some((part) => part.type === "toolCall"),
	};
}

const THINKING_LINES = 3;
const expandedThinking = new WeakMap<object, Set<number>>();
const TRAILING_SPACE = / +((?:\x1b\[[0-9;]*m)*)$/;

/** Thinking without a panel: muted italic text, folded to three lines; click toggles. */
class ThinkingFold {
	readonly markdown: Markdown;
	private readonly owner: object;
	private readonly run: number;
	constructor(markdown: Markdown, owner: object, run: number) {
		this.markdown = markdown;
		this.owner = owner;
		this.run = run;
	}
	get expanded(): boolean { return expandedThinking.get(this.owner)?.has(this.run) ?? false; }
	render(width: number): string[] {
		const lines = this.markdown.render(width);
		if (state.plain || this.expanded || lines.length <= THINKING_LINES) return lines;
		const shown = lines.slice(0, THINKING_LINES);
		// Ellipsis after the last visible character, inside the right padding column.
		const last = shown[THINKING_LINES - 1]!.replace(TRAILING_SPACE, "$1");
		const fitted = visibleWidth(last) <= width - 2 ? last : truncateToWidth(last, width - 2, "");
		const ellipsis = activeTheme ? activeTheme.fg("thinkingText", "…") : "…";
		shown[THINKING_LINES - 1] = fitted + ellipsis;
		return shown;
	}
	handleMouse(event: { type: string; button?: string }): { handled: true } | undefined {
		if (event.type !== "click" || event.button !== "left") return undefined;
		const runs = expandedThinking.get(this.owner) ?? new Set<number>();
		if (runs.has(this.run)) runs.delete(this.run); else runs.add(this.run);
		expandedThinking.set(this.owner, runs);
		return { handled: true };
	}
	invalidate(): void { this.markdown.invalidate(); }
}

function attachControls(markdown: Markdown): void {
	latestSource = (markdown as unknown as { text: string }).text;
	if (controls.has(markdown)) return;
	attachMessageRendering(markdown as unknown as Parameters<typeof attachMessageRendering>[0], state, plainDivider);
	controls.add(markdown);
}

function styleTextBlocks(component: AssistantInternals): void {
	const children = component.contentContainer?.children ?? [];
	let run = 0;
	for (let index = 0; index < children.length; index++) {
		let child = children[index];
		if (child instanceof ThinkingFold) { run++; attachControls(child.markdown); continue; }
		// Pi wraps thinking Markdown in a click-to-hide region. Replace it with a
		// three-line fold: no panel, no padding rows, Pi's italic muted style.
		const wrapped = child instanceof MouseRegion
			? (child as unknown as { child?: unknown }).child : undefined;
		if (wrapped instanceof Markdown) {
			const markdown = wrapped as unknown as MarkdownInternals;
			markdown.defaultTextStyle = {
				...markdown.defaultTextStyle,
				italic: true,
				color: (text: string) => activeTheme ? activeTheme.fg("thinkingText", text) : text,
			};
			markdown.paddingY = 0;
			markdown.invalidate();
			attachControls(wrapped);
			children[index] = new ThinkingFold(wrapped, component, run++);
			continue;
		}
		if (!(child instanceof Markdown)) continue;

		attachControls(child);
		const markdown = child as unknown as MarkdownInternals;
		const layout = getLayout();
		if (markdown[APPLIED_STYLE] === assistantBackground && markdown.paddingY === 1 && markdown[APPLIED_LAYOUT] === layout) continue;
		markdown[APPLIED_LAYOUT] = layout;
		markdown.defaultTextStyle = {
			...markdown.defaultTextStyle,
			bgColor: assistantBackground,
		};
		markdown.paddingY = 1;
		markdown[APPLIED_STYLE] = assistantBackground;
		markdown.invalidate();
	}
}

function patchAssistantRendering(): void {
	const target = AssistantMessageComponent.prototype as unknown as AssistantInternals & Record<PropertyKey, unknown>;
	// There is no public normal-assistant renderer API. Use the existing narrow
	// prototype seam; never rewrite messages, signatures, sessions, or settings.
	const installedUpdate = target[WRAPPED_UPDATE] as AssistantInternals["updateContent"] | undefined;
	const savedUpdate = target[ORIGINAL_UPDATE] as AssistantInternals["updateContent"] | undefined;
	const update = installedUpdate && target.updateContent === installedUpdate && savedUpdate
		? savedUpdate : target.updateContent;
	const updateWrapper: AssistantInternals["updateContent"] = function (this: AssistantInternals, message, isStreaming) {
		const hidden = this.hideThinkingBlock;
		const overrides = this.thinkingVisibilityOverrides;
		this.hideThinkingBlock = false;
		this.thinkingVisibilityOverrides = new Map();
		try {
			update.call(this, message, isStreaming);
		} finally {
			this.hideThinkingBlock = hidden;
			this.thinkingVisibilityOverrides = overrides;
		}
	};
	Object.defineProperty(target, ORIGINAL_UPDATE, { value: update, configurable: true, writable: true });
	Object.defineProperty(target, WRAPPED_UPDATE, { value: updateWrapper, configurable: true, writable: true });
	target.updateContent = updateWrapper;

	const installedWrapper = target[WRAPPED_RENDER] as AssistantInternals["render"] | undefined;
	const savedOriginal = target[ORIGINAL_RENDER] as AssistantInternals["render"] | undefined;
	const original = installedWrapper && target.render === installedWrapper && savedOriginal
		? savedOriginal
		: target.render;

	const wrapper = function (this: AssistantInternals, width: number): string[] {
		styleTextBlocks(this);
		const render = (w: number) => stabilizeThinkingToolSpacing(original.call(this, w), messageLayout(this));
		return renderWithGutter(getLayout() === "compatible" ? render
			: w => capPanelRows(render(w), stripTerminalSequences, visibleWidth), width);
	};

	Object.defineProperty(target, ORIGINAL_RENDER, { value: original, configurable: true, writable: true });
	Object.defineProperty(target, WRAPPED_RENDER, { value: wrapper, configurable: true, writable: true });
	target.render = wrapper;
}

export default function (pi: ExtensionAPI, layout: () => MessageLayout = () => "compatible"): void {
	getLayout = layout;
	patchAssistantRendering();
	pi.registerCommand("plain-text", {
		description: "Toggle original Markdown for all user and assistant messages",
		handler: async (_args, ctx) => {
			state.plain = !state.plain;
			ctx.ui.notify(state.plain ? "All messages: plain text" : "All messages: formatted", "info");
		},
	});

	pi.registerCommand("copy-code", {
		description: "Copy code from the last rendered assistant text block",
		handler: async (_args, ctx) => {
			const blocks = codeBlocks(latestSource);
			if (!blocks.length) { ctx.ui.notify("No code in the last assistant text block", "info"); return; }
			try {
				await copyToClipboard(blocks.join("\n\n"));
				ctx.ui.notify("Code copied", "info");
			} catch { ctx.ui.notify("Could not copy code", "error"); }
		},
	});

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		state.plain = false;
		latestSource = "";
		activeTheme = ctx.ui.theme;
	});
}
