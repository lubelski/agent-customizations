"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = void 0;
var claude_code_1 = require("claude-code");
var blocks_1 = require("./blocks");
var commands_1 = require("./commands");
var paths_1 = require("./paths");
var paste_1 = require("./paste");
var PALETTES = {
    dark: { assistant: '#2a2725', user: '#4a3226', userText: '#efe6df', quote: '#a87a62', error: '#e07a6a', tag: '#8a7d74' },
    light: { assistant: '#e8dcc9', user: '#f4d8c3', userText: '#3b2a20', quote: '#c4906f', error: '#b0442f', tag: '#76685e' },
};
// A tool row in the ctrl+o transcript shows this much of its input and output
// before a click reveals the rest.
var INPUT_PREVIEW = 8;
var OUTPUT_PREVIEW = 12;
// An open row anywhere else (the `verbose` setting, a chevron the person
// opened) shows this many lines in all, input first but at
// most `PREVIEW_INPUT_MAX` of it when output follows.
var PREVIEW = 7;
var PREVIEW_INPUT_MAX = 3;
// A click on a tool row expands it, and the engine paints the row's container
// in the `userMessageBackgroundHover` theme color, full width. A Box paints
// its area as a run of spaces in its background color and draws its children
// over it; the painter styles only `ansi:`, `#hex`, `ansi256()` and `rgb()`
// strings and leaves any other unstyled. So a full-width Box in this
// "color" writes plain cells, which take the terminal's own background, over
// the engine's gray. The engine's bottom padding row is covered by an
// absolute Box one row below.
var PLAIN = 'plain';
var scheme = (0, claude_code_1.atom)({ plugin: 'message-panels', key: 'scheme' }, 'dark', { shape: 'scheme-1' });
/**
 * Light or dark, from the `theme` setting. `auto` follows the terminal's
 * background, which the mod API does not expose, so the mod reads the macOS
 * appearance instead. Where that read fails (not macOS), the palette is dark.
 */
