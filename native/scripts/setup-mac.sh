#!/bin/bash
# One-time setup on a (rented) Mac. Installs Node.js and XcodeGen locally, with no admin rights
# needed, then prepares the project. Safe to run again.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TOOLS="$ROOT/native/.tools"
mkdir -p "$TOOLS"

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Xcode isn't set up on this Mac. Open Xcode once (it installs its tools), then run this again."
  exit 1
fi
echo "▸ Xcode: $(xcodebuild -version | head -1)"

export NVM_DIR="$HOME/.nvm"
if ! command -v node >/dev/null 2>&1; then
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo "▸ Installing Node.js (via nvm, in your home folder)"
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  fi
  . "$NVM_DIR/nvm.sh"
  nvm install 24
fi
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
echo "▸ Node: $(node -v)"

if ! command -v xcodegen >/dev/null 2>&1 && [ ! -x "$TOOLS/xcodegen/bin/xcodegen" ]; then
  echo "▸ Installing XcodeGen (into native/.tools)"
  # xcodegen.zip ships bin/ plus the share/ templates it needs
  curl -fsSL -o "$TOOLS/xcodegen.zip" https://github.com/yonaskolb/XcodeGen/releases/download/2.46.0/xcodegen.zip
  rm -rf "$TOOLS/xcodegen-unzip" && mkdir -p "$TOOLS/xcodegen-unzip"
  unzip -q "$TOOLS/xcodegen.zip" -d "$TOOLS/xcodegen-unzip"
  BIN="$(find "$TOOLS/xcodegen-unzip" -type f -name xcodegen -perm -u+x | head -1)"
  [ -n "$BIN" ] || { echo "Couldn't find the xcodegen binary in the download."; exit 1; }
  mkdir -p "$TOOLS/xcodegen/bin"
  cp "$BIN" "$TOOLS/xcodegen/bin/xcodegen"
  # keep its resource folder next to it if the release ships one
  SHARE="$(dirname "$BIN")/../share"
  [ -d "$SHARE" ] && cp -R "$SHARE" "$TOOLS/xcodegen/"
  chmod +x "$TOOLS/xcodegen/bin/xcodegen"
fi

"$ROOT/native/scripts/prepare.sh"
