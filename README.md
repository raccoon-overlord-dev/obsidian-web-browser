# Web Browser

Browse the web inside Obsidian in a tabbed panel. Logins persist between sessions, and you can keep bookmarks or import them from Chrome.

> Work in progress. Not yet published in the community plugin directory.

## Desktop only

This plugin uses Electron's `<webview>` and does not work on Obsidian mobile.

## Network use

The plugin loads the web pages you open and the search engine you choose. It contacts no other service, collects no telemetry and shows no ads.

Websites run in Chromium's sandbox with no access to Node.js, your vault or your files. Outside the vault, the plugin only reads a browser bookmarks file, and only when you import one (see [Importing from Chrome](#importing-from-chrome)).

## Commands and links

Commands (no default hotkeys; assign your own in **Settings → Hotkeys**):

- **Open new browser**
- **Open URL…**: type an address or a search.
- **New tab**: in the active browser.
- **Toggle bookmark for current page**

Web links (`http`/`https`) clicked in your notes open as a new tab in Web Browser. Change this with **Open web links from notes in** in the plugin settings to use your default browser instead. Internal links and other link types are not affected.

> **Note:** while this setting is on **Web Browser**, it takes priority over the core **Web viewer** plugin's "Open external links" option: links in notes open in Web Browser, not in Web viewer. To use Web viewer for links, set **Open web links from notes in** to **Default browser**.

## Logins

Logins persist between sessions. They are kept per vault, in Obsidian's app data on this computer, not inside the vault, so they do not sync between devices.

Tested on macOS: GitHub, Gmail, Google Calendar and YouTube sign-in work, including Google's "tap yes on your phone" two-step check. Linux and Windows are not tested yet.

- Google sign-in is best effort. Google can refuse sign-in from embedded browsers at any time. If it does, a bar above the page offers to continue in your default browser.
- "Sign in with Google" (or Apple, Microsoft…) buttons that open a pop-up window do not work: pop-ups open as a tab, and the site cannot finish the sign-in there (Notion, for example, reports blocked pop-ups). Use the site's email sign-in, or open the site in your default browser from the menu.
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
