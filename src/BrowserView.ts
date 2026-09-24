import { ItemView, setIcon, setTooltip, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { getRemote, WebviewEvent, WebviewTag } from './electron';
import type WebBrowserPlugin from './main';
import { toUrl } from './url';

export const VIEW_TYPE_BROWSER = 'web-browser-view';

const BLANK = 'about:blank';

export class BrowserView extends ItemView {
	private webview!: WebviewTag;
	private addressEl!: HTMLInputElement;
	private backEl!: HTMLButtonElement;
	private forwardEl!: HTMLButtonElement;
	private reloadEl!: HTMLButtonElement;
	private url = BLANK;
	private title = '';
	private ready = false;
	private loading = false;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: WebBrowserPlugin,
	) {
		super(leaf);
		// Not a navigation view: opening a note must not replace the browser.
		this.navigation = false;
	}

	getViewType() {
		return VIEW_TYPE_BROWSER;
	}

	getDisplayText() {
		return this.title || 'New tab';
	}

	getIcon() {
		return 'globe';
	}

	getState() {
		return { ...super.getState(), url: this.url };
	}

	async setState(state: unknown, result: ViewStateResult) {
		const url = (state as { url?: unknown } | null)?.url;
		if (typeof url === 'string' && url !== this.url) this.navigate(url);
		await super.setState(state, result);
	}

	focusAddress() {
		this.addressEl.focus();
	}

	async onOpen() {
		const root = this.contentEl;
		root.empty();
		root.addClass('web-browser');

		const bar = root.createDiv({ cls: 'web-browser-toolbar' });
		this.backEl = this.button(bar, 'arrow-left', 'Back', () => this.webview.goBack());
		this.forwardEl = this.button(bar, 'arrow-right', 'Forward', () => this.webview.goForward());
		this.reloadEl = this.button(bar, 'rotate-cw', 'Reload', () =>
			this.loading ? this.webview.stop() : this.webview.reload(),
		);
		this.addressEl = bar.createEl('input', {
			type: 'text',
			cls: 'web-browser-address',
			attr: { placeholder: 'Search or enter address', spellcheck: 'false' },
		});
		this.registerDomEvent(this.addressEl, 'focus', () => this.addressEl.select());
		this.registerDomEvent(this.addressEl, 'keydown', (e) => {
			if (e.key === 'Enter') {
				const url = toUrl(this.addressEl.value);
				if (url) {
					this.navigate(url);
					this.webview.focus();
				}
			} else if (e.key === 'Escape') {
				// Keep Obsidian from also handling Esc (it switched to another tab).
				e.preventDefault();
				e.stopPropagation();
				// Blur first: showUrl skips the address bar while it has focus.
				this.addressEl.blur();
				this.showUrl();
			}
		});

		// partition and allowpopups only take effect if set before the webview is attached.
		// Created detached in this leaf's window, then appended below.
		// No src until there is a real URL: an initial about:blank load can finish after
		// setState has restored the saved URL and overwrite it.
		const webview = root.ownerDocument.win.createEl('webview', {
			cls: 'web-browser-webview',
			attr: { partition: this.plugin.partition, allowpopups: '' },
		});
		if (this.url !== BLANK) webview.setAttribute('src', this.url);
		this.webview = webview;

		const on = (type: string, fn: (e: WebviewEvent) => void) =>
			webview.addEventListener(type, (e) => fn(e as WebviewEvent));
		on('dom-ready', () => this.onFirstReady());
		on('did-start-loading', () => this.setLoading(true));
		on('did-stop-loading', () => this.setLoading(false));
		on('did-navigate', (e) => this.onNavigate(e.url));
		on('did-navigate-in-page', (e) => e.isMainFrame && this.onNavigate(e.url));
		on('page-title-updated', (e) => {
			this.title = e.title ?? '';
			this.updateHeader();
		});

		root.appendChild(webview);
		this.updateButtons();
	}

	async onClose() {
		this.contentEl.empty();
	}

	private navigate(url: string) {
		this.url = url;
		if (!this.webview) return; // onOpen will load this.url
		// loadURL throws until the first dom-ready; before that, swapping src is enough.
		// Rejections are aborted or failed loads (for example ERR_ABORTED when a new navigation starts).
		if (this.ready) this.webview.loadURL(url).catch(() => {});
		else this.webview.setAttribute('src', url);
		this.showUrl();
	}

	private onFirstReady() {
		if (this.ready) return;
		this.ready = true;
		// Popups (target=_blank, window.open) load in this view instead of opening a new window.
		const contents = getRemote()?.webContents.fromId(this.webview.getWebContentsId());
		contents?.setWindowOpenHandler(({ url }) => {
			this.navigate(url);
			return { action: 'deny' };
		});
		this.updateButtons();
	}

	private onNavigate(url: string | undefined) {
		if (!url) return;
		this.url = url;
		if (url === BLANK) {
			this.title = '';
			this.updateHeader();
		}
		this.showUrl();
		this.updateButtons();
		void this.app.workspace.requestSaveLayout();
	}

	private setLoading(loading: boolean) {
		this.loading = loading;
		this.updateButtons();
	}

	private showUrl() {
		if (this.addressEl.ownerDocument.activeElement === this.addressEl) return;
		this.addressEl.value = this.url === BLANK ? '' : this.url;
	}

	private updateButtons() {
		this.backEl.disabled = !this.ready || !this.webview.canGoBack();
		this.forwardEl.disabled = !this.ready || !this.webview.canGoForward();
		setIcon(this.reloadEl, this.loading ? 'x' : 'rotate-cw');
		setTooltip(this.reloadEl, this.loading ? 'Stop' : 'Reload');
	}

	private updateHeader() {
		// Neither is in the public API. updateHeader refreshes the tab title, titleEl is the view header title.
		(this as unknown as { titleEl?: HTMLElement }).titleEl?.setText(this.getDisplayText());
		(this.leaf as unknown as { updateHeader?: () => void }).updateHeader?.();
	}

	private button(parent: HTMLElement, icon: string, label: string, onClick: () => void) {
		const el = parent.createEl('button', { cls: 'clickable-icon web-browser-button' });
		setIcon(el, icon);
		setTooltip(el, label);
		this.registerDomEvent(el, 'click', onClick);
		return el;
	}
}
