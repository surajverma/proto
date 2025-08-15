# Proto – See if a site uses IPv4 or IPv6 on Firefox

Ever wondered if a website is using IPv4 or IPv6? Proto makes it easy: just look at the toolbar icon. This extension shows which IP version is being used to reach the current site and displays the actual IP address in a simple popup.

## What does it do?

- Instantly shows whether the site you are visiting is using IPv4 (orange) or IPv6 (green).
- Displays the resolved IP address in the toolbar and in the popup.
- Tooltip includes protocol and whether the address is private/local.

## How it works

Proto listens for navigation and network events in the browser, determines the resolved address for the active tab when available, and updates the toolbar icon and tooltip. It prefers in-browser network events but falls back to a DNS lookup when the browser does not provide the address.

## Using the popup

Click the toolbar icon to see:

- IP version (IPv4 or IPv6)
- Resolved IP address
- Protocol (HTTP/HTTPS)
- Indicator if the address is private/local

No settings—just a compact, read-only view so you can quickly check connectivity details.

## Install (development)

1. Open `about:debugging` in Firefox.
2. Click "This Firefox" → "Load Temporary Add-on".
3. Select the `manifest.json` file from this folder.

## Project structure

```
manifest.json
icons/
src/
  background.js      # Main logic (IP detection, icon, tooltip)
  popup/
    popup.html
    popup.css
    popup.js
```

## Why use Proto?

- No external services or tracking
- Low overhead: only runs on navigation/network events
- Small, focused UI
- Open source and easy to extend

---

Proto is open source and free to use. Contributions and suggestions are welcome.
