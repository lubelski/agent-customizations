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
} from "@earendil-works/pi-tui";
import {
	LEFT_PANEL_EDGE,
	RIGHT_PANEL_EDGE,
	stabilizeThinkingToolSpacing,
	type ThinkingLayout,
} from "../lib/transcript-layout.ts";

import { attachMessageRendering, codeBlocks, type MessageControlState } from "../lib/message-controls.ts";

const controls = new WeakSet<object>();
const state: MessageControlState = { plain: false };
let latestSource = "";

const ORIGINAL_RENDER = Symbol.for("will.pi.assistant-background.original-render");
const WRAPPED_RENDER = Symbol.for("will.pi.assistant-background.wrapped-render");
const APPLIED_STYLE = Symbol.for("will.pi.assistant-background.applied-style");
const ORIGINAL_UPDATE = Symbol.for("will.pi.assistant-background.original-update");
const WRAPPED_UPDATE = Symbol.for("will.pi.assistant-background.wrapped-update");

let activeTheme: Theme | undefined;

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

function assistantBackground(text: string, panelEdges = true): string {
	if (!activeTheme) return text;

	// Neutral grays chosen to sit clearly above the terminal background while
	// preserving strong contrast with the theme's ordinary Markdown colors.
	const color = activeTheme.appearance === "dark"
		? rgbColor(48, 48, 52)
		: rgbColor(226, 226, 230);
	const mode = activeTheme.getColorMode();
	const background = backgroundAnsi(color, mode);

	if (!panelEdges || text.length < 2 || text[0] !== " " || text.at(-1) !== " ") {
		return `${background}${text}\x1b[49m`;
	}

	const foreground = foregroundAnsi(color, mode);
	return `\x1b[49m${foreground}${LEFT_PANEL_EDGE}\x1b[39m${background}${text.slice(1, -1)}\x1b[49m${foreground}${RIGHT_PANEL_EDGE}\x1b[39m`;
}

function messageLayout(component: AssistantInternals): ThinkingLayout {
	const content = component.lastMessage?.content ?? [];
	return {
		hasThinking: content.some((part) => part.type === "thinking" && part.thinking?.trim()),
		hasProse: content.some((part) => part.type === "text" && part.text?.trim()),
		hasToolCall: content.some((part) => part.type === "toolCall"),
	};
}

function styleTextBlocks(component: AssistantInternals): void {
	const children = component.contentContainer?.children ?? [];
	for (let index = 0; index < children.length; index++) {
		let child = children[index];
		// Pi wraps thinking Markdown in a click-to-collapse region. Treat its text
		// like ordinary prose, including selection/copy behavior, not a disclosure.
		// Keep the actual thinking content and its Markdown transformer identity.
		const wrapped = child instanceof MouseRegion
			? (child as unknown as { child?: unknown }).child : undefined;
		if (wrapped instanceof Markdown) {
			child = wrapped;
			const markdown = child as unknown as MarkdownInternals;
			const { color: _color, italic: _italic, ...style } = markdown.defaultTextStyle ?? {};
			markdown.defaultTextStyle = style;
			children[index] = child;
			markdown.invalidate();
		}
		if (!(child instanceof Markdown)) continue;

		latestSource = (child as unknown as { text: string }).text;
		if (!controls.has(child)) {
			attachMessageRendering(child as unknown as Parameters<typeof attachMessageRendering>[0], state,
				text => activeTheme ? activeTheme.fg("mdCodeBlockBorder", text) : text);
			controls.add(child);
		}
		const markdown = child as unknown as MarkdownInternals;
		if (markdown[APPLIED_STYLE] === assistantBackground && markdown.paddingY === 1) continue;
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
		return stabilizeThinkingToolSpacing(original.call(this, width), messageLayout(this));
	};

	Object.defineProperty(target, ORIGINAL_RENDER, { value: original, configurable: true, writable: true });
	Object.defineProperty(target, WRAPPED_RENDER, { value: wrapper, configurable: true, writable: true });
	target.render = wrapper;
}

export default function (pi: ExtensionAPI): void {
	patchAssistantRendering();
	pi.registerCommand("plain-text", {
		description: "Toggle original Markdown for all assistant messages",
		handler: async (_args, ctx) => {
			state.plain = !state.plain;
			ctx.ui.notify(state.plain ? "All assistant messages: plain text" : "All assistant messages: formatted", "info");
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
		ctx.ui.setStatus("pi-customization:assistant-background", "assistant-bg");
	});
}
