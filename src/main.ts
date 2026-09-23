import { Plugin } from 'obsidian';
import { BrowserView, VIEW_TYPE_BROWSER } from './BrowserView';
import { getRemote } from './electron';

interface WebBrowserData {
	/** Random per-vault id. Gives each vault its own cookie jar. Stored in the vault, so it survives moves. */
	vaultKey: string;
}

// Everything else (camera, mic, location, notifications, ...) is denied.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write']);

export default class WebBrowserPlugin extends Plugin {
	settings!: WebBrowserData;

	get partition() {
		return `persist:web-browser-${this.settings.vaultKey}`;
	}

	async onload() {
		this.settings = Object.assign({ vaultKey: '' }, (await this.loadData()) as Partial<WebBrowserData>);
		if (!this.settings.vaultKey) {
			this.settings.vaultKey = crypto.randomUUID();
			await this.saveData(this.settings);
		}

		const remote = getRemote();
		if (!remote) console.error('Web Browser: Electron remote is unavailable; permission and popup handling are disabled.');
		remote?.session.fromPartition(this.partition).setPermissionRequestHandler((_wc, permission, callback) =>
			callback(ALLOWED_PERMISSIONS.has(permission)),
		);

		this.registerView(VIEW_TYPE_BROWSER, (leaf) => new BrowserView(leaf, this));
		this.addRibbonIcon('globe', 'Open new browser', () => void this.openBrowser());
	}

	onunload() {
		getRemote()?.session.fromPartition(this.partition).setPermissionRequestHandler(null);
	}

	async openBrowser() {
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE_BROWSER, active: true });
		if (leaf.view instanceof BrowserView) leaf.view.focusAddress();
	}
}
