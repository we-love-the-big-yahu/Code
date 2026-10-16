# ImagePlotter for Mac — first test build

Choose an image, preview a line-art or shaded-sketch rendering, then let normal
macOS mouse events draw those strokes inside a canvas you select. This does not
use a Roblox executor or access another application's process memory.

## Install

The download includes **ImagePlotter.app**, the complete packaged application.
No Python, Node, CMake, or Xcode installation is needed to run it.

1. Extract the ZIP.
2. Open Terminal, type `bash `, drag `Install-ImagePlotter.command` from the
   extracted folder into the Terminal window, and press Return.
3. The installer copies the app into your user Applications folder, preserves an
   older installation as a backup, and locally signs this app using macOS's own
   `codesign` tool. It does not change system security settings.
4. If macOS asks whether to open an unnotarized app, review the app and use its
   normal **Privacy & Security → Open Anyway** option. This first build has no
   Apple Developer ID/notarization. Do not disable Gatekeeper or SIP.
5. In **System Settings → Privacy & Security → Accessibility**, add/enable the
   installed ImagePlotter app. Reopen ImagePlotter if permission remains pending.

## Draw

1. Open an image in ImagePlotter. Adjust style, detail, sensitivity and speed.
2. Open a website, Roblox drawing game, or Mac app with a canvas. Choose its brush,
   a small brush size, and your desired drawing color. Drawing uses that color;
   this release does not automatically reproduce a full-color image.
3. Choose **Select drawing area**, then drag a box inside the canvas. Leave its
   toolbars, buttons, palettes and window borders outside the box. The image is
   fitted into the box without stretching. A selection stays on one display.
4. Click **Start drawing**. During the five-second countdown, focus the target
   drawing canvas. Keep the canvas stationary and the target brush selected.
5. Press **Escape** to stop immediately. A second stop shortcut is **Cmd+Alt+S**.
   Moving the pointer to the primary screen's top-left corner also stops it.
   Opening ImagePlotter during drawing stops the current drawing.

Test a simple picture at a slow speed first. Applications that reject simulated
mouse input, require a special brush/input mode, move their canvas, or throttle
updates may not work. This app cannot guarantee compatibility with every game or
website. Do not use keyboard/mouse controls elsewhere during automatic drawing.

## Privacy and verification

Images are processed locally, and the app has no image-upload service or network
UI. Test coverage exercises image tracing, bounded geometry, aspect ratios,
countdown cancellation, mouse release on failure, and emergency stops using a
recording mouse adapter. Browser UI tests use a local fixture canvas.

Packaged Mac binaries and mouse-event code must still be tested on actual Mac
hardware. A successful package build is not evidence that Roblox or a particular
website accepts the injected mouse events. This is a first test build.

## Source development

Use Node 24+, run `npm ci`, then `npm test`. Start the desktop app with `npm start`
(after `npx install-electron` if Electron has not yet downloaded its runtime).
`npm run package:intel` and `npm run package:apple` make the Mac application ZIPs.
Build-time downloads keep npm integrity and Electron SHA-256 verification enabled.
Electron, Chromium and Koffi retain their licenses inside the packaged app.
