export const SEARCH_URL = 'https://www.google.com/search?q=';

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
