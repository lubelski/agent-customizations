"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var testing_1 = require("claude-code/testing");
var commands_ts_1 = require("../hooks/commands.ts");
var repo = '/Users/me/dev/mercury-web';
var context = { cwd: repo, home: '/Users/me' };
(0, testing_1.test)('absolute paths inside a command shorten as a path field does', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, commands_ts_1.shortenCommand)("cd ".concat(repo, "/.claude/worktrees/pool-06 && yarn test src/a.ts"), context)).toBe('cd pool-06 -  && yarn test src/a.ts');
        (0, testing_1.expect)((0, commands_ts_1.shortenCommand)("cat ".concat(repo, "/src/a.ts /Users/me/.claude/CLAUDE.md > /dev/null"), context)).toBe('cat src/a.ts ~/.claude/CLAUDE.md > /dev/null');
        (0, testing_1.expect)((0, commands_ts_1.shortenCommand)("grep -n x --repo=".concat(repo, "/pi \"").concat(repo, "/claude/x\""), context)).toBe('grep -n x --repo=pi "claude/x"');
        (0, testing_1.expect)((0, commands_ts_1.shortenCommand)('echo a/b 1/2', context)).toBe('echo a/b 1/2');
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('each stage draws its program in text and the rest dim', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, commands_ts_1.commandRuns)('git status --short | head -5', context, 80)).toEqual([
            { text: 'git', tone: 'text' }, { text: ' ', tone: 'dim' }, { text: 'status', tone: 'dim' }, { text: ' ', tone: 'dim' },
            { text: '--short', tone: 'dim' }, { text: ' ', tone: 'dim' }, { text: '|', tone: 'dim' }, { text: ' ', tone: 'dim' },
            { text: 'head', tone: 'text' }, { text: ' ', tone: 'dim' }, { text: '-5', tone: 'dim' },
        ]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('a variable or a runner before the program stays dim', function () { return __awaiter(void 0, void 0, void 0, function () {
    var programs;
    return __generator(this, function (_a) {
        programs = function (command) { return (0, commands_ts_1.commandRuns)(command, context, 80).filter(function (run) { return run.tone === 'text'; }).map(function (run) { return run.text; }); };
        (0, testing_1.expect)(programs('CI=1 yarn test && sudo rm -rf dist; env FOO=1 node x.js')).toEqual(['yarn', 'rm', 'node']);
        (0, testing_1.expect)(programs("cd ".concat(repo, "/pi && npm ci"))).toEqual(['cd', 'npm']);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('runs cut to width end in an ellipsis', function () { return __awaiter(void 0, void 0, void 0, function () {
    var runs;
    return __generator(this, function (_a) {
        runs = [{ text: 'git', tone: 'text' }, { text: ' ', tone: 'dim' }, { text: 'status', tone: 'dim' }];
        (0, testing_1.expect)((0, commands_ts_1.fitRuns)(runs, 80)).toEqual(runs);
        (0, testing_1.expect)((0, commands_ts_1.fitRuns)(runs, 7)).toEqual([{ text: 'git', tone: 'text' }, { text: ' ', tone: 'dim' }, { text: 'st…', tone: 'dim' }]);
        (0, testing_1.expect)((0, commands_ts_1.fitRuns)(runs, 4)).toEqual([{ text: 'git…', tone: 'text' }]);
        (0, testing_1.expect)((0, commands_ts_1.fitRuns)(runs, 1)).toEqual([]);
        return [2 /*return*/];
    });
}); });
