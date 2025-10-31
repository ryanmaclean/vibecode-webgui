use std::env;
use std::path::PathBuf;

fn main() {
    tauri_build::build();

    // TODO: Re-enable Swift ML library linking once CoreML integration is complete
    // Link to Swift library on macOS
    // #[cfg(target_os = "macos")]
    // {
    //     let swift_lib_path = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap())
    //         .join("swift")
    //         .join(".build")
    //         .join("release");
    //
    //     println!("cargo:rustc-link-search=native={}", swift_lib_path.display());
    //     println!("cargo:rustc-link-lib=static=VibeMLAccelerator");
    // }
}
