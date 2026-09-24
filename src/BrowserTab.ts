import { Platform, setIcon, setTooltip } from 'obsidian';
import { getRemote, KeyInput, WebContents, WebviewEvent, WebviewTag } from './electron';
import type { BrowserView } from './BrowserView';
import type { WebsiteTheme } from './main';

export const BLANK = 'about:blank';

// Mouse back/forward buttons (3 and 4). Chrome handles them in its browser UI, which Electron lacks,
// and clicks inside a page never reach Obsidian. So each page gets this listener. It runs in an
// isolated world, invisible to the page's own scripts; history is shared with the page.
const MOUSE_NAVIGATION = `window.addEventListener('mouseup', (e) => {
	if (e.button === 3) { e.preventDefault(); history.back(); }
	else if (e.button === 4) { e.preventDefault(); history.forward(); }
}, true);`;
const ISOLATED_WORLD = 1001;

// Chrome's zoom steps.
const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

/** Per-tab settings that are saved with the view. */
export interface TabOptions {
	title?: string;
	zoom?: number;
	/** null follows the default website theme from the settings. */
	theme?: WebsiteTheme | null;
}

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
	zoom: number;
	theme: WebsiteTheme | null;
	readonly el: HTMLElement;
	readonly webview: WebviewTag;
	private contents: WebContents | undefined;
	private iconEl: HTMLElement;
	private labelEl: HTMLElement;
	private audioEl: HTMLElement;
	private shownFavicon: string | null = null;

	constructor(
		private view: BrowserView,
		tabsEl: HTMLElement,
		pagesEl: HTMLElement,
		index: number,
		url: string,
		options: TabOptions,
	) {
		this.url = url;
		this.title = options.title ?? '';
		this.zoom = options.zoom ?? 1;
		this.theme = options.theme ?? null;
		const win = tabsEl.ownerDocument.win;

		// Listeners are plain addEventListener: they go away with the elements when the tab closes.
		this.el = win.createDiv({ cls: 'web-browser-tab' });
		this.iconEl = this.el.createSpan({ cls: 'web-browser-tab-icon' });
		this.labelEl = this.el.createSpan({ cls: 'web-browser-tab-title' });
		// Shown while the tab plays audio or is muted. Click to mute or unmute.
		this.audioEl = this.el.createDiv({ cls: 'clickable-icon web-browser-tab-audio' });
		this.audioEl.addEventListener('click', (e) => {
			e.stopPropagation();
			if (!this.ready) return;
			this.webview.setAudioMuted(!this.webview.isAudioMuted());
			this.updateAudio();
		});
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
		on('dom-ready', () => {
			this.onFirstReady();
			this.applyPageSettings();
			this.contents
				?.executeJavaScriptInIsolatedWorld(ISOLATED_WORLD, [{ code: MOUSE_NAVIGATION }])
				// Fails on pages that run no scripts, such as Chromium's error pages. Nothing to do there.
				.catch(() => {});
		});
		on('did-start-loading', () => this.setLoading(true));
		on('did-stop-loading', () => this.setLoading(false));
		on('did-navigate', (e) => {
			this.favicon = '';
			this.applyPageSettings();
			this.onNavigate(e.url);
		});
		on('media-started-playing', () => this.updateAudio());
		on('media-paused', () => this.updateAudio());
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
		this.updateAudio();
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

	zoomBy(steps: number) {
		const current = ZOOM_LEVELS.findIndex((z) => z >= this.zoom - 0.001);
		const index = Math.min(Math.max((current < 0 ? ZOOM_LEVELS.length - 1 : current) + steps, 0), ZOOM_LEVELS.length - 1);
		this.setZoom(ZOOM_LEVELS[index]!);
	}

	setZoom(zoom: number) {
		this.zoom = zoom;
		this.applyPageSettings();
		this.view.onTabChange(this, true);
	}

	/** The theme in use: this tab's own, or the default from the settings. */
	get effectiveTheme(): WebsiteTheme {
		return this.theme ?? this.view.plugin.settings.websiteTheme;
	}

	setTheme(theme: WebsiteTheme) {
		this.theme = theme;
		this.applyTheme();
		this.view.onTabChange(this, true);
	}

	/** Forces the page's prefers-color-scheme. Auto follows Obsidian's own light or dark theme. */
	applyTheme() {
		if (!this.contents) return;
		let theme = this.effectiveTheme;
		if (theme === 'auto') theme = this.el.ownerDocument.body.hasClass('theme-dark') ? 'dark' : 'light';
		try {
			if (!this.contents.debugger.isAttached()) this.contents.debugger.attach('1.3');
			this.contents.debugger
				.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] })
				.catch((err) => console.error('Web Browser: could not set the website theme.', err));
		} catch (err) {
			// attach throws if DevTools is already attached to this page.
			console.error('Web Browser: could not set the website theme.', err);
		}
	}

	/** Clears back/forward history and reloads, so the page reflects cleared storage. */
	clearHistory() {
		if (!this.ready) return;
		this.webview.clearHistory();
		this.webview.reload();
	}

	destroy() {
		// Electron events arrive asynchronously through remote and can land after the webview is gone.
		// Every webview call checks ready first, so this turns those late events into no-ops.
		this.ready = false;
		this.contents = undefined;
		this.el.remove();
		this.webview.remove();
	}

	private onFirstReady() {
		if (this.ready) return;
		this.ready = true;
		const contents = getRemote()?.webContents.fromId(this.webview.getWebContentsId());
		this.contents = contents;
		// Popups (target=_blank, window.open) open as a new tab in this panel.
		contents?.setWindowOpenHandler(({ url, disposition }) => {
			if (this.ready) this.view.openTab(url, disposition !== 'background-tab', this);
			return { action: 'deny' };
		});
		// Keys pressed inside the page never reach Obsidian's DOM, so the shortcuts are caught here.
		contents?.on('before-input-event', (_e, input) => this.onKey(input));
		contents?.on('audio-state-changed', () => this.updateAudio());
		this.changed(false);
	}

	/** Zoom and theme are re-applied on every page load, since Chromium can reset them per site. */
	private applyPageSettings() {
		if (!this.ready) return;
		this.webview.setZoomFactor(this.zoom);
		this.applyTheme();
	}

	private updateAudio() {
		const muted = this.ready && this.webview.isAudioMuted();
		const audible = this.ready && this.webview.isCurrentlyAudible();
		this.audioEl.toggleClass('is-visible', muted || audible);
		setIcon(this.audioEl, muted ? 'volume-x' : 'volume-2');
		setTooltip(this.audioEl, muted ? 'Unmute tab' : 'Mute tab');
	}

	private onKey(input: KeyInput) {
		if (!this.ready) return;
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