function detectScheme($) {
    return __awaiter(this, void 0, void 0, function () {
        var row, value, _a, exitCode, stdout, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, $.config.list()];
                case 1:
                    row = (_c.sent()).find(function (r) { return r.key === 'theme'; });
                    value = typeof (row === null || row === void 0 ? void 0 : row.value) === 'string' ? row.value : 'auto';
                    if (value.startsWith('light'))
                        return [2 /*return*/, 'light'];
                    if (value.startsWith('dark'))
                        return [2 /*return*/, 'dark'];
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, $.process.run(['defaults', 'read', '-g', 'AppleInterfaceStyle'], { timeoutMs: 2000 })];
                case 3:
                    _a = _c.sent(), exitCode = _a.exitCode, stdout = _a.stdout;
                    return [2 /*return*/, exitCode === 0 && /dark/i.test(stdout) ? 'dark' : 'light'];
                case 4:
                    _b = _c.sent();
                    return [2 /*return*/, 'dark'];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/** Writes the scheme only when it changed, so an unchanged check redraws nothing. */
function refreshScheme($) {
    return __awaiter(this, void 0, void 0, function () {
        var next;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, detectScheme($)];
                case 1:
                    next = _a.sent();
                    return [4 /*yield*/, (0, claude_code_1.read)($, scheme)];
                case 2:
                    if (!((_a.sent()) !== next)) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, claude_code_1.update)($, scheme, function () { return next; })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
// How often the mod checks the scheme again. Under `auto`, the terminal can
// switch between light and dark with no event the mod sees.
var SCHEME_POLL_MS = 3000;
// The running check, cancelled before a reload starts another.
var schemePoll;
function palette($) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = PALETTES;
                    return [4 /*yield*/, (0, claude_code_1.read)($, scheme)];
                case 1: return [2 /*return*/, _a[_b.sent()]];
            }
        });
    });
}
var revealed = (0, claude_code_1.atom)({ plugin: 'message-panels', key: 'revealed' }, {}, { shape: 'revealed-1' });
// Tool rows whose chevron the person turned, by tool_use_id: true open, false
// closed. A row with no entry takes its view's default.
var opened = (0, claude_code_1.atom)({ plugin: 'message-panels', key: 'opened' }, {}, { shape: 'opened-1' });
// The `verbose` setting. The engine marks rows expanded alike under it and in
// the ctrl+o transcript, so the mod reads the setting to tell them apart.
var verbose = (0, claude_code_1.atom)({ plugin: 'message-panels', key: 'verbose' }, false, { shape: 'verbose-1' });
/** Writes the `verbose` setting only when it changed. */
function refreshVerbose($) {
    return __awaiter(this, void 0, void 0, function () {
        var row, next;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.config.list()];
                case 1:
                    row = (_a.sent()).find(function (r) { return r.key === 'verbose'; });
                    next = (row === null || row === void 0 ? void 0 : row.value) === true;
                    return [4 /*yield*/, (0, claude_code_1.read)($, verbose)];
                case 2:
                    if (!((_a.sent()) !== next)) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, claude_code_1.update)($, verbose, function () { return next; })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
function toggleOpened($, id, open) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.update)($, opened, function (held) {
                        var _a;
                        return (__assign(__assign({}, held), (_a = {}, _a[id] = !open, _a)));
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Summary rows show this many lines, the last cut with `…`.
var ASIDE_LINES = 3;
// Cells the row loses to the engine's bullet column and the panel's padding.
var ASIDE_INSET = 6;
/** Markdown reduced to plain words for a one-style line: markers dropped. */
function plainWords(markdown) {
    return oneLine(markdown
        .replace(/```[^\n]*\n?/g, ' ')
        .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\*\*|__|`/g, ''));
}
/** Words wrapped to `width` cells, at most `max` lines, the last ending in `…` when cut. */
function clampLines(text, width, max) {
    var _a;
    var lines = [];
    var line = '';
    for (var _i = 0, _b = text.split(' '); _i < _b.length; _i++) {
        var word = _b[_i];
        if (!line)
            line = word;
        else if (line.length + 1 + word.length <= width)
            line += " ".concat(word);
        else {
            lines.push(line);
            line = word;
            if (lines.length === max)
                break;
        }
    }
    if (lines.length < max && line)
        return __spreadArray(__spreadArray([], lines, true), [line], false);
    var last = (_a = lines[max - 1]) !== null && _a !== void 0 ? _a : '';
    var room = Math.max(1, width - 1);
    lines[max - 1] = (last.length > room ? last.slice(0, room) : last).trimEnd() + '…';
    return lines;
}
function toggleRevealed($, id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, claude_code_1.update)($, revealed, function (held) {
                        var _a;
                        return (__assign(__assign({}, held), (_a = {}, _a[id] = !held[id], _a)));
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function oneLine(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function truncate(value, width) {
    if (width < 2)
        return '';
    return value.length <= width ? value : value.slice(0, width - 1) + '…';
}
var KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description', 'prompt', 'skill'];
// Fields that hold a file path, drawn short and cut from the middle, and the
// one that holds a shell command, drawn with its programs in the text tone.
var PATH_KEYS = new Set(['file_path', 'path']);
var COMMAND_KEY = 'command';
/** The one input field a person would recognise the call by. */
function summarize(input) {
    if (!input || typeof input !== 'object')
        return { text: '', kind: 'other' };
    var record = input;
    for (var _i = 0, KEYS_1 = KEYS; _i < KEYS_1.length; _i++) {
        var key = KEYS_1[_i];
        var value = record[key];
        if (typeof value === 'string' && value.trim()) {
            return { text: oneLine(value), kind: PATH_KEYS.has(key) ? 'path' : key === COMMAND_KEY ? 'command' : 'other' };
        }
    }
    for (var _a = 0, _b = Object.values(record); _a < _b.length; _a++) {
        var value = _b[_a];
        if (typeof value === 'string' && value.trim())
            return { text: oneLine(value), kind: 'other' };
        // A list of labelled items (set_footer_links): its labels.
        if (Array.isArray(value) && value.length > 0 && value.every(function (v) { return v && typeof v === 'object' && typeof v.label === 'string'; })) {
            return { text: value.map(function (v) { return oneLine(v.label); }).join(', '), kind: 'other' };
        }
    }
    return { text: '', kind: 'other' };
}
/**
 * The call's one line as runs, cut to `width`. The head `› <tool> · ` is dim.
 * A path draws its stand-in prefix in the tag tone, its directories dim and
 * its file name in the text tone; a command draws each program in the text
 * tone and the rest dim; any other detail is dim.
 */
function labelRuns(tool, input, width, context) {
    var head = tool.startsWith('mcp__') ? tool.split('__').slice(2).join('__') || tool : tool;
    var detail = summarize(input);
    if (!detail.text)
        return [{ text: truncate(head, width), tone: 'dim' }];
    var room = width - head.length - 3;
    if (room < 2)
        return [{ text: truncate(head, width), tone: 'dim' }];
    var lead = { text: "".concat(head, " \u00B7 "), tone: 'dim' };
    if (detail.kind === 'path')
        return __spreadArray([lead], (0, paths_1.pathRuns)(detail.text, context, room), true);
    if (detail.kind === 'command')
        return __spreadArray([lead], (0, commands_1.commandRuns)(detail.text, context, room), true);
    return (0, commands_1.fitRuns)([lead, { text: detail.text, tone: 'dim' }], width);
}
/** A tool line's runs as Text elements: dim, the theme's text, or the tag color; all in `color` when the call failed. */
function toolLine(_a, runs, colors, failed, running) {
    var Text = _a.Text;
    var shown = running ? __spreadArray(__spreadArray([], runs, true), [{ text: ' …', tone: 'dim' }], false) : runs;
    return shown.map(function (run) {
        var color = failed ? colors.error : run.tone === 'tag' ? colors.tag : undefined;
        return (<Text color={color} dimColor={failed || run.tone !== 'text'} wrap="truncate-end">
        {run.text}
      </Text>);
    });
}
/** What a path is shortened against: the session's directory and the home directory. */
function pathContext($) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, cwd, home;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.all([$.session.cwd(), $.env.get('HOME')])];
                case 1:
                    _a = _b.sent(), cwd = _a[0], home = _a[1];
                    return [2 /*return*/, { cwd: cwd, home: home }];
            }
        });
    });
}
/**
 * How a panel draws its spacing, from the `fontCompat` option (`/config`).
 * Off (the default): half-block caps and edges, which take half a row where
 * whole rows take one. On: whole rows and cells only, so terminals and fonts
 * without Block Elements draw it the same.
 */
