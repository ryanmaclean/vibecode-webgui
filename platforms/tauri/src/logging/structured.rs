// Structured log formatting with JSON serialization
// Agent 27: Staff SRE (Shopify macOS Observability Team)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Structured log entry for JSON export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    /// ISO 8601 timestamp
    pub timestamp: String,

    /// Log level (ERROR, WARN, INFO, DEBUG, TRACE)
    pub level: String,

    /// macOS Console.app subsystem
    pub subsystem: String,

    /// Log category (container, docker, network, security, performance)
    pub category: String,

    /// Human-readable message
    pub message: String,

    /// Structured fields (JSON object)
    pub fields: HashMap<String, serde_json::Value>,

    /// Optional trace context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,

    /// Optional span context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span_id: Option<String>,
}

impl LogEntry {
    /// Create a new log entry with current timestamp
    pub fn new(
        level: String,
        category: String,
        message: String,
    ) -> Self {
        Self {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level,
            subsystem: super::SUBSYSTEM.to_string(),
            category,
            message,
            fields: HashMap::new(),
            trace_id: None,
            span_id: None,
        }
    }

    /// Add a field to the log entry
    pub fn with_field(mut self, key: impl Into<String>, value: impl Into<serde_json::Value>) -> Self {
        self.fields.insert(key.into(), value.into());
        self
    }

    /// Add multiple fields at once
    pub fn with_fields(mut self, fields: HashMap<String, serde_json::Value>) -> Self {
        self.fields.extend(fields);
        self
    }

    /// Set trace context
    pub fn with_trace(mut self, trace_id: String, span_id: Option<String>) -> Self {
        self.trace_id = Some(trace_id);
        self.span_id = span_id;
        self
    }

    /// Serialize to JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Serialize to pretty JSON string (for debugging)
    pub fn to_json_pretty(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }
}

/// Container event log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerEvent {
    pub container_id: String,
    pub container_name: String,
    pub profile: String,
    pub event_type: ContainerEventType,
    pub timestamp: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContainerEventType {
    Created,
    Started,
    Stopped,
    Restarted,
    Removed,
    Crashed,
    OOMKilled,
}

impl ContainerEvent {
    pub fn to_log_entry(&self) -> LogEntry {
        let mut entry = LogEntry::new(
            match self.event_type {
                ContainerEventType::Crashed | ContainerEventType::OOMKilled => "ERROR".to_string(),
                ContainerEventType::Stopped => "WARN".to_string(),
                _ => "INFO".to_string(),
            },
            "container".to_string(),
            format!("Container {} event: {:?}", self.container_name, self.event_type),
        );

        entry.fields.insert("container_id".to_string(), self.container_id.clone().into());
        entry.fields.insert("container_name".to_string(), self.container_name.clone().into());
        entry.fields.insert("profile".to_string(), self.profile.clone().into());
        entry.fields.insert("event_type".to_string(), format!("{:?}", self.event_type).into());

        if let Some(exit_code) = self.exit_code {
            entry.fields.insert("exit_code".to_string(), exit_code.into());
        }

        if let Some(ref error_message) = self.error_message {
            entry.fields.insert("error_message".to_string(), error_message.clone().into());
        }

        entry
    }
}

/// Docker API operation log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerOperation {
    pub operation: String,
    pub method: String,
    pub endpoint: String,
    pub duration_ms: u64,
    pub status_code: u16,
    pub timestamp: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl DockerOperation {
    pub fn to_log_entry(&self) -> LogEntry {
        let mut entry = LogEntry::new(
            if self.status_code >= 400 {
                "ERROR".to_string()
            } else if self.duration_ms > 5000 {
                "WARN".to_string()
            } else {
                "INFO".to_string()
            },
            "docker".to_string(),
            format!("{} {} - {}ms", self.method, self.endpoint, self.duration_ms),
        );

        entry.fields.insert("operation".to_string(), self.operation.clone().into());
        entry.fields.insert("method".to_string(), self.method.clone().into());
        entry.fields.insert("endpoint".to_string(), self.endpoint.clone().into());
        entry.fields.insert("duration_ms".to_string(), self.duration_ms.into());
        entry.fields.insert("status_code".to_string(), self.status_code.into());

        if let Some(ref error) = self.error {
            entry.fields.insert("error".to_string(), error.clone().into());
        }

        entry
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_entry_serialization() {
        let entry = LogEntry::new(
            "INFO".to_string(),
            "container".to_string(),
            "Container started".to_string(),
        )
        .with_field("container_id", "abc123")
        .with_field("profile", "standard");

        let json = entry.to_json().unwrap();
        assert!(json.contains("INFO"));
        assert!(json.contains("container"));
        assert!(json.contains("abc123"));
    }

    #[test]
    fn test_container_event_conversion() {
        let event = ContainerEvent {
            container_id: "abc123".to_string(),
            container_name: "vibecode-standard".to_string(),
            profile: "standard".to_string(),
            event_type: ContainerEventType::Started,
            timestamp: chrono::Utc::now().to_rfc3339(),
            exit_code: None,
            error_message: None,
        };

        let entry = event.to_log_entry();
        assert_eq!(entry.level, "INFO");
        assert_eq!(entry.category, "container");
        assert!(entry.fields.contains_key("container_id"));
    }

    #[test]
    fn test_docker_operation_error_level() {
        let op = DockerOperation {
            operation: "create_container".to_string(),
            method: "POST".to_string(),
            endpoint: "/containers/create".to_string(),
            duration_ms: 150,
            status_code: 500,
            timestamp: chrono::Utc::now().to_rfc3339(),
            error: Some("Internal server error".to_string()),
        };

        let entry = op.to_log_entry();
        assert_eq!(entry.level, "ERROR");
    }
}
