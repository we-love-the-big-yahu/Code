#!/bin/bash
# Read-only compatibility checks. Does not launch, patch, or attach to Roblox.
set -u
if [[ "$(uname -s)" != Darwin ]]; then
  printf '%s\n' 'This diagnostic must be run on the Mac you want to test.' >&2
  exit 1
fi
printf '%s\n' 'Executor Mac diagnostic v1' '--------------------------'
printf 'macOS: '
/usr/bin/sw_vers -productVersion
printf 'OS build: '
/usr/bin/sw_vers -buildVersion
printf 'Shell architecture: %s\n' "$(uname -m)"
arm_hardware="$(/usr/sbin/sysctl -in hw.optional.arm64 2>/dev/null || true)"
if [[ "$arm_hardware" == 1 ]]; then
  printf '%s\n' 'Hardware target: Apple silicon (arm64)'
else
  printf '%s\n' 'Hardware target: Intel (x86_64)'
fi
if /usr/bin/xcode-select -p >/dev/null 2>&1; then
  printf '%s\n' 'Apple developer tools: selected'
  if /usr/bin/xcrun --find clang++ >/dev/null 2>&1; then
    printf 'C++ compiler: '
    /usr/bin/xcrun clang++ --version 2>/dev/null | /usr/bin/head -n 1
  else
    printf '%s\n' 'C++ compiler: unavailable'
  fi
else
  printf '%s\n' 'Apple developer tools: not selected/installed'
fi
if command -v cmake >/dev/null 2>&1; then
  cmake --version 2>/dev/null | /usr/bin/head -n 1
elif [[ -x /Applications/CMake.app/Contents/bin/cmake ]]; then
  /Applications/CMake.app/Contents/bin/cmake --version 2>/dev/null | /usr/bin/head -n 1
else
  printf '%s\n' 'CMake: not found'
fi
app=''
for candidate in /Applications/Roblox.app "${HOME}/Applications/Roblox.app"; do
  if [[ -f "$candidate/Contents/Info.plist" ]]; then app="$candidate";break;fi
done
if [[ -z "$app" ]]; then
  printf '%s\n' 'Roblox: not found in /Applications or your Applications folder'
else
  printf '%s\n' 'Roblox: installation found'
  plist="$app/Contents/Info.plist"
  for field in CFBundleIdentifier CFBundleShortVersionString CFBundleVersion; do
    value="$(/usr/libexec/PlistBuddy -c "Print :$field" "$plist" 2>/dev/null || true)"
    printf '%s: %s\n' "$field" "${value:-not present}"
  done
  executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$plist" 2>/dev/null || true)"
  if [[ "$executable" =~ ^[A-Za-z0-9_.-]+$ && -f "$app/Contents/MacOS/$executable" ]]; then
    printf 'Roblox binary: '
    /usr/bin/file -b "$app/Contents/MacOS/$executable"
    printf 'Roblox architectures: '
    /usr/bin/lipo -archs "$app/Contents/MacOS/$executable" 2>/dev/null || printf '%s\n' 'unavailable'
    if /usr/bin/codesign --verify --deep --strict "$app" >/dev/null 2>&1; then
      printf '%s\n' 'Roblox code-signature check: passed'
    else
      printf '%s\n' 'Roblox code-signature check: did not pass'
    fi
    if /usr/bin/pgrep -x "$executable" >/dev/null 2>&1; then
      printf '%s\n' 'Roblox process: running'
    else
      printf '%s\n' 'Roblox process: not running'
    fi
  else
    printf '%s\n' 'Roblox executable metadata: unavailable or unexpected'
  fi
fi
printf '%s\n' '--------------------------' 'No process access, injection, runtime compatibility, or execution was tested.' 'Copy this report into the chat. It contains no account tokens or hardware serial numbers.'
