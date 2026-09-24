import { App, Modal, TextComponent } from 'obsidian';
import type WebBrowserPlugin from './main';
import { toUrl } from './url';

const WEB_URL = /^https?:\/\//i;

/**
 * Sends http/https links clicked in notes to the browser panel (when the setting says so).
 * Two paths lead out of Obsidian, so both are covered for `win` (the main window or a pop-out):
 * - rendered links (reading view, embeds, callouts, canvas cards) are `<a href>` elements whose
 *   default click opens the system browser without calling `window.open`;
 * - the editor (live preview and source mode) opens links with `window.open`.
 * Internal links, `obsidian://` and every other scheme are left alone.
 */
export function routeLinks(plugin: WebBrowserPlugin, win: Window) {
	const enabled = (url: unknown): url is string =>
		plugin.settings.openLinksIn === 'browser' && typeof url === 'string' && WEB_URL.test(url);

	plugin.registerDomEvent(
		win.document,
		'click',
		(e) => {
			if (e.button !== 0) return;
			const a = (e.target as HTMLElement | null)?.closest?.('a');
			// Only links inside notes, not Obsidian's own UI (settings, plugin pages) or this plugin's views.
			if (!a || !enabled(a.href) || !a.closest('.markdown-rendered, .cm-editor')) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			void plugin.openUrl(a.href);
		},
		// Capture, so Obsidian's own link handlers never see the click.
		{ capture: true },
	);

	// Bound, so restoring it on unload also leaves a working window.open.
	const original = win.open.bind(win);
	win.open = (url?: string | URL, target?: string, features?: string) => {
		const href = url instanceof URL ? url.href : url;
		// window.open is also used by Obsidian's own UI and other plugins. Only take it over while a
		// note editor has focus, which is the case when a link in it was just clicked.
		const fromEditor = !!win.document.activeElement?.closest('.cm-editor');
		if (!fromEditor || !enabled(href)) return original(url, target, features);
		void plugin.openUrl(href);
		return null;
	};
	plugin.register(() => {
		win.open = original;
	});
}

/** "Open URL…" command: an address bar in a modal. Search text works too. */
export class OpenUrlModal extends Modal {
	private input: TextComponent;

	constructor(
		app: App,
		private plugin: WebBrowserPlugin,
	) {
		super(app);
		this.setTitle('Open URL');
		const input = (this.input = new TextComponent(this.contentEl).setPlaceholder('Search or enter address'));
		input.inputEl.addClass('web-browser-open-url');
		input.inputEl.addEventListener('keydown', (e) => {
			if (e.key !== 'Enter' || e.isComposing) return;
			const url = toUrl(input.getValue(), plugin.searchUrl);
			if (!url) return;
			this.close();
			void this.plugin.openUrl(url);
		});
	}

	onOpen() {
		this.input.inputEl.focus();
	}
}
