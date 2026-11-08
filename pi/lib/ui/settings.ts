import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export type UiSettings = { header: { showTopBar: boolean } };
const defaults = (): UiSettings => ({ header: { showTopBar: true } });

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

export function loadUiSettings(path: string): UiSettings {
	const data = readSettings(path);
	const header = data.header === undefined ? {} : object(data.header, "header");
	const value = header.showTopBar;
	if (value !== undefined && typeof value !== "boolean") throw new Error("header.showTopBar must be a boolean");
	return { header: { showTopBar: value ?? true } };
}

/** Read-modify-write preserves other preferences. Invalid JSON is never overwritten. */
export function saveHeaderTopBar(path: string, showTopBar: boolean): void {
	const settings = readSettings(path);
	const header = settings.header === undefined ? {} : object(settings.header, "header");
	settings.header = { ...header, showTopBar };
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		writeFileSync(temporary, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600, flag: "wx" });
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
}

/** One owner for persistent UI preferences; render modules subscribe to live changes. */
export class UiSettingsStore {
	private value = defaults();
	private listeners = new Set<() => void>();
	readonly path: string;
	constructor(path: string) { this.path = path; }
	get current(): Readonly<{ header: Readonly<UiSettings["header"]> }> { return this.value; }
	reload(): void {
		this.value = defaults();
		this.value = loadUiSettings(this.path);
	}
	setHeaderTopBar(showTopBar: boolean): void {
		saveHeaderTopBar(this.path, showTopBar);
		this.value = { ...this.value, header: { ...this.value.header, showTopBar } };
		for (const listener of this.listeners) listener();
	}
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}
}
