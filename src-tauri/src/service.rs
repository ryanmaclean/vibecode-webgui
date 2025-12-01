// src-tauri/src/service.rs
// HTTP service to expose Tauri commands to Electron

use axum::{
    extract::Json,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::net::SocketAddr;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    service: String,
}

#[derive(Deserialize)]
struct EmbeddingRequest {
    text: String,
}

#[derive(Serialize)]
struct EmbeddingResponse {
    embedding: Vec<f32>,
}

// Health check endpoint
async fn health_check() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        service: "vibecode-backend".to_string(),
    })
}

// ML endpoints
async fn ml_is_available() -> impl IntoResponse {
    let available = crate::ml::commands::ml_is_available();
    Json(serde_json::json!({
        "available": available
    }))
}

async fn ml_get_device_info() -> impl IntoResponse {
    match crate::ml::commands::ml_get_device_info() {
        Ok(info) => (StatusCode::OK, Json(info)),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e })),
        ),
    }
}

async fn ml_generate_embedding(
    Json(req): Json<EmbeddingRequest>,
) -> impl IntoResponse {
    // For now, return mock - will integrate with Swift FFI
    // TODO: Call Swift CoreML via FFI
    Json(EmbeddingResponse {
        embedding: vec![0.0; 384], // Mock embedding
    })
}

// AI endpoints - use existing AI commands
async fn ai_chat(Json(req): Json<crate::ai::commands::AIChatRequest>) -> impl IntoResponse {
    match crate::ai::commands::ai_chat(req).await {
        Ok(response) => (StatusCode::OK, Json(response)),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e })),
        ),
    }
}

// Docker endpoints
async fn docker_status() -> impl IntoResponse {
    match crate::commands::get_docker_status().await {
        Ok(status) => (StatusCode::OK, Json(status)),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e })),
        ),
    }
}

// Tailscale endpoints
async fn tailscale_status() -> impl IntoResponse {
    match crate::tailscale::TailscaleManager::status() {
        Ok(status) => (StatusCode::OK, Json(status)),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e })),
        ),
    }
}

// Create HTTP router
pub fn create_router() -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/api/ml/available", get(ml_is_available))
        .route("/api/ml/device-info", get(ml_get_device_info))
        .route("/api/ml/embedding", post(ml_generate_embedding))
        .route("/api/ai/chat", post(ai_chat))
        .route("/api/docker/status", get(docker_status))
        .route("/api/tailscale/status", get(tailscale_status))
}

// Start HTTP server (can run standalone or alongside Tauri)
pub async fn start_service(port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    
    let app = create_router();
    
    println!("🚀 VibeCode backend service listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

