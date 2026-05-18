#!/usr/bin/env bash
set -euo pipefail

# Regenerate platform icons from build/icon-source.png.
#
# Inputs:  build/icon-source.png (1024x1024 PNG, RGBA, rounded corners OK)
# Outputs: build/icon.png   (Linux + dev BrowserWindow)
#          build/icon.icns  (macOS .app/.dmg, via sips + iconutil)
#          build/icon.ico   (Windows .exe + NSIS — only on hosts with ImageMagick)
#          src/renderer/public/icon.png (renderer favicon)
#
# Run: npm run icons

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/build/icon-source.png"

if [[ ! -f "$SRC" ]]; then
  echo "missing build/icon-source.png — copy the 1024 PNG there first." >&2
  exit 1
fi

cp "$SRC" "$ROOT/build/icon.png"
cp "$SRC" "$ROOT/src/renderer/public/icon.png"

# macOS .icns
if command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
  WORK="$(mktemp -d)"
  ICONSET="$WORK/icon.iconset"
  mkdir -p "$ICONSET"
  for size in 16 32 64 128 256 512 1024; do
    sips -z "$size" "$size" "$SRC" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  done
  cp "$ICONSET/icon_32x32.png" "$ICONSET/icon_16x16@2x.png"
  cp "$ICONSET/icon_64x64.png" "$ICONSET/icon_32x32@2x.png"
  cp "$ICONSET/icon_256x256.png" "$ICONSET/icon_128x128@2x.png"
  cp "$ICONSET/icon_512x512.png" "$ICONSET/icon_256x256@2x.png"
  cp "$ICONSET/icon_1024x1024.png" "$ICONSET/icon_512x512@2x.png"
  rm "$ICONSET/icon_64x64.png" "$ICONSET/icon_1024x1024.png"
  iconutil --convert icns "$ICONSET" --output "$ROOT/build/icon.icns"
  rm -rf "$WORK"
  echo "wrote build/icon.icns"
else
  echo "sips / iconutil not found — skipping build/icon.icns (macOS-only)" >&2
fi

# Windows .ico — uses ImageMagick if available, otherwise leaves a note.
if command -v magick >/dev/null 2>&1; then
  magick "$SRC" -define icon:auto-resize=256,128,64,48,32,16 "$ROOT/build/icon.ico"
  echo "wrote build/icon.ico"
elif command -v convert >/dev/null 2>&1; then
  convert "$SRC" -define icon:auto-resize=256,128,64,48,32,16 "$ROOT/build/icon.ico"
  echo "wrote build/icon.ico"
else
  echo "ImageMagick (magick/convert) not found — skipping build/icon.ico. Install with 'brew install imagemagick' before running 'npm run dist' for Windows targets." >&2
fi

echo "wrote build/icon.png and src/renderer/public/icon.png"
