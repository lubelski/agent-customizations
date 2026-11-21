import { sliceByColumn, visibleWidth, type TuiMouseEvent, type TuiMouseEventResult } from "@earendil-works/pi-tui";
import { marked } from "marked";

/**
 * Per-block copy target, as on message panels (messages/copy.ts): one gap cell
 * after a fenced block's label, then four cells. At rest they are blank; under
 * the pointer they read COPY, bold on the rule color, and a click copies the
 * block's original code (no fences, no label).
 */
export const PLAIN_MARKDOWN = Symbol.for("will.pi.plain-markdown");
export const CODE_COPY_LABEL = "COPY";
const CODE_COPY_GAP = 1;
const ORIGINAL = Symbol.for("will.pi.code-copy.original-render");
const MOUSE = Symbol.for("will.pi.code-copy.original-mouse");
// Label width and the rule's SGR color (e.g. 2;110;96;88). Markers count off
// fenced blocks in document order: Pi reuses rendered blocks across renders,
// so an index fixed at render time could be stale.
const MARKER = /\x1b\]777;pi-code;(\d+);([\d;]+)\x07/g;
export const FENCE = /^\s*(?:`{3,}|~{3,})/;
type Block = {
 text: string;
 render(width: number): string[];
 handleMouse?(event: TuiMouseEvent): TuiMouseEventResult | undefined;
 [PLAIN_MARKDOWN]?: boolean;
};
type Span = { index: number; start: number; end: number; color: string };
type State = { spans: Map<number, Span>; source?: string; blocks: string[] };
let states = new WeakMap<object, State>();
function state(block: object): State {
 let value = states.get(block);
 if (!value) { value = { spans: new Map(), blocks: [] }; states.set(block, value); }
 return value;
}

let hovered: { owner: WeakRef<object>; y: number } | undefined;

/** Container mouse routing clears hover on every pointer move; the block under the pointer re-claims it. */
export function clearCodeCopyHover(): boolean {
 const had = hovered?.owner.deref() !== undefined;
 hovered = undefined;
 return had;
}

/** Whether a label `labelWidth` wide leaves room for the gap and the copy cells. */
export function codeCopyFits(labelWidth: number, width: number): boolean {
 return labelWidth + CODE_COPY_GAP + CODE_COPY_LABEL.length <= width;
}

/** Zero-width layout metadata at the start of a label row, removed before lines reach the terminal. */
export function codeCopyMarker(labelWidth: number, color: string): string {
 return `\x1b]777;pi-code;${labelWidth};${color}\x07`;
}

/** Fenced blocks' code in document order, nested ones included. */
function fencedBlocks(source: string): string[] {
 const blocks: string[] = [];
 marked.walkTokens(marked.lexer(source), token => {
  if (token.type === "code" && FENCE.test(token.raw)) blocks.push(token.text);
 });
 return blocks;
}

function overlay(line: string, { start, end, color }: Span): string {
 const before = sliceByColumn(line, 0, start);
 const pad = " ".repeat(Math.max(0, start - visibleWidth(before)));
 const label = `\x1b[0m\x1b[1;48;${color}m${CODE_COPY_LABEL}\x1b[0m`;
 return before + pad + label + sliceByColumn(line, end, Math.max(0, visibleWidth(line) - end));
}

const plainClick = (event: TuiMouseEvent) => event.button === "left" && !event.shift && !event.alt && !event.ctrl;

export function installCodeCopy(target: Block & Record<PropertyKey, unknown>, copy: (text: string) => Promise<void>,
 notify: (message: string, error?: boolean) => void): void {
 states = new WeakMap();
 hovered = undefined;
 const render = (target[ORIGINAL] ?? target.render) as Block["render"];
 const mouse = (Object.hasOwn(target, MOUSE) ? target[MOUSE] : target.handleMouse) as Block["handleMouse"];
 Object.defineProperty(target, ORIGINAL, { value: render, configurable: true });
 // Save absence too, so reload never delegates to its own old handler.
 Object.defineProperty(target, MOUSE, { value: mouse ?? null, configurable: true });
 target.render = function (width) {
  const s = state(this);
  s.spans.clear();
  if (s.source !== this.text) { s.source = this.text; s.blocks = fencedBlocks(this.text); }
  let next = 0;
  const hover = hovered?.owner.deref() === this ? hovered.y : -1;
  return render.call(this, width).map((line, y) => {
   let span: Span | undefined;
   const clean = line.replace(MARKER, (_marker, labelWidth, color, offset) => {
    const start = visibleWidth(line.slice(0, offset)) + Number(labelWidth) + CODE_COPY_GAP;
    span = { index: next++, start, end: start + CODE_COPY_LABEL.length, color };
    return "";
   });
   if (!span) return clean;
   s.spans.set(y, span);
   return y === hover && !this[PLAIN_MARKDOWN] ? overlay(clean, span) : clean;
  });
 };
 target.handleMouse = function (event) {
  if (!this[PLAIN_MARKDOWN]) {
   const s = state(this);
   const span = s.spans.get(event.y);
   if (span && event.x >= span.start && event.x < span.end && s.blocks[span.index] !== undefined) {
    if (event.type === "move") {
     hovered = { owner: new WeakRef(this), y: event.y };
     // Pi redraws after a move only when asked to.
     return { handled: true, render: true };
    }
    if (event.type === "press" && plainClick(event)) return { handled: true };
    if (event.type === "click" && plainClick(event)) {
     void copy(s.blocks[span.index]!).then(() => notify("Copied"), () => notify("Could not copy code", true));
     return { handled: true, render: false };
    }
   }
  }
  return mouse?.call(this, event);
 };
}
