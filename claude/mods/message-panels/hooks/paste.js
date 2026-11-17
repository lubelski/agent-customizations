"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.segments = segments;
exports.unwrapPastes = unwrapPastes;
var PASTE = /<pasted_content id="([^"]*)">([\s\S]*?)<\/pasted_content id="\1">/g;
/**
 * Blank lines at either end dropped. A paste keeps the indentation of its
 * first line (code), typed text does not (the space typed after a paste).
 */
function trimSegment(kind, text) {
    return kind === 'pasted' ? text.replace(/^(\s*\n)+/, '').trimEnd() : text.trim();
}
/** The prompt split into typed and pasted segments, empty ones dropped. */
function segments(text) {
    var _a;
    var out = [];
    var push = function (kind, raw) {
        var trimmed = trimSegment(kind, raw);
        if (trimmed)
            out.push({ kind: kind, text: trimmed });
    };
    var at = 0;
    for (var _i = 0, _b = text.matchAll(PASTE); _i < _b.length; _i++) {
        var match = _b[_i];
        push('typed', text.slice(at, match.index));
        push('pasted', (_a = match[2]) !== null && _a !== void 0 ? _a : '');
        at = match.index + match[0].length;
    }
    push('typed', text.slice(at));
    return out;
}
/** The prompt as the person sees it: each paste's tags removed, its text kept. */
function unwrapPastes(text) {
    return segments(text)
        .map(function (s) { return s.text; })
        .join('\n\n');
}
