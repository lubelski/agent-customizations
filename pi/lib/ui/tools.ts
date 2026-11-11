import {
	getLanguageFromPath,
	highlightCode,
	Theme,
	ToolExecutionComponent,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

import { stripTerminalSequences, truncateToWidth, visibleWidth, type TuiMouseEvent, type TuiMouseEventResult } from "@earendil-works/pi-tui";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { cleanSummary, commandSignal, failureTail, pathSignal, unstyled, type Paint } from "./tool-signal.ts";

// Pi loads personal extensions through symlinks. Resolve parser dependencies
// from this checkout, not from the user's ~/.pi/agent directory.
const requireDependency = createRequire(realpathSync(fileURLToPath(import.meta.url)));
const { parse } = requireDependency("acorn") as typeof import("acorn");
const { simple } = requireDependency("acorn-walk") as typeof import("acorn-walk");

/** Message text sits two columns in (gap plus padding); tools follow the same left edge. */
let indented: () => boolean = () => false;

const discoveryCalls = new Set(["searchTools", "describeTool", "describeNamespace"]);
const scriptCache = new WeakMap<object, { code: unknown; labels: string[] }>();

/** Static call sites, not execution counts (loops/branches are not evaluated). */
export function codemodeCalls(code: unknown): string[] {
	if (typeof code !== "string" || code.length > 100_000) return [];
	try {
		const ast = parse(code, { ecmaVersion: "latest", allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true });
		const calls: { name: string; start: number }[] = [];
		simple(ast, {
			CallExpression(node) {
				const callee = node.callee;
				let name: string | undefined;
				if (callee.type === "Identifier" && discoveryCalls.has(callee.name)) name = callee.name;
				if (callee.type === "MemberExpression" && callee.object.type === "Identifier" && callee.object.name === "tools") {
					if (!callee.computed && callee.property.type === "Identifier") name = callee.property.name;
					else if (callee.computed && callee.property.type === "Literal" && typeof callee.property.value === "string") name = callee.property.value;
				}
				if (name && /^[\w$]+$/.test(name)) calls.push({ name, start: node.start });
			},
		});
		const counts = new Map<string, number>();
		for (const { name } of calls.sort((a, b) => a.start - b.start)) counts.set(name, (counts.get(name) ?? 0) + 1);
		return [...counts].map(([name, count]) => count > 1 ? `${name} ×${count}` : name);
	} catch {
		return []; // Invalid/unsupported scripts must never break transcript rendering.
	}
}

let currentTheme: (() => Theme) | undefined;
const PAGE_SIZE = 10;
type Disclosure = { limit: number; controlRow?: number; allColumn?: number; hasMore?: boolean };
const disclosures = new WeakMap<ToolComponent, Disclosure>();
let selected: WeakRef<ToolComponent> | undefined;
const ORIGINAL_EXPAND = Symbol.for("will.pi.recessed-tools.original-expand");
const WRAPPED_EXPAND = Symbol.for("will.pi.recessed-tools.wrapped-expand");
function disclosure(tool: ToolComponent): Disclosure {
	let state = disclosures.get(tool);
	if (!state) disclosures.set(tool, state = { limit: PAGE_SIZE });
	return state;
}
function reveal(tool: ToolComponent, action: string): void {
	if (action === "collapse") tool.setExpanded(false);
	else {
		const state = disclosure(tool);
		state.limit = action === "all" ? Infinity : state.limit + PAGE_SIZE;
		if (!tool.expanded) tool.setExpanded(true);
	}
	tool.ui?.requestRender();
}
const ORIGINAL_MOUSE = Symbol.for("will.pi.recessed-tools.original-mouse");
const WRAPPED_MOUSE = Symbol.for("will.pi.recessed-tools.wrapped-mouse");

/** Deliberately omit payloads/scripts: the transcript should foreground prose. */
export function toolSummary(name: string, args: Record<string, unknown>, failed: boolean, width = Infinity, markHome: (text: string) => string = text => text, paint: Paint = unstyled): string {
	if (name === "codemode") {
		let cached = scriptCache.get(args);
		if (!cached || cached.code !== args.code) {
			cached = { code: args.code, labels: codemodeCalls(args.code) };
			scriptCache.set(args, cached);
		}
		const { labels } = cached;
		const format = (count: number) => paint("dim", `${failed ? "✗" : "›"} codemode`) + (count ? paint("dim", " · ") + labels.slice(0, count).map(label => {
			const [call, multiplicity] = label.split(" ×");
			return paint("text", call) + (multiplicity ? paint("dim", ` ×${multiplicity}`) : "");
		}).join(paint("dim", ", ")) : "") + paint("dim", `${labels.length > count ? ` · +${labels.length - count} more` : ""}${failed ? " · failed" : ""}`);
		let count = Math.min(3, labels.length);
		while (count > 1 && visibleWidth(format(count)) > width) count--;
		return format(count);
	}
	const targetKey = ["pattern", "query", "path", "file_path", "command", "url"]
		.find(key => typeof args[key] === "string" && (args[key] as string).length > 0);
	const target = targetKey ? args[targetKey] as string : undefined;
	const head = `${failed ? "✗" : "›"} ${cleanSummary(name)}`;
	const suffix = failed ? " · failed" : "";
	const room = Math.max(0, width - visibleWidth(head + suffix) - 3);
	let detail = "";
	if (target !== undefined) {
		if (targetKey === "path" || targetKey === "file_path") detail = pathSignal(cleanSummary(target), homedir(), room, markHome, paint);
		else if (targetKey === "command") detail = commandSignal(target, homedir(), markHome, paint);
		else if (targetKey === "url") {
			const match = cleanSummary(target).match(/^(https?:\/\/)([^/]+)(.*)$/);
			detail = match ? paint("dim", match[1]) + paint("text", match[2]) + paint("dim", match[3]) : paint("dim", cleanSummary(target));
		} else {
			detail = paint("text", cleanSummary(target));
			const scope = typeof args.path === "string" ? args.path : undefined;
			if (scope) detail += paint("dim", ` in ${cleanSummary(scope)}`);
		}
	}
	return paint("dim", head) + (target !== undefined ? paint("dim", " · ") + detail : "") + paint("dim", suffix);
}

function summaryHeader(tool: ToolComponent, width: number, theme: Theme): string {
	const failed = !!tool.result?.isError;
	const paint: Paint = (tone, text) => theme.fg(failed ? "error" : tone, text);
	return truncateToWidth(toolSummary(tool.toolName ?? "tool", tool.args ?? {}, failed, width,
		text => theme.fg(failed ? "error" : "accent", text), paint), width);
}

/** The argument that streams in: what a pending tool is about to run or write. */
export function streamingPayload(name: string, args: Record<string, unknown>): { text: string; lang?: string } {
	const path = typeof args.path === "string" ? args.path : typeof args.file_path === "string" ? args.file_path : undefined;
	const fromPath = path ? getLanguageFromPath(path) : undefined;
	if (typeof args.code === "string") return { text: args.code, lang: "javascript" };
	if (typeof args.command === "string") return { text: args.command, lang: "bash" };
	if (typeof args.content === "string") return { text: args.content, lang: fromPath };
	if (Array.isArray(args.edits)) {
		const text = args.edits.map(edit => typeof edit?.newText === "string" ? edit.newText : "").filter(Boolean).join("\n");
		if (text) return { text, lang: fromPath };
	}
	return { text: JSON.stringify(args, null, 2) ?? "", lang: "json" };
}

const streamingOpen = new WeakSet<object>();

function highlighted(text: string, lang?: string): string[] {
	try { return lang ? highlightCode(text, lang) : text.split("\n"); }
	catch { return text.split("\n"); }
}

/**
 * A collapsed tool keeps a fixed three-row height: its summary and two
 * preview lines (output once it runs). Clicking opens the full details.
 */
/** Payload lines (highlighted) then output lines, for the └ row and the opened view. */
function toolBody(tool: ToolComponent, theme: Theme): string[] {
	const name = tool.toolName ?? "tool";
	const args = tool.args ?? {};
	const payload = streamingPayload(name, args);
	const lines = payload.text.trim() ? highlighted(payload.text.replace(/\s+$/, ""), payload.lang) : [];
	const output = (tool.result as { content?: { type: string; text?: string }[] } | undefined)?.content
		?.filter(part => part.type === "text" && part.text).map(part => part.text!).join("\n").replace(/\s+$/, "").split("\n")
		.map(line => theme.fg("dim", stripTerminalSequences(line))) ?? [];
	return [...lines, ...output.filter(line => stripTerminalSequences(line).trim())];
}

/** Branches sit beneath the tool name, two columns past the summary marker. */
function branchRow(bracket: string, line: string, width: number, theme: Theme): string {
	const prefix = `  ${bracket} `;
	if (width < 4) return theme.fg("dim", prefix.slice(0, Math.max(0, width)));
	return theme.fg("dim", prefix) + truncateToWidth(line, width - 4);
}

/** Two latest meaningful lines; pad short previews to avoid height changes. */
function previewRows(body: string[], width: number, theme: Theme): string[] {
	const meaningful = body.filter(line => /[\p{L}\p{N}]/u.test(stripTerminalSequences(line)));
	const lines = (meaningful.length ? meaningful : body.filter(line => stripTerminalSequences(line).trim())).slice(-2);
	while (lines.length < 2) lines.unshift("");
	return lines.map((line, index) => branchRow(index === 0 ? "│" : "└", line, width, theme));
}

function renderPending(tool: ToolComponent, width: number): string[] {
	const theme = currentTheme!();
	const header = summaryHeader(tool, width, theme);
	const body = toolBody(tool, theme);
	const row = (bracket: string, line = "") => branchRow(bracket, line, width, theme);
	if (!streamingOpen.has(tool)) return [header, ...previewRows(body, width, theme)];
	if (!body.length) return [header, row("└")];
	return [header, ...body.map((line, index) => row(index === body.length - 1 ? "└" : "│", line))];
}

const ORIGINAL_RENDER = Symbol.for("will.pi.recessed-tools.original-render");
const WRAPPED_RENDER = Symbol.for("will.pi.recessed-tools.wrapped-render");
const ORIGINAL_BG = Symbol.for("will.pi.recessed-tools.original-bg");
const WRAPPED_BG = Symbol.for("will.pi.recessed-tools.wrapped-bg");
const ORIGINAL_FG = Symbol.for("will.pi.recessed-tools.original-fg");
const WRAPPED_FG = Symbol.for("will.pi.recessed-tools.wrapped-fg");

type ToolComponent = {
	render(width: number): string[];
	expanded?: boolean;
	toolName?: string;
	args?: Record<string, unknown>;
	isPartial?: boolean;
	result?: { isError?: boolean; content?: { type: string; text?: string }[] };
	imageComponents?: unknown[];
	contentBox?: { render(width: number): string[] };
	contentText?: { render(width: number): string[] };
	selfRenderContainer?: { render(width: number): string[] };
	hasRendererDefinition?(): boolean;
	getRenderShell?(): string;
	setExpanded(expanded: boolean): void;
	handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined;
	ui?: { requestRender(): void };
};

type PatchTarget<T> = T & Record<PropertyKey, unknown>;

function currentBase<T extends (...args: any[]) => any>(
	target: Record<PropertyKey, unknown>,
	method: T,
	originalKey: symbol,
	wrapperKey: symbol,
): T {
	const installedWrapper = target[wrapperKey] as T | undefined;
	const savedOriginal = target[originalKey] as T | undefined;
	return installedWrapper && method === installedWrapper && savedOriginal ? savedOriginal : method;
}

function setPatch<T extends (...args: any[]) => any>(
	target: Record<PropertyKey, unknown>,
	originalKey: symbol,
	wrapperKey: symbol,
	original: T,
	wrapper: T,
): void {
	Object.defineProperty(target, originalKey, { value: original, configurable: true, writable: true });
	Object.defineProperty(target, wrapperKey, { value: wrapper, configurable: true, writable: true });
}

function patchToolHeight(): void {
	const target = ToolExecutionComponent.prototype as unknown as PatchTarget<ToolComponent>;
	const original = currentBase(target, target.render, ORIGINAL_RENDER, WRAPPED_RENDER);

	const completed = (component: ToolComponent) => currentTheme &&
		component.isPartial === false && component.result && typeof component.toolName === "string";
	const originalExpand = currentBase(target, target.setExpanded, ORIGINAL_EXPAND, WRAPPED_EXPAND);
	const expand = function (this: ToolComponent, expanded: boolean): void {
		if (!expanded) disclosures.delete(this);
		else selected = new WeakRef(this);
		originalExpand.call(this, expanded);
	};
	setPatch(target, ORIGINAL_EXPAND, WRAPPED_EXPAND, originalExpand, expand);
	target.setExpanded = expand;
	const wrapper = function (this: ToolComponent, width: number): string[] {
		// Two columns: the panels' gap column plus their padding, so tool text lines up with message text.
		if (!indented() || width < 3) return renderTool.call(this, width, 0);
		return renderTool.call(this, width - 2, 2).map(line => `  ${line}`);
	};
	const renderTool = function (this: ToolComponent, width: number, offset: number): string[] {
		if (!completed(this)) return currentTheme && this.isPartial !== false && width > 2
			? renderPending(this, width) : original.call(this, width);
		if (width <= 0) return [];
		const theme = currentTheme!();
		const header = summaryHeader(this, width, theme);
		// Quiet successes; failures keep a bounded, literal output tail.
		if (!this.expanded) {
			if (!this.result?.isError) return [header];
			const { lines, omitted } = failureTail(this.result);
			const preview = lines.length ? lines : ["No text output; expand for details."];
			return [header,
				...(omitted ? [branchRow("│", theme.fg("dim", `… ${omitted} earlier lines · expand heading for details`), width, theme)] : []),
				...preview.map((line, index) => branchRow(index === preview.length - 1 ? "└" : "│", theme.fg("error", line), width, theme))];
		}
		const state = disclosure(this);
		// Never slice terminal image escape sequences. Preview text only; full
		// disclosure restores native image rendering intact.
		const images = this.imageComponents;
		const textComponent = this.hasRendererDefinition?.()
			? this.getRenderShell?.() === "self" ? this.selfRenderContainer : this.contentBox
			: this.contentText;
		const lines = state.limit === Infinity ? original.call(this, width)
			: textComponent?.render(width) ?? ["Preview unavailable; choose show all."];
		const shown = lines.slice(0, state.limit);
		const remaining = lines.length - shown.length;
		const hiddenImages = state.limit !== Infinity && !!images?.length;
		state.hasMore = remaining > 0 || hiddenImages || (state.limit !== Infinity && !textComponent);
		const more = `+10 more (${remaining} rows)`;
		state.allColumn = remaining > 0 ? offset + more.length + 3 : 0;
		const controls = remaining > 0 ? `${more} · show all` : state.hasMore
			? `show all${hiddenImages ? " (images)" : ""}` : "collapse";
		state.controlRow = shown.length + 1;
		return [header, ...shown, currentTheme!().fg("dim", truncateToWidth(controls, width))];
	};

	// Own all completed-tool hit areas, including sliced previews. Body clicks
	// and drags remain available for selection rather than suddenly expanding.
	const originalMouse = currentBase(target, target.handleMouse, ORIGINAL_MOUSE, WRAPPED_MOUSE);
	const mouse = function (this: ToolComponent, event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (!completed(this)) {
			if (!currentTheme || this.isPartial === false) return originalMouse.call(this, event);
			if (event.type !== "click" || event.button !== "left") return undefined;
			if (streamingOpen.has(this)) streamingOpen.delete(this); else streamingOpen.add(this);
			this.ui?.requestRender();
			return { handled: true };
		}
		if (event.type !== "click" || event.button !== "left") return undefined;
		selected = new WeakRef(this);
		if (event.y === 0) {
			this.setExpanded(!this.expanded);
			this.ui?.requestRender();
			return { handled: true };
		}
		const state = disclosure(this);
		if (this.expanded && event.y === state.controlRow) {
			reveal(this, !state.hasMore ? "collapse" : event.x >= state.allColumn! ? "all" : "more");
			return { handled: true };
		}
		return undefined;
	};
	setPatch(target, ORIGINAL_MOUSE, WRAPPED_MOUSE, originalMouse, mouse);
	target.handleMouse = mouse;
	setPatch(target, ORIGINAL_RENDER, WRAPPED_RENDER, original, wrapper);
	target.render = wrapper;
}

function patchToolColors(): void {
	const target = Theme.prototype as unknown as PatchTarget<{
		bg: Theme["bg"];
		fg: Theme["fg"];
	}>;
	const originalBg = currentBase(target, target.bg, ORIGINAL_BG, WRAPPED_BG);
	const originalFg = currentBase(target, target.fg, ORIGINAL_FG, WRAPPED_FG);

	const bgWrapper = function (
		this: Theme,
		color: Parameters<Theme["bg"]>[0],
		text: string,
	): string {
		// Completed tools use the same quiet neutral panel as pending tools.
		// Errors retain their distinct background so failures remain noticeable.
		const recessedColor = color === "toolSuccessBg" ? "toolPendingBg" : color;
		return originalBg.call(this, recessedColor, text);
	} as Theme["bg"];

	const fgWrapper = function (
		this: Theme,
		color: Parameters<Theme["fg"]>[0],
		text: string,
	): string {
		const recessedColor = color === "toolTitle" || color === "toolOutput" ? "dim" : color;
		return originalFg.call(this, recessedColor, text);
	} as Theme["fg"];

	setPatch(target, ORIGINAL_BG, WRAPPED_BG, originalBg, bgWrapper);
	setPatch(target, ORIGINAL_FG, WRAPPED_FG, originalFg, fgWrapper);
	target.bg = bgWrapper;
	target.fg = fgWrapper;
}

export default function (pi: ExtensionAPI, indent: () => boolean = () => false): void {
	indented = indent;
	patchToolHeight();
	patchToolColors();

	pi.registerCommand("tool-detail", {
		description: "Reveal more of the last opened/clicked tool: more, all, or collapse",
		handler: async (args, ctx) => {
			const action = args.trim() || "more";
			const tool = selected?.deref();
			if (!["more", "all", "collapse"].includes(action)) {
				ctx.ui.notify("Usage: /tool-detail more|all|collapse", "info");
				return;
			}
			if (!tool) {
				ctx.ui.notify("Open a tool first (click or Ctrl+O) to select it.", "info");
				return;
			}
			reveal(tool, action);
		},
	});

	pi.on("session_start", (_event, ctx) => {
		selected = undefined;
		if (ctx.mode === "tui") {
			currentTheme = () => ctx.ui.theme;
		}
	});
}
