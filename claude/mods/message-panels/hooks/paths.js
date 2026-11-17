"use strict";
// A tool line names a file by its path. An absolute path spends most of the
// line on the directories every call shares, so the line shows a short form:
// a worktree's name, the session's directory or `~` stands for the leading
// part, and a path still too wide drops directories from its middle.
//
// The line then draws the short form in three tones, so the eye lands on the
// file: the stand-in prefix in the tag color, the directories dim, and the
// file's name in the text color.
Object.defineProperty(exports, "__esModule", { value: true });
exports.pathRuns = exports.fitPath = exports.shortenPath = void 0;
// A Claude Code worktree: `<repo>/.claude/worktrees/<name>/<rest>`.
var WORKTREE = /\/\.claude\/worktrees\/([^/]+)(?:\/(.*))?$/;
var within = function (path, dir) {
    var base = dir.replace(/\/+$/, '');
    if (!base)
        return null;
    if (path === base)
        return '.';
    return path.startsWith(base + '/') ? path.slice(base.length + 1) : null;
};
var shorten = function (path, context) {
    var cwd = context.cwd, home = context.home;
    if (!path.startsWith('/'))
        return { prefix: '', joint: '', rest: path };
    var worktree = WORKTREE.exec(path);
    var worktreeRoot = worktree ? "".concat(path.slice(0, worktree.index), "/.claude/worktrees/").concat(worktree[1]) : '';
    if (worktree && within(cwd, worktreeRoot) === null) {
        var name_1 = worktree[1], rest = worktree[2];
        return { prefix: name_1 !== null && name_1 !== void 0 ? name_1 : '', joint: ' - ', rest: rest !== null && rest !== void 0 ? rest : '' };
    }
    var relative = within(path, cwd);
    if (relative !== null)
        return { prefix: '', joint: '', rest: relative };
    var underHome = home ? within(path, home) : null;
    if (underHome !== null)
        return underHome === '.' ? { prefix: '~', joint: '', rest: '' } : { prefix: '~', joint: '/', rest: underHome };
    return { prefix: '', joint: '', rest: path };
};
/**
 * The path as a tool line shows it: `pool-06 - src/a.ts` for a file in the
 * worktree `pool-06`, `src/a.ts` beneath the session's directory, `~/notes.md`
 * beneath the home directory, and the path unchanged elsewhere.
 */
var shortenPath = function (path, context) {
    var _a = shorten(path, context), prefix = _a.prefix, joint = _a.joint, rest = _a.rest;
    return "".concat(prefix).concat(joint).concat(rest);
};
exports.shortenPath = shortenPath;
/**
 * The path cut to `width` columns. Directories leave from the middle first, so
 * the first segment and the file's name and parents stay:
 * `pool-06 - src/…/ActivityLogTimeline/styles.module.css`.
 */
var fitPath = function (path, width) {
    var _a;
    if (path.length <= width)
        return path;
    if (width < 2)
        return '';
    var segments = path.split('/');
    if (segments.length >= 3) {
        var first = segments[0];
        for (var kept = segments.length - 2; kept >= 1; kept--) {
            var tail = segments.slice(segments.length - kept).join('/');
            var withFirst = "".concat(first, "/\u2026/").concat(tail);
            if (withFirst.length <= width)
                return withFirst;
        }
        var name_2 = (_a = segments[segments.length - 1]) !== null && _a !== void 0 ? _a : '';
        if (name_2 && name_2.length + 2 <= width)
            return "\u2026/".concat(name_2);
    }
    return path.slice(0, width - 1) + '…';
};
exports.fitPath = fitPath;
/**
 * The short path, fitted, as runs: `pool-06` in the tag tone, ` - src/…/`
 * dim, `a.ts` in the text tone. A literal `~` the model wrote is not a
 * stand-in and stays dim. A path cut so short that its prefix is gone draws
 * dim up to the file's name.
 */
var pathRuns = function (path, context, width) {
    var short = shorten(path, context);
    var fitted = (0, exports.fitPath)("".concat(short.prefix).concat(short.joint).concat(short.rest), width);
    var runs = [];
    var body = fitted;
    if (short.prefix && fitted.startsWith(short.prefix + short.joint)) {
        runs.push({ text: short.prefix, tone: 'tag' });
        body = fitted.slice(short.prefix.length);
    }
    var cut = body.lastIndexOf('/');
    var dirs = cut >= 0 ? body.slice(0, cut + 1) : '';
    var name = cut >= 0 ? body.slice(cut + 1) : body;
    if (dirs)
        runs.push({ text: dirs, tone: 'dim' });
    if (name)
        runs.push({ text: name, tone: name.endsWith('…') && !dirs ? 'dim' : 'text' });
    return runs;
};
exports.pathRuns = pathRuns;
