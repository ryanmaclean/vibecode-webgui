#!/usr/bin/env bash
# Create a reproducible EFI variable store for Apple VZ/VFKit workflows.

set -euo pipefail

efi_store_path="${1:-}"

if [[ -z "$efi_store_path" ]]; then
    echo "Usage: $0 <efi_store_path>"
    exit 1
fi

if [[ -f "$efi_store_path" ]]; then
    echo "EFI variable store already exists: $efi_store_path"
    exit 0
fi

mkdir -p "$(dirname "$efi_store_path")"

if [[ -f "/System/Library/Frameworks/Virtualization.framework/Resources/UEFI/OVMF_VARS.fd" ]]; then
    cp "/System/Library/Frameworks/Virtualization.framework/Resources/UEFI/OVMF_VARS.fd" "$efi_store_path"
    echo "Copied Virtualization.framework EFI template."
    exit 0
fi

if [[ -f "/usr/share/qemu/edk2-aarch64-vars.fd" ]]; then
    cp "/usr/share/qemu/edk2-aarch64-vars.fd" "$efi_store_path"
    echo "Copied edk2 EFI template."
    exit 0
fi

if command -v swift >/dev/null 2>&1; then
    temp_swift="$(mktemp -t create-efi-store.XXXXXX.swift)"
    cat > "$temp_swift" <<'SWIFT'
import Foundation
import Virtualization

let efiPath = CommandLine.arguments[1]
let efiURL = URL(fileURLWithPath: efiPath)

do {
    let _ = try VZEFIVariableStore(creatingVariableStoreAt: efiURL)
    print("Created EFI variable store via Virtualization.framework.")
} catch {
    fputs("Failed to create EFI variable store: \(error)\n", stderr)
    exit(1)
}
SWIFT

    if swift "$temp_swift" "$efi_store_path"; then
        rm -f "$temp_swift"
        exit 0
    fi

    rm -f "$temp_swift"
    echo "Warning: Swift EFI creation failed, falling back to zeroed template." >&2
fi

dd if=/dev/zero of="$efi_store_path" bs=1m count=64 2>/dev/null
echo "Created zeroed EFI variable store (64MB)."
