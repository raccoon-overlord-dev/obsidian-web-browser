import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toUrl } from '../src/url.ts';

const S = 'https://search.test/?q=';

test('toUrl', () => {
	assert.equal(toUrl('   ', S), null);
	assert.equal(toUrl('https://github.com/x', S), 'https://github.com/x');
	assert.equal(toUrl('about:blank', S), 'about:blank');
	assert.equal(toUrl('github.com', S), 'https://github.com');
	assert.equal(toUrl('mail.google.com/mail/u/0/#inbox', S), 'https://mail.google.com/mail/u/0/#inbox');
	assert.equal(toUrl('1password.com', S), 'https://1password.com');
	assert.equal(toUrl('localhost:3000', S), 'http://localhost:3000');
	assert.equal(toUrl('192.168.1.10/admin', S), 'http://192.168.1.10/admin');
	assert.equal(toUrl('obsidian plugins', S), S + 'obsidian%20plugins');
	assert.equal(toUrl('typescript', S), S + 'typescript');
	assert.equal(toUrl('what is 2.5 in hex', S), S + 'what%20is%202.5%20in%20hex');
});
