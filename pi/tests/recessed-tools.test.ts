import assert from "node:assert/strict";
import test from "node:test";
import { jiti, themeModule, tuiModule } from "./pi-runtime.ts";

test("completed tools are one row, with native details and accurate mouse expansion", async () => {
	const { default: extension, toolSummary, codemodeCalls } = await jiti.import("../lib/ui/tools.ts");
	const { default: halfBleed } = await jiti.import("../lib/ui/messages/panels.ts");
	const { ToolExecutionComponent } = await jiti.import("@earendil-works/pi-coding-agent");
	const { stripTerminalSequences, visibleWidth, Text } = tuiModule;
	themeModule.initTheme("dark");
	const handlers = new Map();
	const commands = new Map();
	const pi = { on: (name, handler) => handlers.set(name, handler), registerCommand: (name, command) => commands.set(name, command) };
	let renders = 0;
	const ui = { requestRender() { renders++; } };
	const ctx = { mode: "tui", ui: { get theme() { return themeModule.theme; }, setStatus() {} } };
	for (let reload = 0; reload < 3; reload++) {
		halfBleed(pi);
		extension(pi);
		handlers.get("session_start")({}, ctx);
		for (const definition of [undefined, { renderShell: "self", renderCall: () => new Text("native call", 0, 0), renderResult: () => new Text("native output", 0, 0) }]) {
			const tool = new ToolExecutionComponent("read", "id", { path: "/日本語/long-file.ts" }, {}, definition, ui);
			assert.deepEqual(tool.render(80).map(stripTerminalSequences), ["› read · /日本語/long-file.ts", "  │ ", "  └   \"path\": \"/日本語/long-file.ts\""], "pending tool is three rows");
			const result = { content: [{ type: "text", text: "line one\nline two\nline three" }], details: undefined, isError: false };
			tool.updateResult(result, true);
			assert.deepEqual(tool.render(80).map(stripTerminalSequences).at(-1), "  └ line three", "running tool tails its output");
			tool.updateResult(result, false);
			for (const width of [1, 4, 20, 80]) {
				const lines = tool.render(width);
				assert.equal(lines.length, 1, "completed summary only");
				assert.ok(lines.every(line => visibleWidth(line) <= width));
			}
			assert.equal(stripTerminalSequences(tool.render(80)[0]), "› read · /日本語/long-file.ts");
			assert.equal(tool.handleMouse({ type: "scroll", y: 0 }), undefined);
			assert.equal(tool.render(80).length, 1);
			assert.equal(tool.handleMouse({ type: "click", button: "left", y: 3 }), undefined);
			assert.deepEqual(tool.handleMouse({ type: "click", button: "left", y: 0 }), { handled: true });
			assert.ok(tool.render(80).length > 1);
			assert.match(tool.render(80).map(stripTerminalSequences).join("\n"), /native output|line three/);
			tool.setExpanded(false);
			assert.equal(tool.render(80).length, 1);
			tool.updateResult({ ...result, isError: true }, false);
			assert.match(stripTerminalSequences(tool.render(80)[0]), /^✗ read.*failed$/);
			// Image components must not bypass the summary path.
			tool.imageComponents = [{ render: () => ["image row", "image row"] }];
			assert.equal(tool.render(80).length, 1);
			assert.equal(result.content[0].text, "line one\nline two\nline three");
		}
	}
	assert.equal(renders, 6);
	const long = new ToolExecutionComponent("bash", "long", { command: "test" }, {}, undefined, ui);
	long.updateResult({ content: [{ type: "text", text: Array.from({ length: 100 }, (_, i) => `output ${i}`).join("\n") }] }, false);
	long.setExpanded(true); // Native Ctrl+O path is bounded too.
	let lines = long.render(80);
	assert.equal(lines.length, 12);
	assert.match(stripTerminalSequences(lines.at(-1)), /10 more.*show all/);
	assert.equal(long.handleMouse({ type: "click", button: "left", x: 0, y: 3 }), undefined);
	long.handleMouse({ type: "click", button: "left", x: 0, y: 11 });
	lines = long.render(80);
	assert.equal(lines.length, 22);
	await commands.get("tool-detail").handler("more", ctx);
	assert.equal(long.render(80).length, 32);
	long.handleMouse({ type: "click", button: "left", x: 40, y: 31 });
	assert.ok(long.render(80).length > 100);
	assert.match(long.render(80).map(stripTerminalSequences).join("\n"), /output 99/);
	long.handleMouse({ type: "click", button: "left", x: 0, y: 0 });
	assert.equal(long.render(80).length, 1);
	long.setExpanded(true);
	assert.equal(long.render(80).length, 12, "reopening resets the preview budget");
	for (const width of [1, 4, 20]) {
		assert.equal(long.render(width).length, 12);
		assert.ok(long.render(width).every(line => visibleWidth(line) <= width));
	}
	await commands.get("tool-detail").handler("collapse", ctx);
	assert.equal(long.render(80).length, 1);
	// Preview never executes image renderers, even after native expansion.
	long.imageComponents = [{ render() { assert.fail("image rendered in preview"); } }];
	long.setExpanded(true);
	assert.equal(long.render(80).length, 12);
	assert.equal(toolSummary("codemode", { code: "secret script" }, false), "› codemode");
	assert.deepEqual(codemodeCalls(`// tools.fake()
		const example = 'tools.fake()'; const regex = /tools.fake()/;
		await tools.read({}); await tools["read"]({});
		await Promise.all([tools.bash({}), tools.edit({}), tools.write({})]);
		await searchTools("x"); await describeTool("read"); await describeNamespace("ns");
		return tools[name]({});`), ["read ×2", "bash", "edit", "write", "searchTools", "describeTool", "describeNamespace"]);
	assert.deepEqual(codemodeCalls('return `tools.fake() ${await tools.read({})}`'), ["read"]);
	assert.deepEqual(codemodeCalls('tools[name]({}); const r = tools.read; other.tools.fake();'), []);
	assert.deepEqual(codemodeCalls('tools.read('), []);
	assert.deepEqual(codemodeCalls(undefined), []);
	assert.deepEqual(codemodeCalls(' '.repeat(100_001)), []);
	const scriptArgs = { code: 'tools.read({}); tools.read({}); tools.bash({}); tools.edit({}); tools.write({})' };
	assert.equal(toolSummary("codemode", scriptArgs, false), "› codemode · read ×2, bash, edit · +1 more");
	assert.equal(toolSummary("codemode", scriptArgs, false, 34), "› codemode · read ×2 · +3 more");
	scriptArgs.code = 'await describeTool("read")';
	assert.equal(toolSummary("codemode", scriptArgs, true), "✗ codemode · describeTool · failed");
	const codeTool = new ToolExecutionComponent("codemode", "code", scriptArgs, {}, undefined, ui);
	codeTool.updateResult({ content: [{ type: "text", text: "done" }] }, false);
	for (const width of [1, 12, 30, 80]) {
		const rendered = codeTool.render(width);
		assert.equal(rendered.length, 1);
		assert.ok(visibleWidth(rendered[0]) <= width);
	}
	assert.match(stripTerminalSequences(codeTool.render(80)[0]), /codemode · describeTool/);
	assert.equal(toolSummary("bash", { command: "echo\n\u001b[31mhello\tworld" }, false), "› bash · echo hello world");
	assert.equal(toolSummary("mcp__server__tool", {}, false), "› mcp__server__tool");
});

