import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBookmarksFile, parseChromeBookmarks } from '../src/chrome.ts';

test('parseChromeBookmarks', () => {
	const json = JSON.stringify({
		version: 1,
		roots: {
			bookmark_bar: {
				type: 'folder',
				name: 'Bookmarks bar',
				children: [
					{ type: 'url', name: 'GitHub', url: 'https://github.com/' },
					{ type: 'folder', name: 'Dev', children: [{ type: 'url', name: '', url: 'https://mdn.dev/' }] },
					{ type: 'url', name: 'Bookmarklet', url: 'javascript:alert(1)' },
				],
			},
			other: { type: 'folder', name: 'Other bookmarks', children: [] },
			synced: { type: 'folder', name: 'Mobile bookmarks', children: [{ type: 'url', name: 'Wiki', url: 'https://wikipedia.org/' }] },
		},
	});
	assert.deepEqual(parseChromeBookmarks(json, ['Imported']), [
		{ title: 'GitHub', url: 'https://github.com/', folder: ['Imported', 'Bookmarks bar'] },
		{ title: 'https://mdn.dev/', url: 'https://mdn.dev/', folder: ['Imported', 'Bookmarks bar', 'Dev'] },
		{ title: 'Wiki', url: 'https://wikipedia.org/', folder: ['Imported', 'Mobile bookmarks'] },
	]);
	assert.throws(() => parseChromeBookmarks('{}', []));
	assert.throws(() => parseChromeBookmarks('not json', []));
});

test('parseBookmarksFile reads an exported HTML file', () => {
	const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://github.com/" ADD_DATE="1" ICON="data:image/png;base64,AAA">GitHub</A>
        <DT><H3>Dev &amp; docs</H3>
        <DL><p>
            <DT><A HREF="https://example.com/?a=1&amp;b=2">A &lt;b&gt; &#39;c&#39;</A>
        </DL><p>
        <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
    </DL><p>
    <DT><A HREF="https://wikipedia.org/"></A>
</DL><p>
`;
	assert.deepEqual(parseBookmarksFile(html, ['Imported']), [
		{ title: 'GitHub', url: 'https://github.com/', folder: ['Imported', 'Bookmarks bar'] },
		{ title: "A <b> 'c'", url: 'https://example.com/?a=1&b=2', folder: ['Imported', 'Bookmarks bar', 'Dev & docs'] },
		{ title: 'https://wikipedia.org/', url: 'https://wikipedia.org/', folder: ['Imported'] },
	]);
	assert.throws(() => parseBookmarksFile('<html><body>hi</body></html>', []));
});
