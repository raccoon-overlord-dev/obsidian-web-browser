import { isProbablyReaderable, Readability } from '@mozilla/readability';
import { htmlToMarkdown, moment, normalizePath, Notice } from 'obsidian';
import type { BrowserTab } from './BrowserTab';
import type WebBrowserPlugin from './main';

// Runs in an isolated world of the page, so the page's own scripts cannot change what it returns.
const READ_PAGE = `(() => {
	const serializer = new XMLSerializer();
	const selection = getSelection();
	let selected = '';
	if (selection && !selection.isCollapsed) {
		const box = document.createElement('div');
		for (let i = 0; i < selection.rangeCount; i++) box.appendChild(selection.getRangeAt(i).cloneContents());
		selected = serializer.serializeToString(box);
	}
	return { html: serializer.serializeToString(document), url: location.href, title: document.title, selected };
})()`;

interface PageContent {
	html: string;
	url: string;
	title: string;
	selected: string;
}

/** Parses HTML without running scripts or loading anything, with relative links resolved against `url`. */
function parse(html: string, url: string) {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	doc.head.prepend(createEl('base', { attr: { href: url } }));
	for (const attr of ['href', 'src']) {
		for (const el of Array.from(doc.querySelectorAll(`[${attr}]`))) {
			try {
				el.setAttribute(attr, new URL(el.getAttribute(attr) ?? '', url).href);
			} catch {
				// Leave unparsable values alone.
			}
		}
	}
	return doc;
}

/** A file name from a page title: no characters that are invalid in file names or Obsidian links. */
function fileName(title: string) {
	return title
		.replace(/[\\/:*?"<>|#^[\]]/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/^[\s.]+/, '')
		.trim()
		.slice(0, 100);
}

/**
 * Saves the tab's page as a Markdown note: the selected text if there is any, otherwise the main
 * article (as in reader mode). Title, address, author and dates go into the note's properties.
 */
export async function clipPage(plugin: WebBrowserPlugin, tab: BrowserTab) {
	const { app } = plugin;
	let page: PageContent;
	try {
		page = (await tab.runInPage(READ_PAGE)) as PageContent;
	} catch (err) {
		console.error('Web Browser: could not read the page.', err);
		new Notice('Could not read this page.');
		return;
	}

	let title = page.title || tab.title;
	let body: string;
	let byline: string | null = null;
	let published: string | null = null;
	if (page.selected) {
		body = htmlToMarkdown(parse(page.selected, page.url).body);
	} else {
		const doc = parse(page.html, page.url);
		// Readability finds "an article" on almost any page (a consent screen, a search page), so ask
		// first whether the page looks like one at all.
		const article = isProbablyReaderable(doc) ? new Readability(doc).parse() : null;
		if (article?.content) {
			body = htmlToMarkdown(article.content);
			title = article.title || title;
			byline = article.byline ?? null;
			published = article.publishedTime ?? null;
		} else {
			body = '';
			new Notice('No article found on this page. Saved the title and address only.');
		}
	}

	const folder = normalizePath(plugin.settings.clipFolder.trim() || '/');
	if (folder !== '/' && !app.vault.getFolderByPath(folder)) await app.vault.createFolder(folder);
	const prefix = folder === '/' ? '' : `${folder}/`;
	const name = fileName(title) || new URL(page.url).hostname || 'Web clip';
	let path = normalizePath(`${prefix}${name}.md`);
	for (let n = 2; app.vault.getAbstractFileByPath(path); n++) path = normalizePath(`${prefix}${name} ${n}.md`);

	const file = await app.vault.create(path, body);
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm.title = title;
		fm.source = page.url;
		if (byline) fm.author = byline;
		if (published) fm.published = published;
		fm.clipped = moment().format('YYYY-MM-DD');
	});
	await app.workspace.getLeaf('tab').openFile(file);
}