var fontCompat = false;
/** Copies a panel's text as the model or the person wrote it, Markdown and all. */
function copyText($, text, surface) {
    return __awaiter(this, void 0, void 0, function () {
        var copied;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.ui.copy({ text: text, surface: surface })];
                case 1:
                    copied = _a.sent();
                    $.ui.toast(copied.isCopied ? 'Copied' : 'Could not copy message');
                    return [2 /*return*/];
            }
        });
    });
}
// The copy target: 4 cells of the panel's top edge, ending one cell short of
// the fill's last column, so one cell of the edge always shows past it. At rest they draw as the edge does; under the pointer the
// word swaps in. A hover can restyle a label but not change its text, so the
// word is a second Button, drawn `display: none` until its keyed Box is hovered.
var COPY_LABEL = 'COPY';
var COPY_INSET = 1;
function copyCell(_a, color, rest, copy) {
    var Box = _a.Box, Text = _a.Text, Button = _a.Button;
    return (<Box key="copy-cell" width={COPY_LABEL.length} height={1} flexShrink={0}>
      <Button key="copy" plain onPress={copy}>
        <Text color={color} backgroundColor={rest.fill}>{rest.text}</Text>
      </Button>
      <Box position="absolute" top={0} left={0} display="none" hover={{ display: 'flex' }}>
        <Button key="copy-label" plain onPress={copy}>
          <Text bold backgroundColor={color}>{COPY_LABEL}</Text>
        </Button>
      </Box>
    </Box>);
}
/**
 * A panel in the spacing mode in use; `gap` is `gapAbove`, which compact
 * ignores. With `copy`, the panel's top-right cell is a Button that copies it.
 */
function panel(elements, color, body, gap, copy) {
    return fontCompat ? compatPanel(elements, color, body, gap, copy) : compactPanel(elements, color, body, copy);
}
/**
 * Compat: a fill inset one cell from each side of the row (the terminal's
 * background shows there), with one cell of fill beside the text, one row of
 * fill above and below it (padding), and one blank row outside it (gap).
 * The panel takes its gap below, and above only when the row before it is
 * not a panel (gapAbove), so two panels in a row share one blank row. A tool
 * line or the turn line under a panel needs no gap of its own.
 */
function compatPanel(_a, color, body, gap, copy) {
    var Box = _a.Box, Text = _a.Text, Button = _a.Button;
    // The copy cells sit in the fill's top padding row, one cell in from its end.
    return (<Box flexDirection="column" marginTop={gap} marginBottom={1}>
      <Box backgroundColor={color} marginX={1} paddingX={1} paddingY={1} flexDirection="column">
        {body}
        {copy && (<Box position="absolute" top={0} right={COPY_INSET}>
            {copyCell({ Box: Box, Text: Text, Button: Button }, color, { text: ' '.repeat(COPY_LABEL.length), fill: color }, copy)}
          </Box>)}
      </Box>
    </Box>);
}
// Compact: a column of half blocks, taller than any panel. The outer Box's
// overflow clips it to the panel's height: an absolute Box does not clip
// itself.
var LEFT_EDGE = '▐\n'.repeat(500);
var RIGHT_EDGE = '▌\n'.repeat(500);
// The bar beside pasted text: a column of box-drawing lines, clipped by its
// parent to the paste's height, as the panel's edges are.
var QUOTE_BAR = '│\n'.repeat(500);
/**
 * A user panel's body: typed text as written, and each paste as a quote
 * block, a bar down its left side and its text dim, one blank row between.
 */
