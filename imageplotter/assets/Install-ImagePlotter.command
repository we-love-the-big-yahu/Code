#!/bin/bash
set -euo pipefail
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'ImagePlotter needs a Mac.' >&2; exit 1
fi
installer_root="$(cd "$(dirname "$0")" && pwd)"
source_app="$installer_root/ImagePlotter.app"
apps_dir="$HOME/Applications"
target_app="$apps_dir/ImagePlotter.app"
if [[ ! -d "$source_app" || ! -f "$installer_root/entitlements.plist" ]]; then
  echo 'Keep this installer, entitlements.plist, and ImagePlotter.app together in the extracted folder.' >&2; exit 1
fi
mkdir -p "$apps_dir"
if [[ -e "$target_app" ]]; then
  backup_app="$apps_dir/ImagePlotter-backup-$(date +%Y%m%d-%H%M%S)-$$.app"
  mv "$target_app" "$backup_app"
  echo "Previous version preserved: $backup_app"
fi
/usr/bin/ditto "$source_app" "$target_app"
# Sign the bundled mouse-control library, then this application's nested code.
while IFS= read -r -d '' native_module; do
  /usr/bin/codesign --force --sign - "$native_module"
done < <(/usr/bin/find "$target_app/Contents/Resources/app/node_modules" -type f -name '*.node' -print0)
# Ad-hoc sign this application only. No system security settings are changed.
/usr/bin/codesign --force --deep --sign - --entitlements "$installer_root/entitlements.plist" "$target_app"
/usr/bin/codesign --verify --deep --strict "$target_app"
echo "Installed: $target_app"
echo 'Open Privacy & Security → Accessibility and enable ImagePlotter when using mouse drawing.'
/usr/bin/open "$target_app"
