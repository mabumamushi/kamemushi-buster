#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
dist_root="$project_root/dist"

rm -rf "$dist_root"
mkdir -p "$dist_root/server" "$dist_root/.openai"
cp "$project_root/worker/index.js" "$dist_root/server/index.js"
cp "$project_root/.openai/hosting.json" "$dist_root/.openai/hosting.json"
printf '{"type":"module"}\n' > "$dist_root/server/package.json"
encode() { base64 < "$1" | tr -d '\n'; }
{
  printf 'const decode = value => new TextDecoder().decode(Uint8Array.from(atob(value), c => c.charCodeAt(0)));\n'
  printf 'export const page = decode("%s");\n' "$(encode "$project_root/worker/page.html")"
  printf 'export const style = decode("%s");\n' "$(encode "$project_root/worker/style.css")"
  printf 'export const app = decode("%s");\n' "$(encode "$project_root/worker/app.js")"
  printf 'const fontBase64 = "%s";\n' "$(encode "$project_root/worker/fonts/Makinas-4-Flat.otf")"
  printf 'let fontBytes; export const font = () => fontBytes ??= Uint8Array.from(atob(fontBase64), c => c.charCodeAt(0));\n'
  printf 'const musicBase64 = "%s";\n' "$(encode "$project_root/worker/music/battle100.mp3")"
  printf 'const hitBase64 = "%s";\n' "$(encode "$project_root/worker/music/hit.mp3")"
  printf 'let musicBytes; export const music = () => musicBytes ??= Uint8Array.from(atob(musicBase64), c => c.charCodeAt(0));\n'
  printf 'let hitBytes; export const hit = () => hitBytes ??= Uint8Array.from(atob(hitBase64), c => c.charCodeAt(0));\n'
} > "$dist_root/server/assets.js"

echo "Built $dist_root"
