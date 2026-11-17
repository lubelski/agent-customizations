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
var blocks_ts_1 = require("../hooks/blocks.ts");
var colors = { error: 'red', tag: 'tag' };
(0, testing_1.test)('a Bash command is a code block; its other fields stay lines', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, blocks_ts_1.inputBlocks)('Bash', { command: 'git status\nls', description: 'Show status' })).toEqual([
            { kind: 'code', code: { source: 'git status\nls', language: 'bash' } },
            { kind: 'lines', lines: [{ text: 'description: Show status' }] },
        ]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('an Edit shows its path alone; its text is in the output patch', function () { return __awaiter(void 0, void 0, void 0, function () {
    var hunks;
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, blocks_ts_1.inputBlocks)('Edit', { file_path: '/a.ts', old_string: 'x', new_string: 'y' })).toEqual([
            { kind: 'lines', lines: [{ text: 'file_path: /a.ts' }] },
        ]);
        hunks = [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-x', '+y'] }];
        (0, testing_1.expect)((0, blocks_ts_1.outputBlocks)({ structuredPatch: hunks }, false, colors)).toEqual([
            { kind: 'code', code: { source: '@@ -1,1 +1,1 @@\n-x\n+y', format: 'diff' } },
        ]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)("a Read's content is code at the file's path, numbered from its first line", function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, blocks_ts_1.outputBlocks)({ file: { content: 'a\nb', startLine: 10 } }, false, colors, '/x.ts')).toEqual([
            { kind: 'code', code: { source: 'a\nb', path: '/x.ts', startLine: 10 } },
        ]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('stdout is dim lines and stderr is error lines', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, blocks_ts_1.outputBlocks)({ stdout: 'ok\n', stderr: 'bad' }, false, colors)).toEqual([
            { kind: 'lines', lines: [{ text: 'ok' }] },
            { kind: 'lines', lines: [{ text: 'bad', color: 'red' }] },
        ]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('a preview keeps whole blocks, then cuts one by lines, and the count stays exact', function () { return __awaiter(void 0, void 0, void 0, function () {
    var blocks, cut;
    return __generator(this, function (_a) {
        blocks = [
            { kind: 'lines', lines: [{ text: '1' }, { text: '2' }] },
            { kind: 'code', code: { source: 'a\nb\nc\nd', language: 'bash' } },
        ];
        (0, testing_1.expect)((0, blocks_ts_1.countLines)(blocks)).toBe(6);
        cut = (0, blocks_ts_1.cutBlocks)(blocks, 4);
        (0, testing_1.expect)(cut).toEqual([blocks[0], { kind: 'code', code: { source: 'a\nb', language: 'bash' } }]);
        (0, testing_1.expect)((0, blocks_ts_1.countLines)(cut)).toBe(4);
        (0, testing_1.expect)((0, blocks_ts_1.cutBlocks)(blocks, 0)).toEqual([]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('a cut diff rewrites its last hunk so it still parses', function () { return __awaiter(void 0, void 0, void 0, function () {
    var source;
    return __generator(this, function (_a) {
        source = (0, blocks_ts_1.diffSource)([
            { oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: [' a', '-b', '+c'] },
            { oldStart: 9, oldLines: 3, newStart: 9, newLines: 4, lines: [' x', '+y', ' z', '+w', ' q'] },
        ]);
        (0, testing_1.expect)((0, blocks_ts_1.cutDiff)(source, 8)).toBe('@@ -1,2 +1,2 @@\n a\n-b\n+c\n@@ -9,2 +9,3 @@\n x\n+y\n z');
        (0, testing_1.expect)((0, blocks_ts_1.cutDiff)(source, 2)).toBe('@@ -1,1 +1,1 @@\n a');
        (0, testing_1.expect)((0, blocks_ts_1.cutDiff)(source, 1)).toBe('@@ -1,0 +1,0 @@');
        return [2 /*return*/];
    });
}); });
var rows = function (n, prefix) { return [{ kind: 'lines', lines: Array.from({ length: n }, function (_, i) { return ({ text: "".concat(prefix).concat(i) }); }) }]; };
(0, testing_1.test)('a shared preview gives input at most its cap when output follows', function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, input, output;
    return __generator(this, function (_b) {
        _a = (0, blocks_ts_1.cutPair)(rows(5, 'i'), rows(20, 'o'), 7, 3), input = _a[0], output = _a[1];
        (0, testing_1.expect)((0, blocks_ts_1.countLines)(input)).toBe(3);
        (0, testing_1.expect)((0, blocks_ts_1.countLines)(output)).toBe(4);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('short output leaves its room to the input', function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, input, output;
    return __generator(this, function (_b) {
        _a = (0, blocks_ts_1.cutPair)(rows(5, 'i'), rows(1, 'o'), 7, 3), input = _a[0], output = _a[1];
        (0, testing_1.expect)((0, blocks_ts_1.countLines)(input)).toBe(5);
        (0, testing_1.expect)((0, blocks_ts_1.countLines)(output)).toBe(1);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('input alone takes the whole preview', function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, input, output;
    return __generator(this, function (_b) {
        _a = (0, blocks_ts_1.cutPair)(rows(10, 'i'), [], 7, 3), input = _a[0], output = _a[1];
        (0, testing_1.expect)((0, blocks_ts_1.countLines)(input)).toBe(7);
        (0, testing_1.expect)((0, blocks_ts_1.countLines)(output)).toBe(0);
        return [2 /*return*/];
    });
}); });
