# IP Version Indicator (Firefox Add-on)

Shows whether the active page is using IPv4 or IPv6. The page action icon (address bar / toolbar area) is dynamically drawn and colored:

* Green (#00c853) – IPv6
* Orange (#ff9800) – IPv4
* Gray (#9e9e9e) – Resolving / unknown

The tooltip includes: version, resolved remote IP, protocol, and a private flag if the address is local / ULA.

## Folder Structure
```
firefox-addon/
	manifest.json
	icons/
	src/
		background.js      # Core logic (IP detection + icon + tooltip)
		popup/             # Lightweight popup UI
			popup.html
			popup.css
			popup.js
```

## How It Works
1. `webNavigation.onBeforeNavigate` resets state when a new top-level navigation starts.
2. `webRequest.onCompleted` (main_frame) provides the resolved `details.ip` we classify as IPv4 / IPv6.
3. A minimal per‑tab state map avoids regressions when other events fire.
4. The icon is drawn on a canvas (OffscreenCanvas when available) for crisp rendering.

## Popup
Compact, read-only view:
* Shows IPv4 / IPv6 label (full text)
* Resolved IP (monospace)
* Protocol and private indicator

No copy buttons or settings—kept intentionally lean per design goal.

## Install (Temporary)
1. Open `about:debugging` → This Firefox → Load Temporary Add-on.
2. Select `manifest.json` inside the `firefox-addon` directory.

## Performance / Footprint
* No external libraries
* No persistent timers
* Work only occurs on navigation and main-frame completion events
* Dynamic icon generation happens at most a few times per page load

## Notes
* Manifest Version: 2 (Firefox continues to support MV2).
* Icon text intentionally kept small; 16px canvas is a hard limit for legibility.

## Possible Future Enhancements
* Reverse DNS lookup (optional, would require a lightweight external API or DNS-over-HTTPS).
* ASN display.
* Per-tab or session history of IP family changes.
* User option to collapse label to 4 / 6 for higher contrast.

---
Feel free to adapt or extend—license / reuse as you wish.
