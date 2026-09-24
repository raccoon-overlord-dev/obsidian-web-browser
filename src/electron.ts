// Minimal typings for the Electron pieces we use. Electron itself is provided by Obsidian at runtime.

export interface WebviewTag extends HTMLElement {
	loadURL(url: string): Promise<void>;
	getWebContentsId(): number;
	canGoBack(): boolean;
	canGoForward(): boolean;
	goBack(): void;
	goForward(): void;
	reload(): void;
	stop(): void;
	clearHistory(): void;
	getZoomFactor(): number;
	setZoomFactor(factor: number): void;
	isAudioMuted(): boolean;
	setAudioMuted(muted: boolean): void;
	isCurrentlyAudible(): boolean;
}

declare global {
	interface HTMLElementTagNameMap {
		webview: WebviewTag;
	}
	// Obsidian installs its DOM helpers on every window, including pop-outs.
	interface Window {
		createEl: typeof createEl;
		createDiv: typeof createDiv;
	}
}

export interface WebviewEvent extends Event {
	url?: string;
	title?: string;
	isMainFrame?: boolean;
	favicons?: string[];
	errorCode?: number;
	errorDescription?: string;
	validatedURL?: string;
	reason?: string;
}

interface Session {
	setPermissionRequestHandler(
		handler: ((webContents: unknown, permission: string, callback: (granted: boolean) => void) => void) | null,
	): void;
	clearCache(): Promise<void>;
	clearStorageData(): Promise<void>;
	clearAuthCache(): Promise<void>;
}

export interface KeyInput {
	type: string;
	key: string;
	control: boolean;
	meta: boolean;
	alt: boolean;
	shift: boolean;
}

export interface WebContents {
	setWindowOpenHandler(
		handler: (details: { url: string; disposition: string }) => { action: 'allow' | 'deny' },
	): void;
	on(event: 'before-input-event', listener: (event: unknown, input: KeyInput) => void): void;
	on(event: 'audio-state-changed', listener: () => void): void;
	executeJavaScriptInIsolatedWorld(worldId: number, scripts: { code: string }[]): Promise<unknown>;
	debugger: {
		isAttached(): boolean;
		attach(protocolVersion: string): void;
		sendCommand(method: string, params: object): Promise<unknown>;
	};
}

interface Remote {
	session: { fromPartition(partition: string): Session };
	webContents: { fromId(id: number): WebContents | undefined };
	shell: { openExternal(url: string): Promise<void> };
}

/** Obsidian exposes Electron's remote module to plugins. */
export function getRemote(): Remote | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports -- electron is only reachable through Node require at runtime
		return (require('electron') as { remote?: Remote }).remote ?? null;
	} catch {
		return null;
	}
}
