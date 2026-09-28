#!/bin/bash
# Build the web game, copy it into the iOS app, and generate Nicdoku.xcodeproj.
# Run from anywhere:  ./native/scripts/prepare.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NATIVE="$ROOT/native"
cd "$ROOT"

# local, no-admin tools installed by setup-mac.sh (if used)
export PATH="$NATIVE/.tools/xcodegen/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

command -v node >/dev/null || { echo "Node.js not found. Run ./native/scripts/setup-mac.sh first."; exit 1; }
command -v xcodegen >/dev/null || { echo "XcodeGen not found. Run ./native/scripts/setup-mac.sh first."; exit 1; }

echo "▸ Building the web game"
npm ci --no-audit --no-fund
npm run build

echo "▸ Copying it into the iOS app"
rm -rf "$NATIVE/App/public"
mkdir -p "$NATIVE/App/public"
cp -R "$ROOT/dist/." "$NATIVE/App/public/"
# the native app updates through TestFlight, so no service worker inside it
rm -f "$NATIVE/App/public/sw.js" "$NATIVE/App/public"/workbox-*.js "$NATIVE/App/public/registerSW.js"

cat > "$NATIVE/App/capacitor.config.json" <<'JSON'
{
  "appId": "nicdoku",
  "appName": "Nicdoku",
  "webDir": "public",
  "backgroundColor": "#f7f1ec",
  "ios": {
    "contentInset": "never",
    "backgroundColor": "#f7f1ec",
    "allowsLinkPreview": false
  }
}
JSON

echo "▸ Generating the Xcode project"
cd "$NATIVE"
xcodegen generate --spec project.yml

echo "✓ Done. Open native/Nicdoku.xcodeproj in Xcode."
