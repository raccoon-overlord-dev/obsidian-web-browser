import { App, DropdownComponent, Modal, Platform, PluginSettingTab, Setting, SettingDefinitionItem } from 'obsidian';
import type WebBrowserPlugin from './main';
import { IMPORT_FOLDER } from './chrome';
import { SEARCH_ENGINES } from './url';

const LINKS_NAME = 'Open web links from notes in';
const LINKS_DESC =
	'Where http and https links clicked in your notes open. Internal links are not affected. Alternate is the opposite of Click. In source mode, where following a link always needs Ctrl/Cmd, Click is used.';

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
				name: LINKS_NAME,
				desc: LINKS_DESC,
				aliases: ['Ctrl + click', 'Cmd + click'],
				// One row with two dropdowns: a plain click, and a click with Ctrl/Cmd held.
				render: (setting) => {
					setting.setName(LINKS_NAME).setDesc(LINKS_DESC);
					setting.controlEl.addClass('web-browser-link-targets');
					const targets = { browser: 'Web Browser (new tab)', system: 'Default browser' };
					this.addLinkTarget(setting, 'Click', 'openLinksIn', targets);
					this.addLinkTarget(setting, `${Platform.isMacOS ? '⌘' : 'Ctrl'} + click`, 'modClickLinksIn', {
						alternate: 'Alternate',
						...targets,
					});
				},
			},
			{
				name: 'Clip folder',
				desc: 'Where "Clip page to vault" saves pages as notes. Leave empty for the vault root.',
				control: { type: 'text', key: 'clipFolder', placeholder: 'Web clips' },
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
						desc: `Pick a bookmarks HTML export from any browser, or Chrome's own bookmarks file. Only the file you pick is read. Importing again replaces the "${IMPORT_FOLDER}" folder.`,
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

	private addLinkTarget(setting: Setting, label: string, key: string, options: Record<string, string>) {
		const row = setting.controlEl.createEl('label', { cls: 'web-browser-link-target', text: label });
		new DropdownComponent(row)
			.addOptions(options)
			.setValue(String(this.getControlValue(key)))
			.onChange((value) => void this.setControlValue(key, value));
	}

	async setControlValue(key: string, value: unknown) {
		await super.setControlValue(key, value);
		this.plugin.onSettingsChange();
	}
}
