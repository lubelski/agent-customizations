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
Object.defineProperty(exports, "__esModule", { value: true });
var testing_1 = require("claude-code/testing");
var paths_ts_1 = require("../hooks/paths.ts");
var repo = '/Users/me/dev/mercury-web';
var context = { cwd: repo, home: '/Users/me' };
(0, testing_1.test)('a worktree file reads as the worktree name and its path', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, paths_ts_1.shortenPath)("".concat(repo, "/.claude/worktrees/pool-06/src/index.tsx"), context)).toBe('pool-06 - src/index.tsx');
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('inside the worktree it runs in, the session shows the relative path', function () { return __awaiter(void 0, void 0, void 0, function () {
    var cwd;
    return __generator(this, function (_a) {
        cwd = "".concat(repo, "/.claude/worktrees/pool-06");
        (0, testing_1.expect)((0, paths_ts_1.shortenPath)("".concat(cwd, "/src/index.tsx"), __assign(__assign({}, context), { cwd: cwd }))).toBe('src/index.tsx');
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('beneath the session directory, then beneath home', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, paths_ts_1.shortenPath)("".concat(repo, "/src/a.ts"), context)).toBe('src/a.ts');
        (0, testing_1.expect)((0, paths_ts_1.shortenPath)('/Users/me/.claude/CLAUDE.md', context)).toBe('~/.claude/CLAUDE.md');
        (0, testing_1.expect)((0, paths_ts_1.shortenPath)('/Users/me-two/x', context)).toBe('/Users/me-two/x');
        (0, testing_1.expect)((0, paths_ts_1.shortenPath)('/etc/hosts', { cwd: repo, home: undefined })).toBe('/etc/hosts');
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('a wide path drops directories from its middle', function () { return __awaiter(void 0, void 0, void 0, function () {
    var path;
    return __generator(this, function (_a) {
        path = 'pool-06 - src/pages/Settings/ActivityLog/components/ActivityLogTimeline/styles.module.css';
        (0, testing_1.expect)((0, paths_ts_1.fitPath)(path, 200)).toBe(path);
        (0, testing_1.expect)((0, paths_ts_1.fitPath)(path, 64)).toBe('pool-06 - src/…/components/ActivityLogTimeline/styles.module.css');
        (0, testing_1.expect)((0, paths_ts_1.fitPath)(path, 60)).toBe('pool-06 - src/…/ActivityLogTimeline/styles.module.css');
        (0, testing_1.expect)((0, paths_ts_1.fitPath)(path, 40)).toBe('pool-06 - src/…/styles.module.css');
        (0, testing_1.expect)((0, paths_ts_1.fitPath)(path, 22)).toBe('…/styles.module.css');
        (0, testing_1.expect)((0, paths_ts_1.fitPath)(path, 10)).toBe('pool-06 -…');
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('a path draws its stand-in prefix tagged, directories dim and the file name in text', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, paths_ts_1.pathRuns)("".concat(repo, "/.claude/worktrees/pool-06/src/index.tsx"), context, 80)).toEqual([
            { text: 'pool-06', tone: 'tag' },
            { text: ' - src/', tone: 'dim' },
            { text: 'index.tsx', tone: 'text' },
        ]);
        (0, testing_1.expect)((0, paths_ts_1.pathRuns)('/Users/me/notes.md', context, 80)).toEqual([
            { text: '~', tone: 'tag' },
            { text: '/', tone: 'dim' },
            { text: 'notes.md', tone: 'text' },
        ]);
        (0, testing_1.expect)((0, paths_ts_1.pathRuns)('/Users/me', context, 80)).toEqual([{ text: '~', tone: 'tag' }]);
        (0, testing_1.expect)((0, paths_ts_1.pathRuns)("".concat(repo, "/src/a.ts"), context, 80)).toEqual([{ text: 'src/', tone: 'dim' }, { text: 'a.ts', tone: 'text' }]);
        (0, testing_1.expect)((0, paths_ts_1.pathRuns)('README.md', context, 80)).toEqual([{ text: 'README.md', tone: 'text' }]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('a literal ~ the model wrote is not a stand-in', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, paths_ts_1.pathRuns)('~/notes.md', context, 80)).toEqual([{ text: '~/', tone: 'dim' }, { text: 'notes.md', tone: 'text' }]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('a cut path keeps its tones; one cut past its prefix draws dim to the name', function () { return __awaiter(void 0, void 0, void 0, function () {
    var path;
    return __generator(this, function (_a) {
        path = "".concat(repo, "/.claude/worktrees/pool-06/src/pages/Settings/ActivityLog/styles.module.css");
        (0, testing_1.expect)((0, paths_ts_1.pathRuns)(path, context, 40)).toEqual([
            { text: 'pool-06', tone: 'tag' },
            { text: ' - src/…/', tone: 'dim' },
            { text: 'styles.module.css', tone: 'text' },
        ]);
        (0, testing_1.expect)((0, paths_ts_1.pathRuns)(path, context, 22)).toEqual([{ text: '…/', tone: 'dim' }, { text: 'styles.module.css', tone: 'text' }]);
        (0, testing_1.expect)((0, paths_ts_1.pathRuns)(path, context, 10)).toEqual([{ text: 'pool-06 -…', tone: 'dim' }]);
        return [2 /*return*/];
    });
}); });
