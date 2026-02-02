use tauri::{command, AppHandle, WebviewUrl, WebviewWindowBuilder};

#[command]
pub async fn open_browser_window(app: AppHandle, url: String) -> Result<(), String> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let parsed_url = url.parse().map_err(|e| format!("Invalid URL: {}", e))?;

    WebviewWindowBuilder::new(
        &app,
        format!("browser_{}", timestamp),
        WebviewUrl::External(parsed_url),
    )
    .title("VibeCode Browser")
    .resizable(true)
    .inner_size(1200.0, 800.0)
    .build()
    .map_err(|e| format!("Failed to create browser window: {}", e))?;

    Ok(())
}

#[command]
pub fn navigate_to(url: String) -> Result<String, String> {
    url.parse::<url::Url>()
        .map(|_| url)
        .map_err(|e| format!("Invalid URL: {}", e))
}
