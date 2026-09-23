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
}

declare global {
	interface HTMLElementTagNameMap {
		webview: WebviewTag;
	}
	// Obsidian installs its DOM helpers on every window, including pop-outs.
	interface Window {
		createEl: typeof createEl;
	}
}

export interface WebviewEvent extends Event {
	url?: string;
	title?: string;
	isMainFrame?: boolean;
}

interface Session {
	setPermissionRequestHandler(
		handler: ((webContents: unknown, permission: string, callback: (granted: boolean) => void) => void) | null,
	): void;
}

interface WebContents {
	setWindowOpenHandler(handler: (details: { url: string }) => { action: 'allow' | 'deny' }): void;
}

interface Remote {
	session: { fromPartition(partition: string): Session };
	webContents: { fromId(id: number): WebContents | undefined };
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
