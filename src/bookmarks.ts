import { App, Modal, Notice, Platform, SearchComponent, setIcon, Setting, setTooltip } from 'obsidian';
import { Bookmark, BOOKMARKS_FILE, IMPORT_FOLDER } from './chrome';
import type WebBrowserPlugin from './main';
import { ConfirmModal } from './settings';

interface Folder {
	name: string;
	path: string[];
	folders: Map<string, Folder>;
	items: Bookmark[];
}

function buildTree(bookmarks: Bookmark[]): Folder {
	const root: Folder = { name: '', path: [], folders: new Map(), items: [] };
	for (const b of bookmarks) {
		let folder = root;
		for (const name of b.folder) {
			let next = folder.folders.get(name);
			if (!next) {
				next = { name, path: [...folder.path, name], folders: new Map(), items: [] };
				folder.folders.set(name, next);
			}
			folder = next;
		}
		folder.items.push(b);
	}
	return root;
}

function countItems(folder: Folder): number {
	let n = folder.items.length;
	for (const f of folder.folders.values()) n += countItems(f);
	return n;
}

/** Lists bookmarks as a folder tree, or as a flat list while searching. Click opens, middle-click opens in a new tab. */
export class BookmarksModal extends Modal {
	private query = '';
	private listEl: HTMLElement;
	private search: SearchComponent;
	/** Folders the user expanded, kept across re-renders. */
	private expanded = new Set<string>();

	constructor(
		app: App,
		private plugin: WebBrowserPlugin,
		private onOpenUrl: (url: string, newTab: boolean) => void,
	) {
		super(app);
		this.setTitle('Bookmarks');
		this.modalEl.addClass('web-browser-bookmarks-modal');
		this.search = new SearchComponent(this.contentEl).setPlaceholder('Search bookmarks').onChange((q) => {
			this.query = q.trim().toLowerCase();
			this.render();
		});
		this.listEl = this.contentEl.createDiv({ cls: 'web-browser-bookmarks' });
		this.render();
	}

	onOpen() {
		this.search.inputEl.focus();
	}

	private render() {
		this.listEl.empty();
		const all = this.plugin.settings.bookmarks;
		if (!all.length) {
			this.listEl.createDiv({
				cls: 'web-browser-bookmarks-empty',
				text: 'No bookmarks yet. Use the star in the address bar, or import them from Chrome.',
			});
			return;
		}
		if (this.query) {
			const hits = all.filter((b) => (b.title + ' ' + b.url).toLowerCase().includes(this.query));
			if (!hits.length) this.listEl.createDiv({ cls: 'web-browser-bookmarks-empty', text: 'No matches.' });
			for (const b of hits) this.renderBookmark(this.listEl, b, true);
			return;
		}
		this.renderFolder(this.listEl, buildTree(all));
	}

	private renderFolder(parent: HTMLElement, folder: Folder) {
		for (const sub of folder.folders.values()) {
			const key = sub.path.join('\u0000');
			// Native <details> handles expand/collapse.
			const details = parent.createEl('details', { cls: 'web-browser-bookmark-folder' });
			details.open = this.expanded.has(key);
			details.addEventListener('toggle', () => {
				if (details.open) this.expanded.add(key);
				else this.expanded.delete(key);
			});
			const summary = details.createEl('summary', { cls: 'web-browser-bookmark-row' });
			const icon = summary.createSpan({ cls: 'web-browser-bookmark-icon' });
			setIcon(icon, 'folder');
			summary.createSpan({ cls: 'web-browser-bookmark-title', text: sub.name });
			const count = countItems(sub);
			summary.createSpan({ cls: 'web-browser-bookmark-url', text: String(count) });
			this.deleteButton(summary, 'Delete folder', () =>
				new ConfirmModal(
					this.app,
					`Delete the folder "${sub.name}"?`,
					`Its ${count} bookmarks are deleted too.`,
					'Delete',
					async () => {
						await this.plugin.removeBookmarks((b) => sub.path.every((name, i) => b.folder[i] === name));
						this.render();
					},
				).open(),
			);
			this.renderFolder(details.createDiv({ cls: 'web-browser-bookmark-children' }), sub);
		}
		for (const b of folder.items) this.renderBookmark(parent, b, false);
	}