test("tool rows are indented two columns to align with message text", async () => {
	const { default: extension } = await jiti.import("../lib/ui/tools.ts");
	const { ToolExecutionComponent } = await jiti.import("@earendil-works/pi-coding-agent");
	const { stripTerminalSequences, visibleWidth } = tuiModule;
	themeModule.initTheme("dark");
	const handlers = new Map();
	const pi = { on: (name, handler) => handlers.set(name, handler), registerCommand() {} };
	let indent = true;
	extension(pi, () => indent);
	handlers.get("session_start")({}, { mode: "tui", ui: { get theme() { return themeModule.theme; }, setStatus() {} } });
	const tool = new ToolExecutionComponent("bash", "id", { command: "ls" }, {}, undefined, { requestRender() {} });
	tool.updateResult({ content: [{ type: "text", text: "a\nb" }], details: undefined, isError: false }, false);
	assert.equal(stripTerminalSequences(tool.render(80)[0]), "  › bash · ls");
	assert.equal(tool.render(80).length, 1);
	for (const width of [1, 2, 3, 4, 5, 6, 10]) {
		assert.ok(tool.render(width).every(line => visibleWidth(line) <= width));
	}
	tool.setExpanded(true);
	for (const line of tool.render(40)) {
		assert.ok(stripTerminalSequences(line).startsWith("  "));
		assert.ok(visibleWidth(line) <= 40);
	}
	indent = false;
	tool.setExpanded(false);
	assert.equal(stripTerminalSequences(tool.render(80)[0]), "› bash · ls");
	extension(pi);
});

