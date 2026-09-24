# Web Browser

Browse the web inside Obsidian in a tabbed panel. Logins persist between sessions, and you can keep bookmarks or import them from Chrome.

> Work in progress. Not yet published in the community plugin directory.

## Desktop only

This plugin uses Electron's `<webview>` and does not work on Obsidian mobile.

## Network use

The plugin loads the web pages you open and the search engine you choose. It contacts no other service, collects no telemetry and shows no ads.

## Logins

Logins persist between sessions. They are kept per vault, in Obsidian's app data on this computer, not inside the vault, so they do not sync between devices.

Tested on macOS: GitHub, Gmail, Google Calendar and YouTube sign-in work, including Google's "tap yes on your phone" two-step check. Linux and Windows are not tested yet.

- Google sign-in is best effort. Google can refuse sign-in from embedded browsers at any time. If it does, a bar above the page offers to continue in your default browser.
- "Sign in with Google" buttons on other sites open Google in a small separate window, as in Chrome. It closes by itself when you are signed in.
- Passkeys stored in a password manager extension are not available, since extensions are not supported.

## Bookmarks

Add or remove the current page with the star in the address bar. Open, search and delete bookmarks from the menu (**Bookmarks…**). Bookmarks are stored in this plugin's `data.json` inside your vault.

### Importing from Chrome

**Import bookmarks from Chrome** (in the menu or the plugin settings) reads the `Bookmarks` file of Google Chrome or Chromium on your computer. This file is **outside your vault**. The plugin only reads it, never changes it, and only when you click import. The file's location is not saved. You can also pick a file by hand: a bookmarks HTML file exported from any browser, or the `Bookmarks` file of another Chromium-based browser.

Imported bookmarks go into an "Imported from Chrome" folder, keeping Chrome's folder structure. Importing again replaces that folder and leaves your own bookmarks alone.

## Limitations

- This is Chromium, not Google Chrome. Chrome profile sync and Chrome extensions are not available.
- Websites cannot use your camera, microphone, location or notifications. These requests are always denied. Only fullscreen and copying to the clipboard are allowed.

## License

[MIT](LICENSE)