	private renderBookmark(parent: HTMLElement, b: Bookmark, showFolder: boolean) {
		const row = parent.createDiv({ cls: 'web-browser-bookmark-row' });
		setTooltip(row, b.url);
		const icon = row.createSpan({ cls: 'web-browser-bookmark-icon' });
		setIcon(icon, 'bookmark');
		row.createSpan({ cls: 'web-browser-bookmark-title', text: b.title });
		row.createSpan({ cls: 'web-browser-bookmark-url', text: showFolder && b.folder.length ? b.folder.join(' › ') : b.url });
		this.deleteButton(row, 'Delete bookmark', async () => {
			await this.plugin.removeBookmarks((x) => x === b);
			this.render();
		});
		row.addEventListener('click', () => this.choose(b.url, false));
		row.addEventListener('mousedown', (e) => {
			if (e.button === 1) e.preventDefault();
		});
		row.addEventListener('auxclick', (e) => {
			if (e.button === 1) this.choose(b.url, true);
		});
	}

	private deleteButton(parent: HTMLElement, label: string, onClick: () => void | Promise<void>) {
		const el = parent.createDiv({ cls: 'clickable-icon web-browser-bookmark-delete' });
		setIcon(el, 'trash-2');
		setTooltip(el, label);
		el.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			void onClick();
		});
	}

	private choose(url: string, newTab: boolean) {
		this.close();
		this.onOpenUrl(url, newTab);
	}
}

/** Where Chrome keeps its bookmarks file on this OS, and how to reach that hidden folder in the file picker. */
function chromeFileHint() {
	if (Platform.isMacOS) {
		return 'it is in ~/Library/Application Support/Google/Chrome/Default (or "Profile 1", "Profile 2"… for other profiles). Press Cmd+Shift+. in the file picker to show hidden folders.';
	}
	if (Platform.isWin) {
		return 'type %LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default in the file picker\'s address bar (or "Profile 1"… for other profiles).';
	}
	return 'it is in ~/.config/google-chrome/Default, or ~/.config/chromium/Default for Chromium ("Profile 1"… for other profiles). Press Ctrl+H in the file picker to show hidden folders.';
}

export class ChromeImportModal extends Modal {
	constructor(
		app: App,
		private plugin: WebBrowserPlugin,
	) {
		super(app);
		this.setTitle('Import bookmarks from Chrome');
		const { contentEl } = this;
		contentEl.createEl('p', {
			text: 'Pick a bookmarks file. The plugin reads only the file you pick, only once, and never changes it.',
		});
		contentEl.createEl('p', {
			text: `Bookmarks go into the "${IMPORT_FOLDER}" folder. Importing again replaces that folder; your own bookmarks are not touched.`,
		});
		const help = contentEl.createEl('ul');
		help.createEl('li', {
			text: 'Easiest, from any browser: export your bookmarks as an HTML file. In Chrome, open the bookmark manager, then use the ⋮ menu to export.',
		});
		help.createEl('li', { text: `Or pick Chrome's own "${BOOKMARKS_FILE}" file: ${chromeFileHint()}` });

		new Setting(contentEl).setName('Bookmarks file').addButton((b) =>
			b
				.setButtonText('Choose file…')
				.setCta()
				.onClick(() => {
					const input = createEl('input', { type: 'file' });
					input.addEventListener('change', () => {
						const file = input.files?.[0];
						if (file) void this.import(() => file.text(), file.name);
					});
					input.click();
				}),
		);
	}

	private async import(read: () => string | Promise<string>, source: string) {
		let count: number;
		try {
			count = await this.plugin.importChromeBookmarks(await read());
		} catch (err) {
			console.error('Web Browser: bookmark import failed.', err);
			new Notice('Could not import: this is not a bookmarks file the plugin can read.');
			return;
		}
		this.close();
		new Notice(`Imported ${count} bookmarks from ${source}.`);
	}
}
