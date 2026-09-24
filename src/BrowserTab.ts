import { Platform, setIcon, setTooltip } from 'obsidian';
import { getRemote, KeyInput, WebviewEvent, WebviewTag } from './electron';
import type { BrowserView } from './BrowserView';

export const BLANK = 'about:blank';

/** Shows a site favicon in `el`, falling back to the globe icon. */
export function setFavicon(el: HTMLElement, url: string) {
	el.empty();
	if (!url) return setIcon(el, 'globe');
	const img = el.createEl('img', { cls: 'web-browser-favicon', attr: { src: url, alt: '' } });
	img.addEventListener('error', () => {
		el.empty();
		setIcon(el, 'globe');
	});
}

/** One page inside the panel: its entry in the tab bar plus its own webview. */
export class BrowserTab {
	url: string;
	title: string;
	favicon = '';
	/** Address bar text typed in this tab but not submitted yet. */
	typed: string | null = null;
	ready = false;
	loading = false;
	readonly el: HTMLElement;
	readonly webview: WebviewTag;
	private iconEl: HTMLElement;
	private labelEl: HTMLElement;
	private shownFavicon: string | null = null;

	constructor(
		private view: BrowserView,
		tabsEl: HTMLElement,
		pagesEl: HTMLElement,
		index: number,
		url: string,
		title: string,
	) {
		this.url = url;
		this.title = title;
		const win = tabsEl.ownerDocument.win;

		// Listeners are plain addEventListener: they go away with the elements when the tab closes.
		this.el = win.createDiv({ cls: 'web-browser-tab' });
		this.iconEl = this.el.createSpan({ cls: 'web-browser-tab-icon' });
		this.labelEl = this.el.createSpan({ cls: 'web-browser-tab-title' });
		const closeEl = this.el.createDiv({ cls: 'clickable-icon web-browser-tab-close' });
		setIcon(closeEl, 'x');
		setTooltip(closeEl, 'Close tab');
		closeEl.addEventListener('click', (e) => {
			e.stopPropagation();
			view.closeTab(this);
		});
		this.el.addEventListener('click', () => view.activate(this));
		// Middle-click closes. Cancel mousedown so it does not start autoscroll.
		this.el.addEventListener('mousedown', (e) => {
			if (e.button === 1) e.preventDefault();
		});
		this.el.addEventListener('auxclick', (e) => {
			if (e.button === 1) view.closeTab(this);
		});
		tabsEl.insertBefore(this.el, tabsEl.children[index] ?? null);

		// partition and allowpopups only take effect if set before the webview is attached.
		// No src until there is a real URL: an initial about:blank load can finish after
		// the saved URL was set and overwrite it.
		this.webview = win.createEl('webview', {
			cls: 'web-browser-webview',
			attr: { partition: view.partition, allowpopups: '' },
		});
		if (url !== BLANK) this.webview.setAttribute('src', url);

		const on = (type: string, fn: (e: WebviewEvent) => void) =>
			this.webview.addEventListener(type, (e) => fn(e as WebviewEvent));
		on('dom-ready', () => this.onFirstReady());
		on('did-start-loading', () => this.setLoading(true));
		on('did-stop-loading', () => this.setLoading(false));
		on('did-navigate', (e) => {
			this.favicon = '';
			this.onNavigate(e.url);
		});
		on('did-navigate-in-page', (e) => e.isMainFrame && this.onNavigate(e.url));
		on('page-title-updated', (e) => {
			this.title = e.title ?? '';
			this.changed(true);
		});
		on('page-favicon-updated', (e) => {
			this.favicon = e.favicons?.[0] ?? '';
			this.changed(false);
		});
		pagesEl.appendChild(this.webview);
		this.render();
	}

	navigate(url: string) {
		this.url = url;
		this.typed = null;
		// loadURL throws until the first dom-ready; before that, swapping src is enough.
		// Rejections are aborted or failed loads (for example ERR_ABORTED when a new navigation starts).
		if (this.ready) this.webview.loadURL(url).catch(() => {});
		else this.webview.setAttribute('src', url);
		this.changed(true);
	}

	setActive(active: boolean) {
		this.el.toggleClass('is-active', active);
		this.webview.toggleClass('is-active', active);
	}

	destroy() {
		this.el.remove();
		this.webview.remove();
	}

	private onFirstReady() {
		if (this.ready) return;
		this.ready = true;
		const contents = getRemote()?.webContents.fromId(this.webview.getWebContentsId());
		// Popups (target=_blank, window.open) open as a new tab in this panel.
		contents?.setWindowOpenHandler(({ url, disposition }) => {
			this.view.openTab(url, disposition !== 'background-tab', this);
			return { action: 'deny' };
		});
		// Keys pressed inside the page never reach Obsidian's DOM, so the shortcuts are caught here.
		contents?.on('before-input-event', (_e, input) => this.onKey(input));
		this.changed(false);
	}

	private onKey(input: KeyInput) {
		const mod = Platform.isMacOS ? input.meta : input.control;
		if (input.type !== 'keyDown' || !mod || input.alt || input.shift) return;
		const key = input.key.toLowerCase();
		if (key === 't') this.view.newTab();
		else if (key === 'w') this.view.closeTab(this);
	}

	private onNavigate(url: string | undefined) {
		if (!url) return;
		this.url = url;
		if (url === BLANK) this.title = '';
		this.changed(true);
	}

	private setLoading(loading: boolean) {
		this.loading = loading;
		this.changed(false);
	}

	private changed(save: boolean) {
		this.render();
		this.view.onTabChange(this, save);
	}

	private render() {
		const text = this.title || (this.url === BLANK ? 'New tab' : this.url);
		this.labelEl.setText(text);
		setTooltip(this.el, text);
		// Only rebuild the icon when it changes, so it does not flicker on every load event.
		if (this.shownFavicon === this.favicon) return;
		this.shownFavicon = this.favicon;
		setFavicon(this.iconEl, this.favicon);
	}
}
