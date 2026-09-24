import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeLoadError, googleSignInBlocked, SEARCH_ENGINES, toUrl } from '../src/url.ts';

const S = 'https://search.test/?q=';

test('toUrl', () => {
	assert.equal(toUrl('   ', S), null);
	assert.equal(toUrl('https://github.com/x', S), 'https://github.com/x');
	assert.equal(toUrl('about:blank', S), 'about:blank');
	assert.equal(toUrl('github.com', S), 'https://github.com');
	assert.equal(toUrl('mail.google.com/mail/u/0/#inbox', S), 'https://mail.google.com/mail/u/0/#inbox');
	assert.equal(toUrl('1password.com', S), 'https://1password.com');
	assert.equal(toUrl('localhost:3000', S), 'http://localhost:3000');
	assert.equal(toUrl('192.0.2.10/admin', S), 'http://192.0.2.10/admin');
	assert.equal(toUrl('obsidian plugins', S), S + 'obsidian%20plugins');
	assert.equal(toUrl('typescript', S), S + 'typescript');
	assert.equal(toUrl('what is 2.5 in hex', S), S + 'what%20is%202.5%20in%20hex');
	assert.equal(toUrl('a b', SEARCH_ENGINES.startpage.url), 'https://www.startpage.com/sp/search?query=a%20b');
});

test('googleSignInBlocked', () => {
	assert.equal(googleSignInBlocked('https://github.com/login'), null);
	assert.equal(googleSignInBlocked('https://accounts.google.com/v3/signin/identifier?continue=x'), null);
	assert.equal(
		googleSignInBlocked('https://accounts.google.com/v3/signin/rejected?continue=https%3A%2F%2Fmail.google.com%2F&flowName=x'),
		'https://mail.google.com/',
	);
	assert.equal(googleSignInBlocked('https://accounts.google.com/signin/rejected'), 'https://accounts.google.com/');
	assert.equal(googleSignInBlocked('https://accounts.google.com/signin/rejected?continue=javascript:1'), 'https://accounts.google.com/');
	assert.equal(googleSignInBlocked('not a url'), null);
});

test('describeLoadError', () => {
	assert.equal(describeLoadError(-202, 'ERR_CERT_AUTHORITY_INVALID', 'https://self-signed.badssl.com/').title, 'This connection is not secure');
	assert.match(describeLoadError(-105, 'ERR_NAME_NOT_RESOLVED', 'https://nope.invalid/x').detail, /nope\.invalid/);
	assert.equal(describeLoadError(-102, 'ERR_CONNECTION_REFUSED', 'http://localhost:9/').detail, 'localhost:9: ERR_CONNECTION_REFUSED.');
	assert.equal(describeLoadError(-2, '', 'weird').detail, 'weird: error -2.');
});
