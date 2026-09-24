import { ItemView, Menu, Scope, setIcon, setTooltip, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { BookmarksModal } from './bookmarks';
import { BLANK, BrowserTab, setFavicon, TabOptions } from './BrowserTab';
import { getRemote } from './electron';
import type WebBrowserPlugin from './main';
import type { WebsiteTheme } from './main';
import { toUrl } from './url';

export const VIEW_TYPE_BROWSER = 'web-browser-view';

interface SavedTab extends TabOptions {
	url: string;
}

const THEMES: WebsiteTheme[] = ['auto', 'light', 'dark'];

interface SavedTabs {
	tabs: SavedTab[];
	active: number;
}

function parseState(state: unknown): SavedTabs | null {
	const s = state as { tabs?: unknown; active?: unknown; url?: unknown } | null;
	if (Array.isArray(s?.tabs)) {
		const tabs = (s.tabs as Partial<SavedTab>[])
			.filter((t) => typeof t?.url === 'string')
			.map((t) => ({
				url: t.url!,
				title: typeof t.title === 'string' ? t.title : '',
				zoom: typeof t.zoom === 'number' && t.zoom > 0 ? t.zoom : 1,
				theme: THEMES.includes(t.theme as WebsiteTheme) ? t.theme : null,
			}));
		if (tabs.length) return { tabs, active: typeof s.active === 'number' ? s.active : 0 };
	}
	// State saved by earlier versions: a single URL.
	if (typeof s?.url === 'string') return { tabs: [{ url: s.url, title: '' }], active: 0 };
	return null;
}

export class BrowserView extends ItemView {
	private tabs: BrowserTab[] = [];
	private active: BrowserTab | null = null;
	/** State that arrived before onOpen built the panel. */
	private pending: SavedTabs | null = null;
	private tabsEl: HTMLElement | null = null;
	private pagesEl!: HTMLElement;
	private addressEl!: HTMLInputElement;
	private backEl!: HTMLButtonElement;
	private forwardEl!: HTMLButtonElement;
	private reloadEl!: HTMLButtonElement;
	private starEl!: HTMLButtonElement;
	/** What the Obsidian tab header shows, to skip redundant (flickering) updates. */
	private header = { title: '', favicon: '' };

	constructor(
		leaf: WorkspaceLeaf,
		readonly plugin: WebBrowserPlugin,
	) {
		super(leaf);
		// Not a navigation view: opening a note must not replace the browser.
		this.navigation = false;
		// Shortcuts while focus is on the tab bar or toolbar. Inside a page, BrowserTab catches them.
		this.scope = new Scope(this.app.scope);
		this.scope.register(['Mod'], 't', () => {
			this.newTab();
			return false;
		});
		this.scope.register(['Mod'], 'w', () => {
			if (this.active) this.closeTab(this.active);
			return false;
		});
	}

	get partition() {
		return this.plugin.partition;
	}

	getViewType() {
		return VIEW_TYPE_BROWSER;
	}

	getDisplayText() {
		return this.active?.title || 'New tab';
	}

	getIcon() {
		return 'globe';
	}

	getState() {
		return {
			...super.getState(),
			tabs: this.tabs.map((t): SavedTab => ({ url: t.url, title: t.title, zoom: t.zoom, theme: t.theme })),
			active: this.active ? this.tabs.indexOf(this.active) : 0,
		};
	}

	async setState(state: unknown, result: ViewStateResult) {
		const saved = parseState(state);
		if (saved) {
			if (this.tabsEl) this.restore(saved);
			else this.pending = saved;
		}
		await super.setState(state, result);
	}

	focusAddress() {
		this.addressEl.focus();
	}

	async onOpen() {
		const root = this.contentEl;
		root.empty();
		root.addClass('web-browser');

		const tabBar = root.createDiv({ cls: 'web-browser-tabbar' });
		this.tabsEl = tabBar.createDiv({ cls: 'web-browser-tabs' });
		this.button(tabBar, 'plus', 'New tab', () => this.newTab());

		const bar = root.createDiv({ cls: 'web-browser-toolbar' });
		this.backEl = this.button(bar, 'arrow-left', 'Back', () => this.active?.webview.goBack());
		this.forwardEl = this.button(bar, 'arrow-right', 'Forward', () => this.active?.webview.goForward());
		this.reloadEl = this.button(bar, 'rotate-cw', 'Reload', () => {
			const tab = this.active;
			if (tab?.loading) tab.webview.stop();
			else if (tab?.ready) tab.webview.reload();
		});
		this.addressEl = bar.createEl('input', {
			type: 'text',
			cls: 'web-browser-address',
			attr: { placeholder: 'Search or enter address', spellcheck: 'false' },
		});
		this.starEl = this.button(bar, 'star', 'Bookmark this page', () => this.toggleBookmark());
		this.starEl.addClass('web-browser-star');
		const menuEl = this.button(bar, 'menu', 'Menu', () => this.openMenu(menuEl));
		this.registerDomEvent(this.addressEl, 'focus', () => this.addressEl.select());
		this.registerDomEvent(this.addressEl, 'input', () => {
			if (this.active) this.active.typed = this.addressEl.value;
		});
		this.registerDomEvent(this.addressEl, 'keydown', (e) => {
			const tab = this.active;
			if (!tab) return;
			if (e.key === 'Enter') {
				const url = toUrl(this.addressEl.value, this.plugin.searchUrl);
				if (url) {
					tab.navigate(url);
					tab.webview.focus();
				}
			} else if (e.key === 'Escape') {
				// Keep Obsidian from also handling Esc (it switched to another tab).
				e.preventDefault();
				e.stopPropagation();
				tab.typed = null;
				// Blur first: showUrl skips the address bar while it has focus.
				this.addressEl.blur();
				this.showUrl();
			}
		});

		this.pagesEl = root.createDiv({ cls: 'web-browser-pages' });
		this.restore(this.pending ?? { tabs: [{ url: this.plugin.homeUrl }], active: 0 });
		this.pending = null;
	}

	async onClose() {
		for (const tab of this.tabs) tab.destroy();
		this.tabs = [];
		this.active = null;
		this.tabsEl = null;
		this.contentEl.empty();
	}

	openTab(url: string, activate: boolean, after?: BrowserTab, options: TabOptions = {}) {
		if (!this.tabsEl) return;
		const index = after ? this.tabs.indexOf(after) + 1 : this.tabs.length;
		const tab = new BrowserTab(this, this.tabsEl, this.pagesEl, index, url, options);
		this.tabs.splice(index, 0, tab);
		if (activate) this.activate(tab);
		void this.app.workspace.requestSaveLayout();
		return tab;
	}

	newTab() {
		const tab = this.openTab(this.plugin.homeUrl, true);
		if (tab?.url === BLANK) this.focusAddress();
	}

	applyTheme() {
		for (const tab of this.tabs) tab.applyTheme();
	}

	onSettingsChange() {
		this.applyTheme();
		this.updateHeader(true);
	}

	/** After all stored data was deleted: drop back/forward history and reload every tab. */
	clearHistory() {
		for (const tab of this.tabs) tab.clearHistory();
		this.updateButtons();
	}

	/** Recreates every tab, for example after the partition changed. */
	rebuild() {
		const saved = parseState(this.getState());
		if (saved) this.restore(saved, true);
	}

	closeTab(tab: BrowserTab) {
		const index = this.tabs.indexOf(tab);
		if (index < 0) return;
		// Closing the last tab closes the panel, like closing a browser window.
		if (this.tabs.length === 1) {
			this.leaf.detach();
			return;
		}
		tab.destroy();
		this.tabs.splice(index, 1);
		if (tab === this.active) {
			this.active = null;
			this.activate(this.tabs[Math.min(index, this.tabs.length - 1)]!);
		}
		void this.app.workspace.requestSaveLayout();
	}

	activate(tab: BrowserTab) {
		if (tab === this.active) return;
		this.active?.setActive(false);
		this.active = tab;
		tab.setActive(true);
		this.showUrl(true);
		this.updateButtons();
		this.updateHeader();
		void this.app.workspace.requestSaveLayout();
	}

	/** Called by a tab when its URL, title, favicon or loading state changes. */
	onTabChange(tab: BrowserTab, save: boolean) {
		if (save) void this.app.workspace.requestSaveLayout();
		if (tab !== this.active) return;
		this.showUrl();
		this.updateButtons();
		this.updateHeader();
	}

	private restore(saved: SavedTabs, force = false) {
		// Obsidian can pass back the state it already has; do not reload every page for that.
		const same =
			saved.tabs.length === this.tabs.length && saved.tabs.every((t, i) => t.url === this.tabs[i]!.url);
		if (same && !force) return;
		for (const tab of this.tabs) tab.destroy();
		this.tabs = [];
		this.active = null;
		for (const t of saved.tabs) this.openTab(t.url, false, undefined, t);
		const active = this.tabs[Math.min(Math.max(saved.active, 0), this.tabs.length - 1)];
		if (active) this.activate(active);
	}

	private showUrl(force = false) {
		const tab = this.active;
		if (!tab || (!force && this.addressEl.ownerDocument.activeElement === this.addressEl)) return;
		this.addressEl.value = tab.typed ?? (tab.url === BLANK ? '' : tab.url);
	}

	updateButtons() {
		const tab = this.active;
		this.backEl.disabled = !tab?.ready || !tab.webview.canGoBack();
		this.forwardEl.disabled = !tab?.ready || !tab.webview.canGoForward();
		const loading = !!tab?.loading;
		setIcon(this.reloadEl, loading ? 'x' : 'rotate-cw');
		setTooltip(this.reloadEl, loading ? 'Stop' : 'Reload');
		const bookmarkable = !!tab && tab.url !== BLANK;
		const starred = bookmarkable && this.plugin.isBookmarked(tab.url);
		this.starEl.disabled = !bookmarkable;
		this.starEl.toggleClass('is-bookmarked', starred);
		setTooltip(this.starEl, starred ? 'Remove bookmark' : 'Bookmark this page');
	}

	private toggleBookmark() {
		const tab = this.active;
		if (tab && tab.url !== BLANK) void this.plugin.toggleBookmark(tab.url, tab.title);
	}

	private openBookmarks() {
		new BookmarksModal(this.app, this.plugin, (url, newTab) => {
			if (newTab) this.openTab(url, false, this.active ?? undefined);
			else this.active?.navigate(url);
		}).open();
	}

	private openMenu(anchor: HTMLElement) {
		const tab = this.active;
		if (!tab) return;
		// Ctrl+scroll or pinch can change the zoom inside the page.
		if (tab.ready) tab.zoom = tab.webview.getZoomFactor();
		const menu = new Menu();
		menu.addItem((i) => i.setTitle('Zoom in').setIcon('zoom-in').onClick(() => tab.zoomBy(1)));
		menu.addItem((i) => i.setTitle('Zoom out').setIcon('zoom-out').onClick(() => tab.zoomBy(-1)));
		menu.addItem((i) =>
			i
				.setTitle(`Reset zoom (now ${Math.round(tab.zoom * 100)}%)`)
				.setIcon('rotate-ccw')
				.onClick(() => tab.setZoom(1)),
		);
		menu.addSeparator();
		const labels: Record<WebsiteTheme, string> = {
			auto: 'Website theme: auto (follow Obsidian)',
			light: 'Website theme: light',
			dark: 'Website theme: dark',
		};
		for (const theme of THEMES) {
			menu.addItem((i) =>
				i
					.setTitle(labels[theme])
					.setChecked(tab.effectiveTheme === theme)
					.onClick(() => tab.setTheme(theme)),
			);
		}
		menu.addSeparator();
		const starred = tab.url !== BLANK && this.plugin.isBookmarked(tab.url);
		menu.addItem((i) =>
			i
				.setTitle(starred ? 'Remove bookmark' : 'Bookmark this page')
				.setIcon('star')
				.setDisabled(tab.url === BLANK)
				.onClick(() => this.toggleBookmark()),
		);
		menu.addItem((i) => i.setTitle('Bookmarks…').setIcon('bookmark').onClick(() => this.openBookmarks()));
		menu.addItem((i) =>
			i
				.setTitle('Import bookmarks from Chrome…')
				.setIcon('download')
				.onClick(() => this.plugin.openChromeImport()),
		);
		menu.addSeparator();
		menu.addItem((i) =>
			i
				.setTitle('Open in default browser')
				.setIcon('external-link')
				.setDisabled(!/^https?:/i.test(tab.url))
				.onClick(() => void getRemote()?.shell.openExternal(tab.url)),
		);
		menu.addSeparator();
		menu.addItem((i) => i.setTitle('Clear cache').setIcon('eraser').onClick(() => void this.plugin.clearCache()));
		menu.addItem((i) =>
			i
				.setTitle('Delete all stored data…')
				.setIcon('trash-2')
				.setWarning(true)
				.onClick(() => this.plugin.confirmDeleteAllData()),
		);
		menu.addSeparator();
		menu.addItem((i) => i.setTitle('Settings').setIcon('settings').onClick(() => this.plugin.openSettings()));
		const rect = anchor.getBoundingClientRect();
		menu.showAtPosition({ x: rect.right, y: rect.bottom, left: true }, anchor.ownerDocument);
	}

	private updateHeader(force = false) {
		// None of these are in the public API. updateHeader refreshes the Obsidian tab title,
		// titleEl is the view header title, tabHeaderInnerIconEl is the Obsidian tab icon.
		const title = this.getDisplayText();
		const favicon = this.plugin.settings.faviconInTab ? (this.active?.favicon ?? '') : '';
		if (!force && title === this.header.title && favicon === this.header.favicon) return;
		this.header = { title, favicon };
		(this as unknown as { titleEl?: HTMLElement }).titleEl?.setText(title);
		const leaf = this.leaf as unknown as { updateHeader?: () => void; tabHeaderInnerIconEl?: HTMLElement };
		leaf.updateHeader?.();
		// Set after updateHeader, which may reset the icon to getIcon().
		if (leaf.tabHeaderInnerIconEl) setFavicon(leaf.tabHeaderInnerIconEl, favicon);
	}

	private button(parent: HTMLElement, icon: string, label: string, onClick: () => void) {
		const el = parent.createEl('button', { cls: 'clickable-icon web-browser-button' });
		setIcon(el, icon);
		setTooltip(el, label);
		this.registerDomEvent(el, 'click', onClick);
		return el;
	}
}
