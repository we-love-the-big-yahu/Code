First test release of ImagePlotter for Mac.

- Open a PNG, JPG, WEBP or GIF and preview line art or a shaded sketch.
- Select a region inside a drawing website, Roblox drawing game, or Mac canvas.
- Draw using ordinary macOS mouse events and the target app's current brush/color.
- Adjustable detail, sensitivity and speed; five-second countdown.
- Escape, Cmd+Alt+S and primary-screen top-left emergency stops.
- Stops when the foreground application changes.
- Images stay local. No Roblox executor or process access is used.

Download **ImagePlotter-Mac-Intel.zip** for Intel Macs, or
**ImagePlotter-Mac-Apple-Silicon.zip** for Apple silicon.

Extract the ZIP and follow **READ-ME-FIRST.md**. The installer uses macOS's local
code-signing tool; no Xcode, Node, Python or CMake installation is needed to run.
Enable the installed app in **Privacy & Security → Accessibility**.

This is an ad-hoc signed, unnotarized test release. Use macOS's normal Open Anyway
flow only after reviewing the app. No security protections need to be disabled.
Images are rendered as monochrome strokes using your chosen brush color. A target
that rejects simulated input or changes its canvas can prevent correct drawing.
Actual user drawing in Roblox/websites still requires validation; app startup and
unit tests do not establish compatibility with every target.
