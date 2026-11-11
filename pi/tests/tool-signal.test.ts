import assert from "node:assert/strict";
import test from "node:test";
import { jiti, themeModule, tuiModule } from "./pi-runtime.ts";

const { commandSignal, pathSignal, failureTail } = await jiti.import("../lib/ui/tool-signal.ts");
const { toolSummary, default: extension } = await jiti.import("../lib/ui/tools.ts");
const { ToolExecutionComponent } = await jiti.import("@earendil-works/pi-coding-agent");
const { stripTerminalSequences, visibleWidth } = tuiModule;
const paint = (tone, text) => text ? `<${tone}>${text}</${tone}>` : "";
const home = text => `<home>${text}</home>`;

test("semantic summaries highlight filenames, queries, domains and codemode names", () => {
	assert.equal(pathSignal("/home/me/src/a.ts", "/home/me", 80, home, paint), "<home>~</home><dim>/src/</dim><text>a.ts</text>");
	assert.equal(pathSignal("~/src/a.ts", "/home/me", 80, home, paint), "<dim>~/src/</dim><text>a.ts</text>");
	assert.equal(pathSignal("/home/me-too/a.ts", "/home/me", 80, home, paint), "<dim>/home/me-too/</dim><text>a.ts</text>");
	assert.match(toolSummary("grep", { pattern: "error", path: "src" }, false, Infinity, home, paint), /<text>error<\/text><dim> in src<\/dim>/);
	assert.match(toolSummary("web", { url: "https://example.com/docs" }, false, Infinity, home, paint), /<dim>https:\/\/<\/dim><text>example.com<\/text><dim>\/docs<\/dim>/);
	assert.match(toolSummary("codemode", { code: "tools.read({}); tools.read({})" }, false, Infinity, home, paint), /<text>read<\/text><dim> ×2<\/dim>/);
});

test("simple commands recognize quoted words and operators without surrounding spaces", () => {
	const rendered = commandSignal('CI=1 env git status&&printf "a|b";cat /home/me/file', "/home/me", home, paint);
	for (const program of ["git", "printf", "cat"]) assert.ok(rendered.includes(`<text>${program}</text>`));
	for (const noise of ["CI=1", "env", "status", "&&", '"a|b"']) assert.ok(rendered.includes(`<dim>${noise}</dim>`));
	assert.ok(rendered.includes("<home>~</home><dim>/file</dim>"));
	assert.equal(commandSignal("sudo npm test | head", "/home/me", home, paint), "<dim>sudo</dim><dim> </dim><text>npm</text><dim> </dim><dim>test</dim><dim> </dim><dim>|</dim><dim> </dim><text>head</text>");
});

test("ambiguous shell syntax falls back instead of claiming to parse it", () => {
	for (const command of ['sudo -u root npm test', 'env -C /tmp npm test', 'echo $(whoami)', 'echo `pwd`', 'cat <<EOF', 'echo "unfinished', 'if true; then echo ok; fi', 'echo hi > file', 'echo a\\ b', 'echo x # comment']) {
		assert.equal(commandSignal(command, "/home/me", home, paint), `<dim>${command}</dim>`);
	}
	assert.equal(commandSignal("echo hi\ncat file", "/home/me", home, paint), "<dim>echo hi cat file</dim>");
});

test("failure tails are literal, text-only, sanitized, and bounded", () => {
	assert.deepEqual(failureTail({ content: [{ type: "text", text: "first\n\n\u001b[31msecond\u001b[0m\nthird\tline\n" }, { type: "image", text: "not text" }] }), { lines: ["second", "third line"], omitted: 1 });
	assert.deepEqual(failureTail({}), { lines: [], omitted: 0 });
});

test("real tool rows retain semantic colors and bounded exceptions across themes and widths", () => {
	const handlers = new Map();
	extension({ on: (name, handler) => handlers.set(name, handler), registerCommand() {} });
	for (const themeName of ["dark", "light"]) {
		themeModule.initTheme(themeName);
		handlers.get("session_start")({}, { mode: "tui", ui: { get theme() { return themeModule.theme; } } });
		const tool = new ToolExecutionComponent("read", "signal", { path: "/日本語/👩‍💻/café.ts" }, {}, undefined, { requestRender() {} });
		tool.updateResult({ content: [{ type: "text", text: "okay" }], isError: false }, false);
		assert.equal(tool.render(80).length, 1);
		assert.ok(tool.render(80)[0].includes(themeModule.theme.fg("text", "café.ts")));
		const result = { content: [{ type: "text", text: "first\nsecond\n日本語 failure\nlast diagnostic" }], isError: true };
		tool.updateResult(result, false);
		const original = JSON.stringify(result);
		for (const width of [0, 1, 2, 3, 4, 8, 20, 80]) {
			const lines = tool.render(width);
			assert.ok(lines.length <= 4);
			assert.ok(lines.every(line => visibleWidth(line) <= width), `width ${width}`);
		}
		assert.match(tool.render(80).map(stripTerminalSequences).join("\n"), /2 earlier lines/);
		assert.ok(tool.render(80)[0].includes(themeModule.theme.fg("error", "café.ts")));
		assert.equal(tool.handleMouse({ type: "click", button: "left", x: 0, y: 2 }), undefined, "body remains selectable");
		tool.handleMouse({ type: "click", button: "left", x: 0, y: 0 });
		assert.match(tool.render(80).map(stripTerminalSequences).join("\n"), /first/);
		tool.setExpanded(false);
		assert.equal(tool.render(80).length, 4);
		assert.equal(JSON.stringify(result), original);
		tool.updateResult({ content: [], isError: true }, false);
		assert.match(tool.render(80).map(stripTerminalSequences).join("\n"), /No text output/);
		tool.updateResult({ content: [{ type: "text", text: "Operation aborted" }], isError: true }, false);
		assert.equal(tool.render(80).length, 2);
		assert.match(tool.render(80).map(stripTerminalSequences).join("\n"), /Operation aborted/);
		tool.updateResult({ content: [{ type: "text", text: "error in quoted sample; successful result" }], isError: false }, false);
		assert.equal(tool.render(80).length, 1, "status comes from isError, never text heuristics");
		for (const [name, args] of [["bash", { command: 'CI=1 git status&&printf "日本語 👩‍💻 café"' }], ["grep", { pattern: "日本語 👩‍💻", path: "/long/path" }], ["codemode", { code: "tools.read({}); tools.bash({}); tools.edit({})" }]]) {
			const row = new ToolExecutionComponent(name, "width", args, {}, undefined, { requestRender() {} });
			row.updateResult({ content: [], isError: false }, false);
			for (const width of [1, 2, 8, 20, 80]) assert.ok(row.render(width).every(line => visibleWidth(line) <= width));
			if (name === "bash") assert.ok(row.render(80)[0].includes(themeModule.theme.fg("text", "git")));
		}
	}
});
