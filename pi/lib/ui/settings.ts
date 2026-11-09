import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export type MessageLayout = "compatible" | "unicode";
export type UiPreset = "compact" | "mobile" | "desktop";
export type UiSettings = {
	header: { showTopBar: boolean };
	footer: { compact: boolean };
	messages: { layout: MessageLayout };
};
export type UiSettingsPatch = { [K in keyof UiSettings]?: Partial<UiSettings[K]> };
const defaults = (): UiSettings => ({ header: { showTopBar: true }, footer: { compact: false }, messages: { layout: "compatible" } });

function object(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
	return value as Record<string, unknown>;
}

function readSettings(path: string): Record<string, unknown> {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
		throw error;
	}
	return object(JSON.parse(text), "UI settings");
}

function parseSettings(data: Record<string, unknown>): UiSettings {
	const header = data.header === undefined ? {} : object(data.header, "header");
	const footer = data.footer === undefined ? {} : object(data.footer, "footer");
	const messages = data.messages === undefined ? {} : object(data.messages, "messages");
	if (header.showTopBar !== undefined && typeof header.showTopBar !== "boolean") throw new Error("header.showTopBar must be a boolean");
	if (footer.compact !== undefined && typeof footer.compact !== "boolean") throw new Error("footer.compact must be a boolean");
	if (messages.layout !== undefined && messages.layout !== "compatible" && messages.layout !== "unicode") {
		throw new Error("messages.layout must be compatible or unicode");
	}
	return {
		header: { showTopBar: header.showTopBar ?? true },
		footer: { compact: footer.compact ?? false },
		messages: { layout: messages.layout ?? "compatible" },
	};
}

export function loadUiSettings(path: string): UiSettings {
	return parseSettings(readSettings(path));
}

/** One atomic write for a whole preset; merge at section level to preserve other preferences. */
export function saveUiSettings(path: string, patch: UiSettingsPatch): UiSettings {
	const settings = readSettings(path);
	for (const key of Object.keys(patch) as (keyof UiSettings)[]) {
		const current = settings[key] === undefined ? {} : object(settings[key], key);
		settings[key] = { ...current, ...patch[key] };
	}
	const resolved = parseSettings(settings);
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		writeFileSync(temporary, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600, flag: "wx" });
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	return resolved;
}

export function saveHeaderTopBar(path: string, showTopBar: boolean): void {
	saveUiSettings(path, { header: { showTopBar } });
}

/** One owner for persistent UI preferences; render modules subscribe to live changes. */
export class UiSettingsStore {
	private value = defaults();
	private listeners = new Set<() => void>();
	readonly path: string;
	constructor(path: string) { this.path = path; }
	get current(): { readonly [K in keyof UiSettings]: Readonly<UiSettings[K]> } { return this.value; }
	reload(): void {
		this.value = defaults();
		this.value = loadUiSettings(this.path);
	}
	update(patch: UiSettingsPatch): void {
		this.value = saveUiSettings(this.path, patch);
		for (const listener of this.listeners) listener();
	}
	setHeaderTopBar(showTopBar: boolean): void { this.update({ header: { showTopBar } }); }
	setFooterCompact(compact: boolean): void { this.update({ footer: { compact } }); }
	setMessageLayout(layout: MessageLayout): void { this.update({ messages: { layout } }); }
	applyPreset(preset: UiPreset): void {
		this.update({
			header: { showTopBar: preset === "desktop" },
			footer: { compact: preset !== "desktop" },
			...(preset === "compact" ? {} : { messages: { layout: preset === "desktop" ? "unicode" as const : "compatible" as const } }),
		});
	}
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}
}
