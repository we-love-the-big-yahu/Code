# ImagePlotter for Mac

Turn an image into mouse-drawn line art or a shaded sketch on a canvas you select.
This app uses normal macOS mouse input, independently of Roblox executors.

[ImagePlotter downloads](https://github.com/we-love-the-big-yahu/Code/releases/tag/imageplotter-v0.1.1)
· [Instructions and source](imageplotter/README.md)
· [Build checks](https://github.com/we-love-the-big-yahu/Code/actions/workflows/imageplotter.yml)

Choose **ImagePlotter-Mac-Intel.zip** for Intel, or **ImagePlotter-Mac-Apple-Silicon.zip**
for Apple silicon. Native app bundles are published after the macOS build checks pass.
Enable the app in **Privacy & Security → Accessibility** for mouse drawing. Preview
and choose your brush/color before starting. Escape stops drawing. Compatibility
with a particular game or website still requires testing.

---

# Mac executor source-port downloads

**These are incomplete source ports, not ready-to-run Mac executors.**
Roblox attachment and execution inside Roblox are not implemented. No compiled
Mac app is included, and the macOS build/startup tests have not been run.

## Downloads

- [MacBook Neo / Apple silicon — source ZIP](https://github.com/we-love-the-big-yahu/Code/raw/refs/heads/main/downloads/Executor-MacBook-Neo-SOURCE-PORT.zip)
- [Intel MacBook — source ZIP](https://github.com/we-love-the-big-yahu/Code/raw/refs/heads/main/downloads/Executor-Intel-MacBook-SOURCE-PORT.zip)
- [SHA-256 checksums](downloads/SHA256SUMS.txt)

If a ZIP opens in GitHub's file viewer, choose **Download raw file**. For a private
repository, sign in to the GitHub account with access first.

## What is included

Native AppKit interface source, an embedded Luau compiler, portable supporting
code, regression tests, and a target-specific `Build.command`. The portable code
passed 43 checks on Linux. That does not establish macOS or in-game compatibility.

Extract the ZIP and read `START-HERE.txt` and `README-MACOS.md` before building.
Build prerequisites are macOS 13+, Xcode Command Line Tools, and CMake 3.24+.
A Mac Roblox backend and live-client validation are still required to complete
the requested in-game executor.

## Mac diagnostic

[Download the read-only Mac diagnostic](https://github.com/we-love-the-big-yahu/Code/raw/refs/heads/main/downloads/Executor-Mac-Diagnostic.zip). Extract it and follow its README to report architecture, build tools, and Roblox version metadata. This does not test injection or execution.
