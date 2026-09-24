// Chrome bookmark import. Reads Chrome's own `Bookmarks` file (read-only, only when the user imports).
// Kept free of Obsidian imports so the parser can be tested with plain Node.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/** Top-level folder that holds imported bookmarks. Re-importing replaces it. */
export const IMPORT_FOLDER = 'Imported from Chrome';
/** Name of Chrome's bookmarks file inside a profile folder. */
export const BOOKMARKS_FILE = 'Bookmarks';

export interface Bookmark {
	title: string;
	url: string;
	/** Folder path from the root, for example ['Imported from Chrome', 'Bookmarks bar']. Empty for the root. */
	folder: string[];
}

export interface ChromeProfile {
	/** For example "Google Chrome: Work". */
	label: string;
	path: string;
}

interface ChromeNode {
	type?: string;
	name?: string;
	url?: string;
	children?: ChromeNode[];
}

/** Reads either Chrome's own `Bookmarks` JSON file or an exported bookmarks HTML file. */
export function parseBookmarksFile(text: string, root: string[]): Bookmark[] {
	return text.trimStart().startsWith('<') ? parseBookmarksHtml(text, root) : parseChromeBookmarks(text, root);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string) {
	return s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) => {
		if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
		const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
		return Number.isFinite(code) ? String.fromCodePoint(code) : m;
	});
}

/**
 * Parses the "Netscape bookmark file" HTML that Chrome, Firefox, Safari and Edge export.
 * Folders are `<H3>name</H3>` followed by a `<DL>` list; bookmarks are `<A HREF="...">title</A>`.
 */
export function parseBookmarksHtml(html: string, root: string[]): Bookmark[] {
	if (!/<!DOCTYPE NETSCAPE-Bookmark-file-1>/i.test(html)) throw new Error('Not a bookmarks export file.');
	const out: Bookmark[] = [];
	// One entry per open <DL>: the folder name it belongs to, or null for the outer list.
	const stack: (string | null)[] = [];
	let pendingFolder: string | null = null;
	const folder = () => [...root, ...stack.filter((n): n is string => n !== null)];
	for (const m of html.matchAll(/<(\/?)(dl|h3|a)\b([^>]*)>([^<]*)/gi)) {
		const [, close, tag, attrs, text] = m as unknown as [string, string, string, string, string];
		const name = tag.toLowerCase();
		if (name === 'dl') {
			if (close) stack.pop();
			else {
				stack.push(pendingFolder);
				pendingFolder = null;
			}
		} else if (!close && name === 'h3') {
			pendingFolder = decodeEntities(text.trim()) || 'Untitled folder';
		} else if (!close && name === 'a') {
			const href = /\bhref\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
			const url = href && decodeEntities(href);
			if (url && !/^javascript:/i.test(url)) out.push({ title: decodeEntities(text.trim()) || url, url, folder: folder() });
		}
	}
	return out;
}

/** Turns the JSON of a Chrome `Bookmarks` file into bookmarks under `root`, keeping the folder tree. */
export function parseChromeBookmarks(json: string, root: string[]): Bookmark[] {
	const data = JSON.parse(json) as { roots?: Record<string, ChromeNode | undefined> };
	if (!data.roots || typeof data.roots !== 'object') throw new Error('Not a Chrome bookmarks file.');
	const out: Bookmark[] = [];
	const walk = (node: ChromeNode, folder: string[]) => {
		if (node.type === 'url') {
			// Bookmarklets would run as page script; skip them.
			if (typeof node.url === 'string' && !/^javascript:/i.test(node.url)) {
				out.push({ title: node.name || node.url, url: node.url, folder });
			}
		} else if (Array.isArray(node.children)) {
			const path = [...folder, node.name || 'Untitled folder'];
			for (const child of node.children) walk(child, path);
		}
	};
	for (const key of ['bookmark_bar', 'other', 'synced']) {
		const node = data.roots[key];
		if (node) walk(node, root);
	}
	return out;
}

/** Chrome and Chromium user data folders for this OS. */
function browserDirs(): [string, string][] {
	const home = homedir();
	if (process.platform === 'darwin') {
		const base = join(home, 'Library', 'Application Support');
		return [
			['Google Chrome', join(base, 'Google', 'Chrome')],
			['Chromium', join(base, 'Chromium')],
		];
	}
	if (process.platform === 'win32') {
		const base = process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local');
		return [
			['Google Chrome', join(base, 'Google', 'Chrome', 'User Data')],
			['Chromium', join(base, 'Chromium', 'User Data')],
		];
	}
	const base = process.env.XDG_CONFIG_HOME ?? join(home, '.config');
	return [
		['Google Chrome', join(base, 'google-chrome')],
		['Chromium', join(base, 'chromium')],
	];
}

/** Every Chrome/Chromium profile on this machine that has a `Bookmarks` file. Paths are detected fresh each time. */
export function findChromeProfiles(): ChromeProfile[] {
	const profiles: ChromeProfile[] = [];
	for (const [browser, dir] of browserDirs()) {
		if (!existsSync(dir)) continue;
		// "Local State" maps profile folders to the names shown in Chrome.
		let names: Record<string, { name?: string } | undefined> = {};
		try {
			const state = JSON.parse(readFileSync(join(dir, 'Local State'), 'utf8')) as {
				profile?: { info_cache?: typeof names };
			};
			names = state.profile?.info_cache ?? {};
		} catch {
			// No names; fall back to folder names.
		}
		for (const entry of readdirSync(dir)) {
			if (entry !== 'Default' && !/^Profile \d+$/.test(entry)) continue;
			const path = join(dir, entry, BOOKMARKS_FILE);
			if (existsSync(path)) profiles.push({ label: `${browser}: ${names[entry]?.name || entry}`, path });
		}
	}
	return profiles;
}

export function readBookmarksFile(path: string) {
	return readFileSync(path, 'utf8');
}
