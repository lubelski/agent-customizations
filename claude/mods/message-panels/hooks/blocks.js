"use strict";
// An expanded tool row lists the call's input, then its output. Each is a
// list of blocks: plain lines, or a source the row draws through the API's
// `Code` element, which highlights it as a reply's code fence is highlighted.
// A preview shows the first lines of the list, so a block is cut by lines
// before it is drawn, and a count of what was cut stays exact.
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
exports.cutPair = exports.cutBlocks = exports.cutDiff = exports.countLines = exports.outputBlocks = exports.diffSource = exports.inputBlocks = exports.splitLines = void 0;
var splitLines = function (value) {
    return value.replace(/\r\n?/g, '\n').replace(/\n$/, '').replace(/\t/g, '    ').split('\n');
};
exports.splitLines = splitLines;
var plain = function (value, color) { return ({ kind: 'lines', lines: (0, exports.splitLines)(value).map(function (text) { return ({ text: text, color: color }); }) }); };
var lines = function (lines) { return ({ kind: 'lines', lines: lines }); };
var code = function (code) { return ({ kind: 'code', code: code }); };
// Edit and Write carry their text in the output's patch, so their input
// shows the path and the flags alone.
var SHOWN_IN_OUTPUT = new Set(['old_string', 'new_string', 'content']);
// The input field drawn as code, by tool, with its language.
var CODE_INPUT = {
    Bash: { key: 'command', language: 'bash' },
};
/** The call's input as blocks: `key: value` lines, with a command drawn as code. */
var inputBlocks = function (tool, input) {
    if (typeof input === 'string')
        return [plain(input)];
    if (!input || typeof input !== 'object')
        return [];
    var blocks = [];
    var pending = [];
    var flush = function () {
        if (pending.length)
            blocks.push(lines(pending.splice(0)));
    };
    var asCode = CODE_INPUT[tool];
    for (var _i = 0, _a = Object.entries(input); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (value === undefined || value === null)
            continue;
        if ((tool === 'Edit' || tool === 'Write') && SHOWN_IN_OUTPUT.has(key))
            continue;
        if (typeof value === 'string') {
            if (asCode && key === asCode.key) {
                flush();
                blocks.push(code({ source: value, language: asCode.language }));
            }
            else if (value.includes('\n')) {
                pending.push.apply(pending, __spreadArray([{ text: "".concat(key, ":") }], (0, exports.splitLines)(value).map(function (l) { return ({ text: "  ".concat(l) }); }), false));
            }
            else {
                pending.push({ text: "".concat(key, ": ").concat(value) });
            }
        }
        else {
            pending.push({ text: "".concat(key, ": ").concat(JSON.stringify(value)) });
        }
    }
    flush();
    return blocks;
};
exports.inputBlocks = inputBlocks;
/** The hunks as a unified diff the `Code` element reads. */
var diffSource = function (hunks) {
    return hunks.map(function (hunk) { return __spreadArray(["@@ -".concat(hunk.oldStart, ",").concat(hunk.oldLines, " +").concat(hunk.newStart, ",").concat(hunk.newLines, " @@")], hunk.lines, true).join('\n'); }).join('\n');
};
exports.diffSource = diffSource;
/**
 * The call's result as blocks: Bash's stdout and stderr, a Read's content as
 * code numbered from its first line, an Edit's or Write's patch as a diff, a
 * plugin tool's text blocks, and JSON for anything else. An errored call's
 * result is the error text. `path` is the call's file, for the highlighter.
 */