function promptBody(_a, colors, text) {
    var Box = _a.Box, Text = _a.Text;
    return (<Box flexDirection="column">
      {(0, paste_1.segments)(text).map(function (segment, i) {
            var kind = segment.kind, words = segment.text;
            if (kind === 'typed') {
                return (<Box key={String(i)} marginTop={i > 0 ? 1 : 0}>
              <Text color={colors.userText}>{words}</Text>
            </Box>);
            }
            return (<Box key={String(i)} marginTop={i > 0 ? 1 : 0} paddingLeft={2} overflow="hidden">
            <Text color={colors.userText} dimColor>{words}</Text>
            <Box position="absolute" left={0} top={0} bottom={0} width={1}>
              <Text color={colors.quote}>{QUOTE_BAR}</Text>
            </Box>
          </Box>);
        })}
    </Box>);
}
// Compact: the panel's caps, half-height rows in the fill's color on the
// terminal's own background, in place of a full padding row. The top cap
// fills the lower half of its row, the bottom cap the upper half; each corner
// is the quadrant where a cap meets a side edge. The fill is wider than any
// panel and wraps; its Box is one row high and clips the rest.
var TOP_CAP = { left: '▗', fill: '▄'.repeat(500), right: '▖' };
var BOTTOM_CAP = { left: '▝', fill: '▀'.repeat(500), right: '▘' };
function cap(elements, color, glyphs, copy) {
    var Box = elements.Box, Text = elements.Text;
    // With `copy`, 4 fill cells before the corner are the copy cells, and one
    // plain fill cell sits between them and the corner.
    return (<Box height={1} overflow="hidden">
      <Text color={color}>{glyphs.left}</Text>
      <Box flexGrow={1} flexShrink={1} height={1} overflow="hidden">
        <Text color={color}>{glyphs.fill}</Text>
      </Box>
      {copy && copyCell(elements, color, { text: glyphs.fill.slice(0, COPY_LABEL.length) }, copy)}
      {copy && <Text color={color}>{glyphs.fill.slice(0, COPY_INSET)}</Text>}
      <Text color={color}>{glyphs.right}</Text>
    </Box>);
}
/**
 * Compact: pi's half-bleed panel, a fill inset one cell with half-block ends
 * in the fill's color, capped above and below by a half-height row. The caps
 * are the panel's whole spacing: it takes no blank row above or below. Two
 * panels in a row leave one row of the terminal's background between their
 * fills, and a tool line sits half a row from a fill.
 */
function compactPanel(elements, color, body, copy) {
    var Box = elements.Box, Text = elements.Text;
    // The bottom cap sits outside the clipping Box: the edge columns run past
    // their own Box's bottom, and only the parent's overflow cuts them off.
    return (<Box flexDirection="column">
      <Box flexDirection="column" overflow="hidden">
        {cap(elements, color, TOP_CAP, copy)}
        <Box backgroundColor={color} marginX={1} paddingX={1} flexDirection="column">
          {body}
        </Box>
        <Box position="absolute" left={0} top={1} bottom={0} width={1}>
          <Text color={color}>{LEFT_EDGE}</Text>
        </Box>
        <Box position="absolute" right={0} top={1} bottom={0} width={1}>
          <Text color={color}>{RIGHT_EDGE}</Text>
        </Box>
      </Box>
      {cap(elements, color, BOTTOM_CAP)}
    </Box>);
}
// The kind of the visible row before each message row, by the row's uuid,
// which is the `requestId` the row renders under; and the kind of the last
// visible row stored, for a prompt still drawn under `placeholder` before its
// row is appended. Rows a `--resume` loads are never appended, so they are
// absent and take a gap above.
var rowBefore = new Map();
var lastRow = 'line';
// Doors whose rows draw nothing: the engine's injected context, a tool's
// result (the ToolUse row above draws it), a queue record.
var HIDDEN_DOORS = new Set(['attachment', 'hook-context', 'tool-result', 'queue']);
/** The kinds of the visible rows a stored row draws, in order; none for a hidden row. */
function rowKinds(row) {
    if (HIDDEN_DOORS.has(row.door) || row.message.isMeta)
        return [];
    var blocks = row.message.content;
    if (row.door === 'prompt') {
        var text = blocks.map(function (b) { return (typeof b.text === 'string' ? b.text : ''); }).join('\n');
        return [row.origin.kind === 'composer' && commandEcho({ text: text }) === null ? 'panel' : 'line'];
    }
    if (row.door === 'response') {
        var kinds = [];
        for (var _i = 0, blocks_2 = blocks; _i < blocks_2.length; _i++) {
            var block = blocks_2[_i];
            if (block.type === 'text' && typeof block.text === 'string' && block.text.trim())
                kinds.push('panel');
            if (block.type === 'tool_use')
                kinds.push('line');
        }
        return kinds;
    }
    return ['line'];
}
/** Records a stored row's place among the visible rows. */
function noteRow(row) {
    var last = rowKinds(row).at(-1);
    if (!last)
        return;
    rowBefore.set(row.uuid, lastRow);
    lastRow = last;
}
/** No gap above a panel that follows another panel, whose gap below is enough; one otherwise. */
function gapAbove(requestId) {
    var _a;
    var before = (_a = rowBefore.get(requestId)) !== null && _a !== void 0 ? _a : (requestId === 'placeholder' ? lastRow : 'line');
    return before === 'panel' ? 0 : 1;
}
/**
 * A slash command's echo, as the engine stores it: `<command-name>/model</command-name>`
 * with `<command-args>`, under an origin it does not always stamp. Returns the
 * line to draw (`/model args`), or null for any other user row.
 */
