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
