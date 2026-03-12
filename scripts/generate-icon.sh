#!/bin/bash
# Generates a macOS .icns icon for ShellDock from a simple template.
# Requires macOS built-in tools: sips, iconutil.
# If you have a custom icon.png (1024x1024), place it at assets/icon.png
# and this script will convert it to .icns and .ico formats.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$PROJECT_DIR/assets"
ICONSET_DIR="$ASSETS_DIR/ShellDock.iconset"

mkdir -p "$ASSETS_DIR"

# If no source icon exists, generate one using macOS graphics tools
if [ ! -f "$ASSETS_DIR/icon.png" ]; then
  echo "No icon.png found in assets/. Generating a placeholder icon..."

  # Create a 1024x1024 icon using Python (available on macOS)
  ASSETS_DIR="$ASSETS_DIR" python3 - <<'PYEOF'
import struct, zlib, os

WIDTH = HEIGHT = 1024

def create_row(width):
    """Create a single row of pixels for a gradient terminal icon."""
    row = []
    for x in range(width):
        # Dark background with a subtle gradient
        bg_r, bg_g, bg_b = 30, 30, 46  # #1e1e2e (catppuccin mocha base)

        # Terminal prompt area (centered box)
        margin = width // 6
        top_bar = width // 8
        if margin <= x < width - margin:
            bg_r, bg_g, bg_b = 24, 24, 37

        row.extend([bg_r, bg_g, bg_b, 255])
    return row

def make_png(filename, size):
    """Create a simple PNG icon."""
    width = height = size
    margin = size // 6
    top_bar_h = size // 10
    corner_r = size // 20

    raw_data = []
    for y in range(height):
        raw_data.append(0)  # filter byte
        for x in range(width):
            # Rounded rectangle background
            in_box = (margin <= x < width - margin and margin <= y < height - margin)

            if in_box:
                # Top bar (title bar)
                if margin <= y < margin + top_bar_h:
                    r, g, b = 49, 50, 68  # #313244
                    # Traffic light dots
                    dot_y = margin + top_bar_h // 2
                    dot_r = size // 60
                    dots = [
                        (margin + size // 16, dot_y, 243, 139, 168),      # red
                        (margin + size // 16 + size // 20, dot_y, 249, 226, 175),  # yellow
                        (margin + size // 16 + 2 * size // 20, dot_y, 166, 227, 161),  # green
                    ]
                    drawn = False
                    for dx, dy, dr, dg, db in dots:
                        if (x - dx) ** 2 + (y - dy) ** 2 <= dot_r ** 2:
                            r, g, b = dr, dg, db
                            drawn = True
                            break
                    if not drawn:
                        r, g, b = 49, 50, 68
                # Terminal body
                else:
                    r, g, b = 30, 30, 46  # #1e1e2e

                    # Draw ">" prompt
                    prompt_x = margin + size // 10
                    prompt_y = margin + top_bar_h + size // 6
                    prompt_size = size // 18

                    # Cursor block
                    cursor_x = prompt_x + prompt_size * 3
                    cursor_y = prompt_y - prompt_size
                    cursor_w = prompt_size
                    cursor_h = prompt_size * 2

                    if (cursor_x <= x < cursor_x + cursor_w and
                        cursor_y <= y < cursor_y + cursor_h):
                        r, g, b = 137, 180, 250  # #89b4fa blue cursor

                    # ">" character (two diagonal lines)
                    rel_x = x - prompt_x
                    rel_y = y - prompt_y
                    if abs(rel_y) < prompt_size:
                        if abs(rel_x - abs(rel_y)) < size // 80 + 1:
                            r, g, b = 166, 227, 161  # #a6e3a1 green prompt
            else:
                # Outside the terminal - app background
                r, g, b = 17, 17, 27  # #11111b

                # Rounded corners
                corners = [
                    (margin + corner_r, margin + corner_r),
                    (width - margin - corner_r, margin + corner_r),
                    (margin + corner_r, height - margin - corner_r),
                    (width - margin - corner_r, height - margin - corner_r),
                ]
                for cx, cy in corners:
                    dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                    if dist <= corner_r:
                        in_corner_zone = True
                        # Check if we're in the corner cutout area
                        if ((x < margin + corner_r or x >= width - margin - corner_r) and
                            (y < margin + corner_r or y >= height - margin - corner_r)):
                            r, g, b = 30, 30, 46

            raw_data.extend([r, g, b, 255])

    def write_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)

    with open(filename, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(write_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)))
        compressed = zlib.compress(bytes(raw_data), 9)
        f.write(write_chunk(b'IDAT', compressed))
        f.write(write_chunk(b'IEND', b''))

    print(f"  Created {filename} ({size}x{size})")

assets = os.environ['ASSETS_DIR']
make_png(os.path.join(assets, 'icon.png'), 1024)
PYEOF

  echo "Placeholder icon.png generated."
fi

# Generate .iconset with required sizes
echo "Creating .iconset..."
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

SIZES=(16 32 64 128 256 512)
for size in "${SIZES[@]}"; do
  sips -z "$size" "$size" "$ASSETS_DIR/icon.png" --out "$ICONSET_DIR/icon_${size}x${size}.png" > /dev/null 2>&1
  double=$((size * 2))
  sips -z "$double" "$double" "$ASSETS_DIR/icon.png" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" > /dev/null 2>&1
done

# Generate .icns
echo "Creating .icns..."
iconutil -c icns "$ICONSET_DIR" -o "$ASSETS_DIR/icon.icns"

# Clean up iconset
rm -rf "$ICONSET_DIR"

echo "Icon files generated in $ASSETS_DIR/"
ls -la "$ASSETS_DIR/"
