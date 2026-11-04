#!/bin/sh
# Download the site's fonts once, into docs/fonts/, so that the site never asks a
# third party for anything (no Google Fonts: visitors' addresses stay with them).
# Fonts from Fontsource (npm), both under the SIL Open Font License 1.1:
#   Geist and Geist Mono (Vercel), Silkscreen (Jason Kottke).
# Usage, from the project folder:  sh tools/fetch_fonts.sh
set -e
OUT="$(cd "$(dirname "$0")/.." && pwd)/docs/fonts"
TMP="$(mktemp -d)"
mkdir -p "$OUT"
cd "$TMP"
npm pack @fontsource-variable/geist @fontsource-variable/geist-mono @fontsource/silkscreen >/dev/null
for f in *.tgz; do d="${f%.tgz}"; mkdir "$d"; tar xzf "$f" -C "$d"; done
cp fontsource-variable-geist-[0-9]*/package/files/geist-latin-wght-normal.woff2 "$OUT/"
cp fontsource-variable-geist-[0-9]*/package/files/geist-latin-ext-wght-normal.woff2 "$OUT/"
cp fontsource-variable-geist-mono-*/package/files/geist-mono-latin-wght-normal.woff2 "$OUT/"
cp fontsource-variable-geist-mono-*/package/files/geist-mono-latin-ext-wght-normal.woff2 "$OUT/"
cp fontsource-silkscreen-*/package/files/silkscreen-latin-400-normal.woff2 "$OUT/"
cp fontsource-silkscreen-*/package/files/silkscreen-latin-700-normal.woff2 "$OUT/"
cp fontsource-variable-geist-[0-9]*/package/LICENSE "$OUT/LICENSE-Geist.txt"
cp fontsource-silkscreen-*/package/LICENSE "$OUT/LICENSE-Silkscreen.txt"
ls -la "$OUT"
