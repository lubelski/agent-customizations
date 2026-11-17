"use strict";
// A Bash call's line shows its command. Two things make the command hard to
// read at a glance: absolute paths, which the mod shortens as it does a
// path field, and the flags and arguments around each program's name. The
// line draws each stage's program in the text tone and the rest dim, so
// `cd claude/mods && cat hooks/paths.ts` reads as `cd` and `cat`.
Object.defineProperty(exports, "__esModule", { value: true });
exports.fitRuns = exports.commandRuns = exports.shortenCommand = void 0;
var paths_1 = require("./paths");
// An absolute path inside a command: from a `/` at a word's start to the
// next space, quote or shell punctuation.
var ABSOLUTE = /(^|[\s='"`:(])(\/[^\s'"`;|&()<>]+)/g;
// A word that ends one stage of a pipeline and starts another.
var OPERATORS = new Set(['&&', '||', '|', ';', '(', '$(', '{']);
// A leading `FOO=bar` before a program, or a word that runs another program.
var PRELUDE = /^[A-Za-z_][A-Za-z0-9_]*=/;
var RUNNERS = new Set(['sudo', 'env', 'time', 'exec', 'nohup', 'xargs']);
/** The command with each absolute path shortened as a path field is. */
var shortenCommand = function (command, context) {
    return command.replace(ABSOLUTE, function (_, lead, path) { return lead + (0, paths_1.shortenPath)(path, context); });
};
exports.shortenCommand = shortenCommand;
/**
 * The one-line command as runs: each stage's program in the text tone, its
 * flags, arguments and the operators between stages dim. A word that only
 * sets a variable or hands off to another program (`sudo`, `env`) stays dim,
 * so the program it runs is the one in the text tone.
 */
var commandRuns = function (command, context, width) {
    var shortened = (0, exports.shortenCommand)(command, context);
    var runs = [];
    var expectProgram = true;
    for (var _i = 0, _a = shortened.split(/(\s+)/); _i < _a.length; _i++) {
        var word = _a[_i];
        if (!word)
            continue;
        if (/^\s+$/.test(word)) {
            runs.push({ text: word, tone: 'dim' });
            continue;
        }
        var isProgram = expectProgram && !PRELUDE.test(word) && !RUNNERS.has(word) && !OPERATORS.has(word);
        runs.push({ text: word, tone: isProgram ? 'text' : 'dim' });
        if (isProgram)
            expectProgram = false;
        // `rm dist;` ends its stage as `;` alone does.
        if (OPERATORS.has(word) || word.endsWith(';'))
            expectProgram = true;
    }
    return (0, exports.fitRuns)(runs, width);
};
exports.commandRuns = commandRuns;
/** The runs cut to `width` columns, the last kept one ending in `…`. */
var fitRuns = function (runs, width) {
    var total = runs.reduce(function (sum, run) { return sum + run.text.length; }, 0);
    if (total <= width)
        return runs;
    if (width < 2)
        return [];
    var out = [];
    var room = width - 1;
    for (var _i = 0, runs_1 = runs; _i < runs_1.length; _i++) {
        var run = runs_1[_i];
        if (run.text.length <= room) {
            out.push(run);
            room -= run.text.length;
            continue;
        }
        if (room > 0)
            out.push({ text: run.text.slice(0, room), tone: run.tone });
        break;
    }
    var last = out[out.length - 1];
    if (last)
        last.text += '…';
    else
        out.push({ text: '…', tone: 'dim' });
    return out;
};
exports.fitRuns = fitRuns;
