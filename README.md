# Web Browser

Browse the web inside Obsidian in a tabbed panel. Logins persist between sessions, and you can keep bookmarks or import them from Chrome.

> Work in progress. Not yet published in the community plugin directory.

## Desktop only

This plugin uses Electron's `<webview>` and does not work on Obsidian mobile.

## Network use

The plugin loads the web pages you open and the search engine you choose. It contacts no other service, collects no telemetry and shows no ads.

## Limitations

- This is Chromium, not Google Chrome. Chrome profile sync and Chrome extensions are not available.
- Websites cannot use your camera, microphone, location or notifications. These requests are always denied. Only fullscreen and copying to the clipboard are allowed.

## License

[MIT](LICENSE)
