#!/usr/bin/env bash
# MixMind — Generate Rust bindings from C header
# Requires: bindgen (cargo install bindgen-cli)
#
# Usage: ./build_bindings.sh
# Output: ../src-tauri/src/bridge/protocol.rs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEADER="$SCRIPT_DIR/mixmind_protocol.h"
OUTPUT="$SCRIPT_DIR/../src-tauri/src/bridge/protocol.rs"

echo "🔧 MixMind bindgen"
echo "   Input:  $HEADER"
echo "   Output: $OUTPUT"

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT")"

# Run bindgen
bindgen "$HEADER" \
    --output "$OUTPUT" \
    --use-core \
    --with-derive-default \
    --with-derive-debug \
    --with-derive-copy \
    --with-derive-eq \
    --with-derive-hash \
    --no-layout-tests \
    --allowlist-type "ChannelSlot" \
    --allowlist-type "SharedMemoryLayout" \
    --allowlist-type "ChannelType" \
    --allowlist-var "MIXMIND_.*" \
    -- \
    -I"$SCRIPT_DIR"

echo "✓ Bindings written to $OUTPUT"

# Prepend a module-level doc comment
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'HEADER_COMMENT'
//! Auto-generated Rust bindings for MixMind shared memory protocol.
//! DO NOT EDIT — regenerate with: cd shared && ./build_bindings.sh
//!
//! Source: shared/mixmind_protocol.h

#![allow(non_upper_case_globals)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]
#![allow(dead_code)]

HEADER_COMMENT

cat "$OUTPUT" >> "$TMPFILE"
mv "$TMPFILE" "$OUTPUT"

echo "✓ Done"
