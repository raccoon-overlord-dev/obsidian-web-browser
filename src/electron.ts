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
	findInPage(text: string, options: { forward: boolean; findNext: boolean }): number;
	stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void;
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
	result?: FindResult;
}

export interface FindResult {
	activeMatchOrdinal: number;
	matches: number;
	finalUpdate: boolean;
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

export interface PopupWindow {
	destroy(): void;
	removeMenu(): void;
	loadURL(url: string): Promise<void>;
	webContents: {
		getURL(): string;
		removeAllListeners(event: string): void;
		setWindowOpenHandler(handler: null): void;
	};
}

export interface WebContents {
	/** Only null is used: see BrowserTab. */
	setWindowOpenHandler(handler: null): void;
	on(event: 'before-input-event', listener: (event: unknown, input: KeyInput) => void): void;
	on(event: 'audio-state-changed', listener: () => void): void;
	on(event: 'did-create-window', listener: (window: PopupWindow, details: { url: string; disposition: string }) => void): void;
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
		// Electron is only reachable through the renderer's require. Typed here, so the plugin does not
		// depend on Node's type definitions.
		const load = (window as unknown as { require?: (id: string) => unknown }).require;
		return (load?.('electron') as { remote?: Remote } | undefined)?.remote ?? null;
	} catch {
		return null;
	}
}
