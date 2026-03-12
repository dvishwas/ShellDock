#!/bin/bash
# Builds ShellDock macOS installer (.dmg and .zip)
# Usage: ./scripts/build-macos-installer.sh [--skip-icon] [--skip-build]
#
# Output: release/ directory containing:
#   - ShellDock-<version>.dmg    (drag-to-install disk image)
#   - ShellDock-<version>-mac.zip (zipped .app bundle)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

SKIP_ICON=false
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-icon) SKIP_ICON=true ;;
    --skip-build) SKIP_BUILD=true ;;
  esac
done

echo "============================================"
echo "  ShellDock macOS Installer Builder"
echo "============================================"
echo ""

# Step 1: Check prerequisites
echo "[1/5] Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required. Install from https://nodejs.org"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "Error: npm is required."
  exit 1
fi

NODE_VERSION=$(node -v)
echo "  Node.js: $NODE_VERSION"
echo "  npm: $(npm -v)"
echo "  Platform: $(uname -m)"

# Step 2: Install dependencies
echo ""
echo "[2/5] Installing dependencies..."
if [ ! -d "node_modules" ]; then
  npm install
else
  echo "  node_modules exists, skipping. Run 'npm install' manually if needed."
fi

# Step 3: Generate icon
echo ""
echo "[3/5] Generating app icon..."
if [ "$SKIP_ICON" = true ]; then
  echo "  Skipped (--skip-icon)"
elif [ -f "assets/icon.icns" ]; then
  echo "  icon.icns already exists, skipping. Delete it to regenerate."
else
  bash "$SCRIPT_DIR/generate-icon.sh"
fi

# Step 4: Build the app
echo ""
echo "[4/5] Building application..."
if [ "$SKIP_BUILD" = true ]; then
  echo "  Skipped (--skip-build)"
else
  npm run build
fi

# Step 5: Package with electron-builder
echo ""
echo "[5/5] Packaging macOS installer..."
npx electron-builder --mac --config electron-builder.yml

echo ""
echo "============================================"
echo "  Build complete!"
echo "============================================"
echo ""
echo "Output files:"
ls -lh release/*.dmg release/*.zip 2>/dev/null || echo "  (check release/ directory)"
echo ""
echo "To install: Open the .dmg and drag ShellDock to Applications."
