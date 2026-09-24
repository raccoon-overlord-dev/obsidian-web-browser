# Web Browser

Browse the web inside Obsidian in a tabbed panel. Logins persist between sessions, and you can keep bookmarks or import them from Chrome.

> Work in progress. Not yet published in the community plugin directory.

## Desktop only

This plugin uses Electron's `<webview>` and does not work on Obsidian mobile.

## Network use

The plugin loads the web pages you open and the search engine you choose. It contacts no other service, collects no telemetry and shows no ads.

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
