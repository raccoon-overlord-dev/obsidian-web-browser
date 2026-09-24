import { Notice, Plugin } from 'obsidian';
import { ChromeImportModal } from './bookmarks';
import { BLANK } from './BrowserTab';
import { BrowserView, VIEW_TYPE_BROWSER } from './BrowserView';
import { Bookmark, IMPORT_FOLDER, parseBookmarksFile } from './chrome';
import { getRemote } from './electron';
import { ConfirmModal, WebBrowserSettingTab } from './settings';
import { SEARCH_ENGINES, SEARCH_URL, SearchEngine, toUrl } from './url';

export type WebsiteTheme = 'auto' | 'light' | 'dark';

interface WebBrowserData {
	/** Random per-vault id. Gives each vault its own cookie jar. Stored in the vault, so it survives moves. */
	vaultKey: string;
	searchEngine: SearchEngine;
	homepage: string;
	websiteTheme: WebsiteTheme;
	faviconInTab: boolean;
	bookmarks: Bookmark[];
}

function isBookmark(b: unknown): b is Bookmark {
	const x = b as Partial<Bookmark> | null;
	return (
		typeof x?.url === 'string' &&
		typeof x.title === 'string' &&
		Array.isArray(x.folder) &&
		x.folder.every((f) => typeof f === 'string')
	);
}

const DEFAULTS: WebBrowserData = {
	vaultKey: '',
	searchEngine: 'google',
	homepage: '',
	websiteTheme: 'auto',
	faviconInTab: true,
	bookmarks: [],
};

// Everything else (camera, mic, location, notifications, ...) is denied.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write']);

export default class WebBrowserPlugin extends Plugin {
	settings!: WebBrowserData;

	get partition() {
		return `persist:web-browser-${this.settings.vaultKey}`;
	}

	get searchUrl() {
		return SEARCH_ENGINES[this.settings.searchEngine]?.url ?? SEARCH_URL;
	}

	/** Where a new tab starts. */
	get homeUrl() {
		return toUrl(this.settings.homepage, this.searchUrl) ?? BLANK;
	}

	async onload() {
		this.settings = Object.assign({}, DEFAULTS, (await this.loadData()) as Partial<WebBrowserData>);
		// data.json can be edited by hand; keep only well-formed bookmarks (and never share the DEFAULTS array).
		this.settings.bookmarks = Array.isArray(this.settings.bookmarks) ? this.settings.bookmarks.filter(isBookmark) : [];
		if (!this.settings.vaultKey) {
			this.settings.vaultKey = crypto.randomUUID();
			await this.saveData(this.settings);
		}

		if (!getRemote()) console.error('Web Browser: Electron remote is unavailable; permission and popup handling are disabled.');
		this.setPermissionHandler(true);

		this.registerView(VIEW_TYPE_BROWSER, (leaf) => new BrowserView(leaf, this));
		this.addRibbonIcon('globe', 'Open new browser', () => void this.openBrowser());
		this.addSettingTab(new WebBrowserSettingTab(this.app, this));
		// Website theme "auto" follows Obsidian's light/dark theme.
		this.registerEvent(this.app.workspace.on('css-change', () => this.views().forEach((v) => v.applyTheme())));
	}

	onunload() {
		this.setPermissionHandler(false);
	}

	async openBrowser() {
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE_BROWSER, active: true });
		if (leaf.view instanceof BrowserView) leaf.view.focusAddress();
	}

	/** Called after a setting changed in the settings tab. */
	onSettingsChange() {
		for (const view of this.views()) view.onSettingsChange();
	}

	openSettings() {
		// Not in the public API, but it is the usual way to open a plugin's settings tab.
		const setting = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
		setting?.open();
		setting?.openTabById(this.manifest.id);
	}

	async clearCache() {
		await this.session()?.clearCache();
		new Notice('Browser cache cleared.');
	}

	confirmDeleteAllData() {
		new ConfirmModal(
			this.app,
			'Delete all stored data?',
			"This signs you out of every website and deletes this vault's cookies, cache, site storage and tab history. Other vaults are not affected. This cannot be undone.",
			'Delete',
			async () => {
				const session = this.session();
				if (!session) return void new Notice('Could not access the browser storage.');
				await Promise.all([session.clearStorageData(), session.clearCache(), session.clearAuthCache()]);
				for (const view of this.views()) view.clearHistory();
				new Notice('All stored browser data deleted.');
			},
		).open();
	}

	confirmResetIdentity() {
		new ConfirmModal(
			this.app,
			"Reset this vault's browser identity?",
			'This vault gets a new, empty set of logins and open browsers reload signed out. The old logins are kept for any other vault that still uses them, such as the original of a duplicated vault.',
			'Reset',
			async () => {
				this.setPermissionHandler(false);
				this.settings.vaultKey = crypto.randomUUID();
				await this.saveData(this.settings);
				this.setPermissionHandler(true);
				for (const view of this.views()) view.rebuild();
				new Notice("This vault's browser identity was reset.");
			},
		).open();
	}

	isBookmarked(url: string) {
		return this.settings.bookmarks.some((b) => b.url === url);
	}

	/** Star button: bookmarks the page at the top level, or removes every bookmark of it. */
	async toggleBookmark(url: string, title: string) {
		if (this.isBookmarked(url)) await this.removeBookmarks((b) => b.url === url);
		else {
			this.settings.bookmarks.push({ title: title || url, url, folder: [] });
			await this.saveBookmarks();
		}
	}

	async removeBookmarks(match: (b: Bookmark) => boolean) {
		this.settings.bookmarks = this.settings.bookmarks.filter((b) => !match(b));
		await this.saveBookmarks();
	}

	/** Replaces the "Imported from Chrome" folder. Throws, changing nothing, if the file cannot be parsed. */
	async importChromeBookmarks(json: string) {
		const imported = parseBookmarksFile(json, [IMPORT_FOLDER]);
		this.settings.bookmarks = [...this.settings.bookmarks.filter((b) => b.folder[0] !== IMPORT_FOLDER), ...imported];
		await this.saveBookmarks();
		return imported.length;
	}

	openChromeImport() {
		new ChromeImportModal(this.app, this).open();
	}

	private async saveBookmarks() {
		await this.saveData(this.settings);
		for (const view of this.views()) view.updateButtons();
	}

	private views() {
		return this.app.workspace
			.getLeavesOfType(VIEW_TYPE_BROWSER)
			.map((leaf) => leaf.view)
			.filter((view): view is BrowserView => view instanceof BrowserView);
	}

	private session() {
		return getRemote()?.session.fromPartition(this.partition);
	}

	private setPermissionHandler(on: boolean) {
		this.session()?.setPermissionRequestHandler(
			on ? (_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)) : null,
		);
	}
}