function commandEcho(props) {
    var _a, _b, _c, _d, _e;
    if (props.task || props.from)
        return null;
    var text = props.text.trim();
    var name = (_b = (_a = /<command-name>([^<]*)<\/command-name>/.exec(text)) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.trim();
    if (name) {
        var args = (_e = (_d = (_c = /<command-args>([^<]*)<\/command-args>/.exec(text)) === null || _c === void 0 ? void 0 : _c[1]) === null || _d === void 0 ? void 0 : _d.trim()) !== null && _e !== void 0 ? _e : '';
        return args ? "".concat(name, " ").concat(args) : name;
    }
    return /^\/[a-z][\w:-]*(\s|$)/i.test(text) && !text.includes('\n') ? text : null;
}
/** The turn's duration as the engine's line formats it: `3s`, `1m 4s`, `1h 2m`. */
function duration(ms) {
    var total = Math.round(ms / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var sec = total % 60;
    if (h > 0)
        return "".concat(h, "h ").concat(m, "m");
    if (m > 0)
        return "".concat(m, "m ").concat(sec, "s");
    return "".concat(sec, "s");
}
// The clock of each turn's closing line, stamped on its first draw so a
// redraw (a resize) keeps the time the turn ended.
var doneClocks = new Map();
function doneAt(requestId) {
    var clock = doneClocks.get(requestId);
    if (!clock) {
        clock = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        doneClocks.set(requestId, clock);
    }
    return clock;
}
/**
 * The blocks as elements. Plain lines draw as Text, dim unless colored, in
 * `color` when the block is input. A code block draws through `Code`, which
 * highlights it and, under `format: 'diff'`, draws the patch's own gutters
 * and markers. Lines wrap when `open`, else cut at the edge.
 */
function blockElements(_a, blocks, open, color) {
    var Text = _a.Text, Code = _a.Code;
    var wrap = open ? 'wrap' : 'truncate-end';
    return blocks.map(function (block) {
        if (block.kind === 'code') {
            var _a = block.code, source = _a.source, language = _a.language, path = _a.path, format = _a.format, startLine = _a.startLine;
            return <Code source={source || ' '} language={language} path={path} format={format} startLine={startLine} wrap={wrap}/>;
        }
        return block.lines.map(function (line) {
            var _a;
            return (<Text dimColor={!line.color && !color} color={(_a = line.color) !== null && _a !== void 0 ? _a : color} wrap={wrap}>{line.text}</Text>);
        });
    });
}
/** The call's file, for the highlighter: a Read's, an Edit's or a Write's. */
function inputPath(input) {
    var path = input === null || input === void 0 ? void 0 : input.file_path;
    return typeof path === 'string' ? path : undefined;
}
/** Whether the tree holds the engine's own drawing anywhere. */
function holdsEngine(node) {
    var _a;
    if (!node || typeof node !== 'object')
        return false;
    var element = node;
    return element.type === 'engine' || ((_a = element.children) !== null && _a !== void 0 ? _a : []).some(holdsEngine);
}
/**
 * One tool call: a line headed by a chevron, and under it, when open, the
 * input and output. The ctrl+o transcript (`transcript`) shows every row open
 * with the longer preview and a fixed `▾`. Elsewhere the chevron is a button:
 * a row starts open under the `verbose` setting, else closed, and the person's
 * turn of it wins. A failed call marks its line with a bright `✗` after the
 * chevron, so it stands out while closed. An open row there shows `PREVIEW`
 * lines in all; `n more lines` reveals the rest in either view.
 */
function drawCall($, elements, call, transcript, width) {
    return __awaiter(this, void 0, void 0, function () {
        var Box, Text, Button, failed, colors, context, id, held, _a, open, _b, _c, mark, badge, label, runs, head, full, _d, input, output, _e, inputShown, outputShown, hidden;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    Box = elements.Box, Text = elements.Text, Button = elements.Button;
                    failed = call.isErrored || call.isInterrupted;
                    return [4 /*yield*/, palette($)];
                case 1:
                    colors = _f.sent();
                    return [4 /*yield*/, pathContext($)];
                case 2:
                    context = _f.sent();
                    id = call.tool_use_id;
                    if (!(id === undefined)) return [3 /*break*/, 3];
                    _a = undefined;
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, (0, claude_code_1.read)($, opened)];
                case 4:
                    _a = (_f.sent())[id];
                    _f.label = 5;
                case 5:
                    held = _a;
                    _b = transcript;
                    if (_b) return [3 /*break*/, 9];
                    if (!(held !== null && held !== void 0)) return [3 /*break*/, 6];
                    _c = held;
                    return [3 /*break*/, 8];
                case 6: return [4 /*yield*/, (0, claude_code_1.read)($, verbose)];
                case 7:
                    _c = (_f.sent());
                    _f.label = 8;
                case 8:
                    _b = (_c);
                    _f.label = 9;
                case 9:
                    open = _b;
                    mark = "".concat(open ? '▾' : '▸', " ");
                    badge = failed ? '✗ ' : '';
                    label = labelRuns(call.tool, call.input, width - mark.length - badge.length, context);
                    runs = toolLine(elements, __spreadArray([{ text: mark, tone: 'dim' }], label, true), colors, failed, call.isRunning);
                    if (failed)
                        runs.splice(1, 0, <Text color={colors.error} bold>{badge}</Text>);
                    head = transcript || id === undefined ? (<Box>{runs}</Box>) : (<Box>
        <Button key={"fold-".concat(id)} label={"".concat(open ? 'Close' : 'Open', " ").concat(call.tool)} plain onPress={function () { return toggleOpened($, id, open); }}>
          {runs}
        </Button>
      </Box>);
                    if (!open)
                        return [2 /*return*/, <Box paddingLeft={1}>{head}</Box>];
                    _d = id !== undefined;
                    if (!_d) return [3 /*break*/, 11];
                    return [4 /*yield*/, (0, claude_code_1.read)($, revealed)];
                case 10:
                    _d = (_f.sent())[id] === true;
                    _f.label = 11;
                case 11:
                    full = _d;
                    input = (0, blocks_1.inputBlocks)(call.tool, call.input);
                    output = call.output === undefined ? [] : (0, blocks_1.outputBlocks)(call.output, failed, colors, inputPath(call.input));
                    _e = full
                        ? [input, output]
                        : transcript
                            ? [(0, blocks_1.cutBlocks)(input, INPUT_PREVIEW), (0, blocks_1.cutBlocks)(output, OUTPUT_PREVIEW)]
                            : (0, blocks_1.cutPair)(input, output, PREVIEW, PREVIEW_INPUT_MAX), inputShown = _e[0], outputShown = _e[1];
                    hidden = (0, blocks_1.countLines)(input) - (0, blocks_1.countLines)(inputShown) + (0, blocks_1.countLines)(output) - (0, blocks_1.countLines)(outputShown);
                    return [2 /*return*/, (<Box flexDirection="column" width="100%" backgroundColor={PLAIN} paddingLeft={1} paddingRight={2}>
      {head}
      <Box position="absolute" left={0} bottom={-1} height={1} width="100%" backgroundColor={PLAIN}/>
      <Box flexDirection="column" paddingLeft={2}>
        {blockElements(elements, inputShown, full, colors.tag)}
        {blockElements(elements, outputShown, full)}
        {id !== undefined && (hidden > 0 || full) ? (<Button key={"reveal-".concat(id)} plain onPress={function () { return toggleRevealed($, id); }}>
            <Text color={colors.tag}>{full ? '▴ less' : "\u2026 ".concat(hidden, " more lines")}</Text>
          </Button>) : null}
      </Box>
    </Box>)];
            }
        });
    });
}
var register = function (on, options) {
    fontCompat = options.fontCompat === true;
    // The palette follows the theme: read at start and on every reload, again
    // when the person changes the theme, and every few seconds for `auto`.
    on('session.start', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    result = _a.sent();
                    return [4 /*yield*/, refreshScheme($)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, refreshVerbose($)];
                case 3:
                    _a.sent();
                    schemePoll === null || schemePoll === void 0 ? void 0 : schemePoll.cancel();
                    schemePoll = $.clock.every(SCHEME_POLL_MS, function () { return refreshScheme($); });
                    return [2 /*return*/, result];
            }
        });
    }); });
    on('config.set', { key: 'theme' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    result = _a.sent();
                    return [4 /*yield*/, refreshScheme($)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, result];
            }
        });
    }); });
    on('config.set', { key: 'verbose' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, next(e)];
                case 1:
                    result = _a.sent();
                    return [4 /*yield*/, refreshVerbose($)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, result];
            }
        });
    }); });
    // Every row the conversation keeps passes here before it is stored, so a
    // message row finds its place in the table by the time it draws.
    on('session.append', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            noteRow(e);
            return [2 /*return*/, next(e)];
        });
    }); });
    // The body is another mod's tree where one beneath drew one (code-brackets),
    // else Markdown from the text: the engine's row adds the ⏺ bullet, its indent
    // column and a top margin, and may not sit under `overflow`. A summary block
    // (text between tool calls, condensed) draws as an aside: plain words, dim
    // and italic, at most 3 lines. ctrl+o still shows the full text.
    on('ui.render', { component: 'AssistantMessage' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var elements, colors, width, lines, body_1, drawn, body, text;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (e.surface !== 'terminal')
                        return [2 /*return*/, next(e)];
                    elements = $.ui.resolve(e);
                    return [4 /*yield*/, palette($)];
                case 1:
                    colors = _c.sent();
                    if (e.props.isSummary) {
                        width = Math.max(20, ((_b = (_a = e.viewport) === null || _a === void 0 ? void 0 : _a.columns) !== null && _b !== void 0 ? _b : 80) - ASIDE_INSET);
                        lines = clampLines(plainWords(e.props.text), width, ASIDE_LINES);
                        body_1 = (<elements.Box flexDirection="column">
          {lines.map(function (line, i) { return (<elements.Text key={String(i)} dimColor italic wrap="truncate-end">{line}</elements.Text>); })}
        </elements.Box>);
                        return [2 /*return*/, panel(elements, colors.assistant, body_1, gapAbove(e.requestId))];
                    }
                    return [4 /*yield*/, next(e)];
                case 2:
                    drawn = _c.sent();
                    body = holdsEngine(drawn) ? <elements.Markdown text={e.props.text}/> : drawn;
                    text = e.props.text;
                    return [2 /*return*/, panel(elements, colors.assistant, body, gapAbove(e.requestId), function (press) { return copyText($, text, press.surface); })];
            }
        });
    }); });
    // Drawn from the text, not wrapped: the engine's row paints its own gray.
    // A slash command's echo (`/model`, `/clear`) is a user row too, under an
    // origin the engine does not always stamp, so it is told by its text and
    // drawn as one dim line, as a tool call is, with its output beneath.
    on('ui.render', { component: 'UserMessage' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var elements, echo, colors, text, copy;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (e.surface !== 'terminal')
                        return [2 /*return*/, next(e)];
                    elements = $.ui.resolve(e);
                    echo = commandEcho(e.props);
                    if (echo !== null) {
                        return [2 /*return*/, (<elements.Box paddingLeft={1}>
          <elements.Text dimColor>› {oneLine(echo)}</elements.Text>
        </elements.Box>)];
                    }
                    if (e.props.origin.kind !== 'composer')
                        return [2 /*return*/, next(e)];
                    return [4 /*yield*/, palette($)];
                case 1:
                    colors = _a.sent();
                    text = e.props.text;
                    copy = function (press) { return copyText($, (0, paste_1.unwrapPastes)(text), press.surface); };
                    return [2 /*return*/, panel(elements, colors.user, promptBody(elements, colors, text), gapAbove(e.requestId), copy)];
            }
        });
    }); });
    // The line that closes a turn (`Baked for 3s · done 4:55 PM`) is the
    // engine's, drawn with a blank row above it and a `✻` glyph. The panel's
    // spacing already leaves room above it, so the mod draws the line itself:
    // dim, a `·` where a tool line has its `›`, text aligned with it, no blank row. The engine
    // keeps a line that waits on background agents.
    on('ui.render', { component: 'TurnDuration' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, Box, Text;
        return __generator(this, function (_b) {
            if (e.surface !== 'terminal' || e.props.waitingFor)
                return [2 /*return*/, next(e)];
            _a = $.ui.resolve(e), Box = _a.Box, Text = _a.Text;
            return [2 /*return*/, (<Box paddingLeft={1}>
        <Text dimColor>· {e.props.word} for {duration(e.props.durationMs)} · done {doneAt(e.requestId)}</Text>
      </Box>)];
        });
    }); });
    on('ui.render', { component: 'CommandOutput' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, Box, Text, Markdown, colors;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (e.surface !== 'terminal')
                        return [2 /*return*/, next(e)];
                    _a = $.ui.resolve(e), Box = _a.Box, Text = _a.Text, Markdown = _a.Markdown;
                    return [4 /*yield*/, palette($)];
                case 1:
                    colors = _b.sent();
                    return [2 /*return*/, (<Box paddingLeft={3} flexDirection="column">
        {e.props.isErrored ? <Text color={colors.error}>{e.props.text}</Text> : <Markdown text={e.props.text} dimColor/>}
      </Box>)];
            }
        });
    }); });
    // A tool call is a line headed by a chevron, drawn by `drawCall`. The row's
    // output comes from `p.output`, so the engine's own ToolResult row is hidden
    // on this surface. Expanded without the `verbose` setting is the ctrl+o
    // transcript (or `--verbose` given on the command line, which the setting
    // does not show), where every row is open.
    on('ui.render', { component: 'ToolUse' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var p, _a, Box, Text, Button, Code, width, transcript, _b;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    p = e.props;
                    if (e.surface !== 'terminal')
                        return [2 /*return*/, next(e)];
                    _a = $.ui.resolve(e), Box = _a.Box, Text = _a.Text, Button = _a.Button, Code = _a.Code;
                    width = ((_d = (_c = e.viewport) === null || _c === void 0 ? void 0 : _c.columns) !== null && _d !== void 0 ? _d : 100) - 4;
                    _b = p.isExpanded === true;
                    if (!_b) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, claude_code_1.read)($, verbose)];
                case 1:
                    _b = !(_e.sent());
                    _e.label = 2;
                case 2:
                    transcript = _b;
                    return [2 /*return*/, drawCall($, { Box: Box, Text: Text, Button: Button, Code: Code }, p, transcript, width)];
            }
        });
    }); });
    // The ToolUse row above draws the output itself, in every view.
    on('ui.render', { component: 'ToolResult' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var Box;
        return __generator(this, function (_a) {
            if (e.surface !== 'terminal')
                return [2 /*return*/, next(e)];
            Box = $.ui.resolve(e).Box;
            return [2 /*return*/, <Box display="none"/>];
        });
    }); });
    // A group of calls draws each call as its own chevron row. `isCallsOnly` is
    // false when a call errored or was interrupted, and also when the group holds
    // other rows (recalled memory, hook timing). A failed call explains the first
    // case, so the group still draws its own rows, the failed one marked `✗`
    // and in the error color. Otherwise the engine's line stays, pulled up over its blank row.
    on('ui.render', { component: 'ToolGroup' }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var p, _a, Box, Text, Button, Code, failed, width, rows;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    p = e.props;
                    if (e.surface !== 'terminal' || p.isExpanded)
                        return [2 /*return*/, next(e)];
                    _a = $.ui.resolve(e), Box = _a.Box, Text = _a.Text, Button = _a.Button, Code = _a.Code;
                    failed = p.calls.some(function (call) { return call.isErrored || call.isInterrupted; });
                    if (!(p.isCallsOnly !== true && !failed)) return [3 /*break*/, 2];
                    return [4 /*yield*/, next(e)];
                case 1: return [2 /*return*/, <Box marginTop={-1}>{_d.sent()}</Box>];
                case 2:
                    width = ((_c = (_b = e.viewport) === null || _b === void 0 ? void 0 : _b.columns) !== null && _c !== void 0 ? _c : 100) - 4;
                    return [4 /*yield*/, Promise.all(p.calls.map(function (call) { return drawCall($, { Box: Box, Text: Text, Button: Button, Code: Code }, call, false, width); }))];
                case 3:
                    rows = _d.sent();
                    return [2 /*return*/, <Box flexDirection="column">{rows}</Box>];
            }
        });
    }); });
};
exports.register = register;
