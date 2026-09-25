# Web Browser

Browse the web inside Obsidian in a tabbed panel. Logins persist between sessions, and you can keep bookmarks or import them from Chrome.

- A browser panel with its own tab bar: open several pages side by side with your notes.
- Logins that persist, kept separately for each vault.
- Bookmarks, with import from Chrome or any browser's bookmarks export.
- Clip the current page into your vault as a Markdown note.
- Find in page, zoom, and a light or dark look for websites.
- Web links in your notes can open in the panel instead of your default browser.

Open a browser with the globe icon in the ribbon or the **Open new browser** command. The ☰ menu at the end of the toolbar holds zoom, website theme, find, clipping, bookmarks and data options.

## Installation

Desktop only: the plugin uses Electron's `<webview>` and does not work on Obsidian mobile. It needs Obsidian 1.13.7 or newer.

Manually: download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/raccoon-overlord-dev/obsidian-web-browser/releases/latest), put them in `<your vault>/.obsidian/plugins/web-browser/`, then enable **Web Browser** in **Settings → Community plugins**.

## Settings

- **Search engine**: Google, DuckDuckGo, Bing, Brave, Startpage or Ecosia, for address bar text that is not a web address.
- **Homepage**: the page new tabs open. Empty means a blank tab.
- **Website theme**: Auto (follows Obsidian), light or dark. Each tab can override it from the menu.
- **Open web links from notes in**: Web Browser or your default browser.
- **Clip folder**: where clipped pages are saved.
- **Show the website icon on the Obsidian tab**
- **Import bookmarks from Chrome**
- **Delete all stored data**: signs you out everywhere and deletes this vault's cookies, cache, site storage and tab history.
- **Reset this vault's browser identity**: after duplicating a vault, gives the copy its own empty set of logins.

## Network use

The plugin loads the web pages you open and the search engine you choose. It contacts no other service, collects no telemetry and shows no ads.

Websites run in Chromium's sandbox with no access to Node.js, your vault or your files. It does not access your file system directly: outside the vault, it only reads a bookmarks file that you pick yourself in the file picker (see [Importing from Chrome](#importing-from-chrome)).

## Commands and links

Commands (no default hotkeys; assign your own in **Settings → Hotkeys**):

- **Open new browser**
- **Open URL…**: type an address or a search.
- **New tab**: in the active browser.
- **Toggle bookmark for current page**
- **Find in page**
- **Clip current page to vault**

In the tab bar, drag a tab to move it, double-click an empty spot for a new tab, and right-click a tab to duplicate, pin, reload or close it. Pinned tabs stay at the start of the tab bar, show only the site icon and have no close button.

Inside a browser panel (including inside a page), **Ctrl/Cmd+T** opens a tab, **Ctrl/Cmd+W** closes it and **Ctrl/Cmd+F** finds text in the page. Outside the panel these keys keep their usual Obsidian behavior.

Web links (`http`/`https`) clicked in your notes open as a new tab in Web Browser. Change this with **Open web links from notes in** in the plugin settings to use your default browser instead. Internal links and other link types are not affected.

> **Note:** while this setting is on **Web Browser**, it takes priority over the core **Web viewer** plugin's "Open external links" option: links in notes open in Web Browser, not in Web viewer. To use Web viewer for links, set **Open web links from notes in** to **Default browser**.

## Clipping pages

**Clip page to vault** (menu or command) saves the current page as a Markdown note in the **Clip folder** (default `Web clips`) and opens it. If text is selected, only the selection is saved. Otherwise the plugin extracts the main article, like a reader mode, without menus, ads or footers. The page's title, address, author and dates are saved as note properties. Images stay links to the website.

## Logins

Logins persist between sessions. They are kept per vault, in Obsidian's app data on this computer, not inside the vault, so they do not sync between devices.

Tested on macOS: GitHub, Gmail, Google Calendar and YouTube sign-in work, including Google's "tap yes on your phone" two-step check. Sign-in pop-ups were tested on Linux. Windows is not tested yet.

- Google sign-in is best effort. Google can refuse sign-in from embedded browsers at any time. If it does, a bar above the page offers to continue in your default browser.
- "Sign in with Google" (or Apple, Microsoft…) buttons open a small separate window, as in Chrome. It closes by itself when you are signed in. Tested with Notion and Figma. Links that open a new tab open as a tab in the panel.
- Passkeys stored in a password manager extension are not available, since extensions are not supported.

## Bookmarks

Add or remove the current page with the star in the address bar. Open, search and delete bookmarks from the menu (**Bookmarks…**). Bookmarks are stored in this plugin's `data.json` inside your vault.

### Importing from Chrome

**Import bookmarks from Chrome** (in the menu or the plugin settings) asks you to pick a file:

- a bookmarks HTML export from any browser (in Chrome: bookmark manager → ⋮ → Export bookmarks), or
- the `Bookmarks` file of Chrome or another Chromium-based browser. The import window shows where it is on your system.

The plugin reads only the file you pick, once, and never changes it or remembers where it was.

Imported bookmarks go into an "Imported from Chrome" folder, keeping Chrome's folder structure. Importing again replaces that folder and leaves your own bookmarks alone.

## Limitations

- This is Chromium, not Google Chrome. Chrome profile sync and Chrome extensions are not available.
- Websites cannot use your camera, microphone, location or notifications. These requests are always denied. Only fullscreen and copying to the clipboard are allowed.

## License

[MIT](LICENSE)

Includes [Readability](https://github.com/mozilla/readability) by Mozilla (Apache License 2.0) to extract articles when clipping.