var outputBlocks = function (output, errored, colors, path) {
    if (output === undefined || output === null)
        return [];
    if (typeof output === 'string')
        return [plain(output, errored ? colors.error : undefined)];
    if (Array.isArray(output)) {
        return output.map(function (block) {
            var b = block;
            if (b && typeof b.text === 'string')
                return plain(b.text);
            if (b && b.type === 'image')
                return lines([{ text: '[image]' }]);
            return plain(JSON.stringify(block));
        });
    }
    if (typeof output !== 'object')
        return [lines([{ text: String(output) }])];
    var r = output;
    if (typeof r.stdout === 'string' || typeof r.stderr === 'string') {
        var out = [];
        if (r.isImage)
            out.push(lines([{ text: '[image]' }]));
        else if (typeof r.stdout === 'string' && r.stdout.trim())
            out.push(plain(r.stdout));
        if (typeof r.stderr === 'string' && r.stderr.trim())
            out.push(plain(r.stderr, colors.error));
        if (typeof r.backgroundTaskId === 'string')
            out.push(lines([{ text: "running in background \u00B7 ".concat(r.backgroundTaskId), color: colors.tag }]));
        return out;
    }
    if (Array.isArray(r.structuredPatch) && r.structuredPatch.length > 0) {
        return [code({ source: (0, exports.diffSource)(r.structuredPatch), format: 'diff' })];
    }
    if (r.file && typeof r.file === 'object') {
        var file = r.file;
        if (typeof file.content === 'string') {
            var startLine = typeof file.startLine === 'number' ? file.startLine : 1;
            return [code({ source: file.content, path: path, startLine: startLine })];
        }
        if (typeof file.base64 === 'string')
            return [lines([{ text: "[".concat(typeof file.type === 'string' ? file.type : 'binary', "]") }])];
    }
    if (typeof r.content === 'string')
        return [plain(r.content)];
    if (Array.isArray(r.filenames))
        return [lines(r.filenames.map(function (f) { return ({ text: String(f) }); }))];
    if (typeof r.message === 'string')
        return [plain(r.message)];
    return [plain(JSON.stringify(output, null, 2))];
};
exports.outputBlocks = outputBlocks;
var sourceLines = function (source) { return source.replace(/\n$/, '').split('\n'); };
/** How many rows the blocks take drawn in full. */
var countLines = function (blocks) {
    return blocks.reduce(function (sum, block) { return sum + (block.kind === 'lines' ? block.lines.length : sourceLines(block.code.source).length); }, 0);
};
exports.countLines = countLines;
// A hunk header, whose counts the cut rewrites to what it kept.
var HEADER = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/;
/**
 * A diff cut to its first `limit` lines that still parses: the last hunk's
 * counts say how many old and new lines the cut kept.
 */
var cutDiff = function (source, limit) {
    var _a, _b;
    var kept = sourceLines(source).slice(0, limit);
    var header = -1;
    for (var i = kept.length - 1; i >= 0; i--) {
        if (HEADER.test((_a = kept[i]) !== null && _a !== void 0 ? _a : '')) {
            header = i;
            break;
        }
    }
    if (header < 0)
        return kept.join('\n');
    var body = kept.slice(header + 1);
    var old = body.filter(function (line) { return !line.startsWith('+'); }).length;
    var added = body.filter(function (line) { return !line.startsWith('-'); }).length;
    var match = HEADER.exec((_b = kept[header]) !== null && _b !== void 0 ? _b : '');
    if (match)
        kept[header] = "@@ -".concat(match[1], ",").concat(old, " +").concat(match[3], ",").concat(added, " @@");
    return kept.join('\n');
};
exports.cutDiff = cutDiff;
/** The blocks' first `limit` rows: whole blocks, then one cut by lines. */
var cutBlocks = function (blocks, limit) {
    var out = [];
    var room = limit;
    for (var _i = 0, blocks_1 = blocks; _i < blocks_1.length; _i++) {
        var block = blocks_1[_i];
        if (room <= 0)
            break;
        var count = block.kind === 'lines' ? block.lines.length : sourceLines(block.code.source).length;
        if (count <= room) {
            out.push(block);
            room -= count;
            continue;
        }
        if (block.kind === 'lines')
            out.push(lines(block.lines.slice(0, room)));
        else {
            var source = block.code.format === 'diff' ? (0, exports.cutDiff)(block.code.source, room) : sourceLines(block.code.source).slice(0, room).join('\n');
            out.push(code(__assign(__assign({}, block.code), { source: source })));
        }
        room = 0;
    }
    return out;
};
exports.cutBlocks = cutBlocks;
/**
 * Input and output cut to `total` rows between them: the input first, but at
 * most `inputMax` rows of it when output follows, and the output the rest.
 */
var cutPair = function (input, output, total, inputMax) {
    var inputRoom = Math.min((0, exports.countLines)(input), (0, exports.countLines)(output) > 0 ? Math.max(inputMax, total - (0, exports.countLines)(output)) : total, total);
    var inputShown = (0, exports.cutBlocks)(input, inputRoom);
    return [inputShown, (0, exports.cutBlocks)(output, total - (0, exports.countLines)(inputShown))];
};
exports.cutPair = cutPair;
