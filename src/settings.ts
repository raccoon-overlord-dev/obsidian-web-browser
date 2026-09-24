import { App, Modal, PluginSettingTab, Setting, SettingDefinitionItem } from 'obsidian';
import type WebBrowserPlugin from './main';
import { IMPORT_FOLDER } from './chrome';
import { SEARCH_ENGINES } from './url';

export class ConfirmModal extends Modal {
	constructor(app: App, title: string, text: string, button: string, onConfirm: () => void | Promise<void>) {
		super(app);
		this.setTitle(title);
		this.contentEl.createEl('p', { text });
		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(button)
					.setDestructive()
					.setCta()
					.onClick(() => {
						this.close();
						void onConfirm();
					}),
			);
	}
}

export class WebBrowserSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: WebBrowserPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const engines = Object.fromEntries(Object.entries(SEARCH_ENGINES).map(([id, e]) => [id, e.name]));
		return [
			{
				name: 'Search engine',
				desc: 'Used when the address bar text is not a web address.',
				control: { type: 'dropdown', key: 'searchEngine', options: engines },
			},
			{
				name: 'Homepage',
				desc: 'Opened in every new tab. Leave empty for a blank page.',
				control: { type: 'text', key: 'homepage', placeholder: 'https://example.com' },
			},
			{
				name: 'Website theme',
				desc: 'Default light or dark look for websites that support it. Auto follows Obsidian. Each tab can override it from the menu.',
				control: {
					type: 'dropdown',
					key: 'websiteTheme',
					options: { auto: 'Auto', light: 'Light', dark: 'Dark' },
				},
			},
			{
				name: 'Open web links from notes in',
				desc: 'Where http and https links clicked in your notes open. Internal links are not affected.',
				control: {
					type: 'dropdown',
					key: 'openLinksIn',
					options: { browser: 'Web Browser (new tab)', system: 'Default browser' },
				},
			},
			{
				name: 'Show the website icon on the Obsidian tab',
				desc: 'Otherwise the Obsidian tab shows a globe.',
				control: { type: 'toggle', key: 'faviconInTab' },
			},
			{
				type: 'group',
				heading: 'Bookmarks',
				items: [
					{
						name: 'Import bookmarks from Chrome',
						desc: `Reads the bookmarks file of Google Chrome or Chromium on this computer, outside the vault. Read-only, and only when you import. Importing again replaces the "${IMPORT_FOLDER}" folder.`,
						action: () => this.plugin.openChromeImport(),
					},
				],
			},
			{
				type: 'group',
				heading: 'Stored data',
				items: [
					{
						name: 'Delete all stored data',
						desc: "Signs you out of every website and deletes this vault's cookies, cache, site storage and tab history. Other vaults are not affected.",
						action: () => this.plugin.confirmDeleteAllData(),
					},
					{
						name: "Reset this vault's browser identity",
						desc: 'Use after duplicating a vault, so the copy stops sharing logins with the original. Open browsers start signed out. The old logins stay available to the original vault; to wipe them too, delete all stored data first.',
						action: () => this.plugin.confirmResetIdentity(),
					},
				],
			},
		];
	}

	async setControlValue(key: string, value: unknown) {
		await super.setControlValue(key, value);
		this.plugin.onSettingsChange();
	}
}
