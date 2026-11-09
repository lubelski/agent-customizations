import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export type MessageLayout = "compatible" | "unicode";
/** Three independent preferences, all off by default. */
export type UiSettings = { compactHeader: boolean; compactFooter: boolean; fontCompat: boolean };
export type UiSetting = keyof UiSettings;
export const UI_SETTINGS: readonly UiSetting[] = ["compactHeader", "compactFooter", "fontCompat"];
const defaults = (): UiSettings => ({ compactHeader: false, compactFooter: false, fontCompat: false });

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
	const settings = defaults();
	for (const key of UI_SETTINGS) {
		if (data[key] === undefined) continue;
		if (typeof data[key] !== "boolean") throw new Error(`${key} must be a boolean`);
		settings[key] = data[key] as boolean;
	}
	return settings;
}

export function loadUiSettings(path: string): UiSettings {
	return parseSettings(readSettings(path));
}

/** One atomic write; unrelated keys in the file are preserved. */
export function saveUiSettings(path: string, patch: Partial<UiSettings>): UiSettings {
	const settings = { ...readSettings(path), ...patch };
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

/** Message panel technique implied by fontCompat. */
export const messageLayout = (settings: Readonly<UiSettings>): MessageLayout => settings.fontCompat ? "compatible" : "unicode";

export class UiSettingsStore {
	private value = defaults();
	private listeners = new Set<() => void>();
	readonly path: string;
	constructor(path: string) { this.path = path; }
	get current(): Readonly<UiSettings> { return this.value; }
	reload(): void {
		this.value = defaults();
		this.value = loadUiSettings(this.path);
	}
	update(patch: Partial<UiSettings>): void {
		this.value = saveUiSettings(this.path, patch);
		for (const listener of this.listeners) listener();
	}
	toggle(key: UiSetting): boolean {
		const next = !this.value[key];
		this.update({ [key]: next });
		return next;
	}
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}
}
