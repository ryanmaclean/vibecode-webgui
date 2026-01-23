// platforms/tauri/src/ml/coreml.rs
// CoreML integration stub for macOS Metal/Neural Engine acceleration
//
// This module provides stub implementations for the CoreML FFI functions
// when building without the native Swift VibeMLAccelerator library.
//
// When the Swift library is linked (via the `coreml-swift` feature),
// these stubs are not compiled and the real Swift implementations are used.
//
// The actual Swift implementations are in:
// platforms/tauri/swift/Sources/VibeMLAccelerator/VibeMLAccelerator.swift

// Only compile these stubs when the coreml-swift feature is NOT enabled
// This allows building without the Swift library while still having a working binary

#[cfg(not(feature = "coreml-swift"))]
mod stubs {
    use std::ffi::c_void;
    use std::os::raw::c_char;

    /// Stub: Check if ML hardware acceleration is available
    ///
    /// When building without Swift library, always returns false
    #[no_mangle]
    pub extern "C" fn vibe_ml_is_available() -> bool {
        // Without the Swift library, ML acceleration is not available
        eprintln!("ML acceleration: using stub implementation (Swift library not linked)");
        false
    }

    /// Stub: Get JSON-formatted device information
    ///
    /// Returns a static JSON string indicating no ML device is available
    #[no_mangle]
    pub extern "C" fn vibe_ml_get_device_info() -> *const c_char {
        use std::ffi::CString;

        let json = serde_json::json!({
            "device_name": "No ML Device (stub)",
            "compute_units": 0,
            "memory_bytes": 0,
            "supports_neural_engine": false,
            "backend": "stub",
            "note": "Build with coreml-swift feature for real ML acceleration"
        });

        let json_string = json.to_string();

        match CString::new(json_string) {
            Ok(c_str) => c_str.into_raw(),
            Err(_) => std::ptr::null(),
        }
    }

    /// Stub: Initialize the ML accelerator
    ///
    /// Returns null to indicate ML is not available
    #[no_mangle]
    pub extern "C" fn vibe_ml_init() -> *mut c_void {
        eprintln!("ML init: stub implementation, ML acceleration not available");
        std::ptr::null_mut()
    }

    /// Stub: Clean up ML resources
    ///
    /// No-op in stub implementation
    #[no_mangle]
    pub extern "C" fn vibe_ml_cleanup(_handle: *mut c_void) {
        // No-op for stub
    }
}

// Re-export stubs when coreml-swift is not available
#[cfg(not(feature = "coreml-swift"))]
pub use stubs::*;

// When coreml-swift IS enabled, the symbols come from the linked Swift library
// and this module is essentially empty
#[cfg(feature = "coreml-swift")]
mod swift_linked {
    // The Swift library provides these symbols:
    // - vibe_ml_is_available
    // - vibe_ml_get_device_info
    // - vibe_ml_init
    //
    // They are declared in commands.rs as extern "C" and linked at build time
}
