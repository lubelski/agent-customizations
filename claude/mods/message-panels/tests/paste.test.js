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
var paste_ts_1 = require("../hooks/paste.ts");
var prompt = '\n\n<pasted_content id="ca06">\nUnknown owner on line 103\n  indented\n</pasted_content id="ca06">\n\n\ntrack down the owners';
(0, testing_1.test)('a paste splits from the typed text around it', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, paste_ts_1.segments)(prompt)).toEqual([
            { kind: 'pasted', text: 'Unknown owner on line 103\n  indented' },
            { kind: 'typed', text: 'track down the owners' },
        ]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('the space typed after a paste is dropped', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, paste_ts_1.segments)('<pasted_content id="a">  code</pasted_content id="a"> why?')).toEqual([
            { kind: 'pasted', text: '  code' },
            { kind: 'typed', text: 'why?' },
        ]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('typed text with no paste is one segment', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, paste_ts_1.segments)('hello\nthere')).toEqual([{ kind: 'typed', text: 'hello\nthere' }]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('a closing tag must match its own id', function () { return __awaiter(void 0, void 0, void 0, function () {
    var text;
    return __generator(this, function (_a) {
        text = 'a <pasted_content id="x">one</pasted_content id="y"> b <pasted_content id="z">two</pasted_content id="z">';
        (0, testing_1.expect)((0, paste_ts_1.segments)(text)).toEqual([
            { kind: 'typed', text: 'a <pasted_content id="x">one</pasted_content id="y"> b' },
            { kind: 'pasted', text: 'two' },
        ]);
        return [2 /*return*/];
    });
}); });
(0, testing_1.test)('copy drops the tags and keeps the words', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        (0, testing_1.expect)((0, paste_ts_1.unwrapPastes)(prompt)).toBe('Unknown owner on line 103\n  indented\n\ntrack down the owners');
        return [2 /*return*/];
    });
}); });
