# Third-party software

- Electron/Chromium: official Electron 44.7.2 binaries, downloaded with the SHA-256
  checksums supplied by the npm Electron package. Retained licenses include
  `Contents/LICENSE`, `Contents/LICENSES.chromium.html`, and framework resources.
- Koffi 3.3.3: MIT, with its license retained in the app's `node_modules/koffi`.
  Architecture-specific prebuilt libraries come from the pinned npm packages.
- ImageTracer.js 1.2.6 by András Jankovics: Unlicense/public domain, vendored from
  the npm release. Source and license are in `src/vendor`. Used to trace binary
  contours; ImagePlotter samples its vector curves into mouse strokes.

The app is independent of the earlier Roblox executor and Rivals script.