test("streaming tools stay three rows, highlight the payload, and open on click", async () => {
	const { default: extension, streamingPayload } = await jiti.import("../lib/ui/tools.ts");
	const { ToolExecutionComponent } = await jiti.import("@earendil-works/pi-coding-agent");
	const { stripTerminalSequences, visibleWidth } = tuiModule;
	themeModule.initTheme("dark");
	const handlers = new Map();
	extension({ on: (name, handler) => handlers.set(name, handler), registerCommand() {} });
	handlers.get("session_start")({}, { mode: "tui", ui: { get theme() { return themeModule.theme; }, setStatus() {} } });
	let renders = 0;
	const args = { code: "" };
	const tool = new ToolExecutionComponent("codemode", "id", args, {}, undefined, { requestRender() { renders++; } });
	const plain = () => tool.render(60).map(stripTerminalSequences);
	assert.deepEqual(plain(), ["› codemode", "  │ ", "  └ "]);
	for (const chunk of ["const a = await tools.read({ path: 'x' });\n", "const b = 2;\n", "return [a, b];"]) {
		args.code += chunk;
		tool.updateArgs?.(args);
		assert.equal(plain().length, 3, "height is fixed while streaming");
	}
	assert.deepEqual(plain().slice(1), ["  │ const b = 2;", "  └ return [a, b];"]);
	assert.notEqual(tool.render(60)[1], stripTerminalSequences(tool.render(60)[1]), "payload is highlighted");
	assert.deepEqual(tool.handleMouse({ type: "click", button: "left", x: 0, y: 2, width: 60, height: 3 }), { handled: true });
	assert.equal(renders, 1);
	assert.deepEqual(plain(), ["› codemode · read", "  │ const a = await tools.read({ path: 'x' });", "  │ const b = 2;", "  └ return [a, b];"]);
	tool.handleMouse({ type: "click", button: "left", x: 0, y: 3, width: 60, height: 4 });
	assert.equal(plain().length, 3);
	for (const width of [3, 10, 40]) assert.ok(tool.render(width).every(line => visibleWidth(line) <= width));
	tool.updateResult({ content: [{ type: "text", text: "ok" }], isError: false }, false);
	assert.equal(tool.render(60).length, 1, "completion collapses to its summary");
	assert.equal(plain()[0], "› codemode · read");
	tool.handleMouse({ type: "click", button: "left", x: 0, y: 0, width: 60, height: 1 });
	assert.ok(tool.render(60).length > 1, "the heading opens a completed tool");
	const json = new ToolExecutionComponent("read", "id", { path: "a" }, {}, undefined, { requestRender() {} });
	assert.equal(stripTerminalSequences(json.render(60)[2]), '  └   "path": "a"', "tail skips lone brackets");
	assert.deepEqual(streamingPayload("write", { path: "a.py", content: "x = 1" }), { text: "x = 1", lang: "python" });
	assert.deepEqual(streamingPayload("bash", { command: "ls" }), { text: "ls", lang: "bash" });
	assert.equal(streamingPayload("edit", { path: "a.ts", edits: [{ oldText: "a", newText: "b" }] }).text, "b");
	assert.equal(streamingPayload("other", { q: 1 }).lang, "json");
});
