export const SEARCH_ENGINES = {
	google: { name: 'Google', url: 'https://www.google.com/search?q=' },
	duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
	bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
	brave: { name: 'Brave', url: 'https://search.brave.com/search?q=' },
	startpage: { name: 'Startpage', url: 'https://www.startpage.com/sp/search?query=' },
	ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=' },
};

export type SearchEngine = keyof typeof SEARCH_ENGINES;

export const SEARCH_URL = SEARCH_ENGINES.google.url;

const SCHEME = /^(https?|file|about|data|view-source):/i;
const HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3}|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#]\S*)?$/i;
const LOCAL_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3})([:/?#]|$)/i;

/** Address bar input → URL to load. Non-URLs become a search. Empty input → null. */
export function toUrl(input: string, searchUrl: string = SEARCH_URL): string | null {
	const text = input.trim();
	if (!text) return null;
	if (SCHEME.test(text)) return text;
	if (HOST.test(text)) return (LOCAL_HOST.test(text) ? 'http://' : 'https://') + text;
	return searchUrl + encodeURIComponent(text);
}

/**
 * If `url` is Google's "This browser or app may not be secure" sign-in rejection page, returns where
 * the user was trying to go (to finish in the default browser). Otherwise null.
 */
export function googleSignInBlocked(url: string): string | null {
	let u: URL;
	try {
		u = new URL(url);
	} catch {
		return null;
	}
	// ponytail: matched by URL (/signin/rejected, /v3/signin/rejected, deniedsigninrejected); update if Google renames it.
	if (u.hostname !== 'accounts.google.com' || !/rejected/i.test(u.pathname)) return null;
	const next = u.searchParams.get('continue');
	return next && /^https:\/\//i.test(next) ? next : 'https://accounts.google.com/';
}

/** Readable text for a failed main-frame load (Chromium net error codes). */
export function describeLoadError(code: number, description: string, url: string) {
	let host = url;
	try {
		host = new URL(url).host || url;
	} catch {
		// Keep the raw URL.
	}
	const name = description || `error ${code}`;
	// -200 to -299 are certificate errors.
	if (code <= -200 && code > -300) {
		return {
			title: 'This connection is not secure',
			detail: `${host} has an invalid security certificate (${name}). Web Browser does not open sites with certificate errors.`,
		};
	}
	if (code === -106) return { title: 'No internet connection', detail: `Could not load ${host} (${name}).` };
	if (code === -105 || code === -137) {
		return { title: "This site can't be found", detail: `The address ${host} could not be found (${name}).` };
	}
	return { title: "This page can't be reached", detail: `${host}: ${name}.` };
}
