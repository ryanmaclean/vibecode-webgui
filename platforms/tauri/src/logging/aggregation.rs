// Log aggregation and collection for export
// Agent 27: Staff SRE (Shopify macOS Observability Team)

use super::structured::LogEntry;
use std::collections::VecDeque;
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime};

/// In-memory log aggregator with circular buffer
///
/// Stores the last N log entries for quick access in dashboard.
/// Older entries are automatically evicted.
pub struct LogAggregator {
    /// Circular buffer of log entries
    buffer: Arc<RwLock<VecDeque<LogEntry>>>,

    /// Maximum number of entries to keep in memory
    max_entries: usize,

    /// Total entries received (for statistics)
    total_count: Arc<RwLock<u64>>,
}

impl LogAggregator {
    /// Create a new log aggregator with specified capacity
    ///
    /// Default: 10,000 entries (~10MB for typical log entries)
    pub fn new(max_entries: usize) -> Self {
        Self {
            buffer: Arc::new(RwLock::new(VecDeque::with_capacity(max_entries))),
            max_entries,
            total_count: Arc::new(RwLock::new(0)),
        }
    }

    /// Add a log entry to the buffer
    pub fn add(&self, entry: LogEntry) {
        let mut buffer = self.buffer.write().unwrap();
        let mut count = self.total_count.write().unwrap();

        // Evict oldest entry if at capacity
        if buffer.len() >= self.max_entries {
            buffer.pop_front();
        }

        buffer.push_back(entry);
        *count += 1;
    }

    /// Get all log entries (most recent last)
    pub fn get_all(&self) -> Vec<LogEntry> {
        self.buffer.read().unwrap().iter().cloned().collect()
    }

    /// Get log entries filtered by category
    pub fn get_by_category(&self, category: &str) -> Vec<LogEntry> {
        self.buffer
            .read()
            .unwrap()
            .iter()
            .filter(|entry| entry.category == category)
            .cloned()
            .collect()
    }

    /// Get log entries filtered by level
    pub fn get_by_level(&self, level: &str) -> Vec<LogEntry> {
        self.buffer
            .read()
            .unwrap()
            .iter()
            .filter(|entry| entry.level == level)
            .cloned()
            .collect()
    }

    /// Get recent log entries (last N)
    pub fn get_recent(&self, count: usize) -> Vec<LogEntry> {
        let buffer = self.buffer.read().unwrap();
        let start = buffer.len().saturating_sub(count);
        buffer.iter().skip(start).cloned().collect()
    }

    /// Get log entries within time range
    pub fn get_by_time_range(&self, start: SystemTime, end: SystemTime) -> Vec<LogEntry> {
        self.buffer
            .read()
            .unwrap()
            .iter()
            .filter(|entry| {
                // Parse ISO 8601 timestamp
                if let Ok(timestamp) = chrono::DateTime::parse_from_rfc3339(&entry.timestamp) {
                    let entry_time = timestamp.timestamp() as u64;
                    let start_secs = start.duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs();
                    let end_secs = end.duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs();
                    entry_time >= start_secs && entry_time <= end_secs
                } else {
                    false
                }
            })
            .cloned()
            .collect()
    }

    /// Search log messages by text
    pub fn search(&self, query: &str) -> Vec<LogEntry> {
        let query_lower = query.to_lowercase();
        self.buffer
            .read()
            .unwrap()
            .iter()
            .filter(|entry| {
                entry.message.to_lowercase().contains(&query_lower)
                    || entry.fields.values().any(|v| {
                        if let serde_json::Value::String(s) = v {
                            s.to_lowercase().contains(&query_lower)
                        } else {
                            false
                        }
                    })
            })
            .cloned()
            .collect()
    }

    /// Get statistics about the log buffer
    pub fn get_stats(&self) -> LogStats {
        let buffer = self.buffer.read().unwrap();
        let total_count = *self.total_count.read().unwrap();

        let mut stats = LogStats {
            total_entries: total_count,
            buffered_entries: buffer.len(),
            evicted_entries: total_count.saturating_sub(buffer.len() as u64),
            by_level: std::collections::HashMap::new(),
            by_category: std::collections::HashMap::new(),
        };

        // Count by level and category
        for entry in buffer.iter() {
            *stats.by_level.entry(entry.level.clone()).or_insert(0) += 1;
            *stats.by_category.entry(entry.category.clone()).or_insert(0) += 1;
        }

        stats
    }

    /// Clear all log entries from buffer
    pub fn clear(&self) {
        self.buffer.write().unwrap().clear();
    }

    /// Export logs to JSON array
    pub fn export_json(&self) -> Result<String, serde_json::Error> {
        let entries = self.get_all();
        serde_json::to_string(&entries)
    }

    /// Export logs to NDJSON (newline-delimited JSON)
    pub fn export_ndjson(&self) -> Result<String, serde_json::Error> {
        let entries = self.get_all();
        let mut result = String::new();
        for entry in entries {
            result.push_str(&serde_json::to_string(&entry)?);
            result.push('\n');
        }
        Ok(result)
    }
}

impl Default for LogAggregator {
    fn default() -> Self {
        Self::new(10_000)
    }
}

/// Log buffer statistics
#[derive(Debug, Clone, serde::Serialize)]
pub struct LogStats {
    /// Total entries ever received
    pub total_entries: u64,

    /// Current entries in buffer
    pub buffered_entries: usize,

    /// Entries evicted due to buffer limit
    pub evicted_entries: u64,

    /// Count by log level
    pub by_level: std::collections::HashMap<String, usize>,

    /// Count by category
    pub by_category: std::collections::HashMap<String, usize>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_entry(level: &str, category: &str, message: &str) -> LogEntry {
        LogEntry::new(level.to_string(), category.to_string(), message.to_string())
    }

    #[test]
    fn test_add_and_get_all() {
        let aggregator = LogAggregator::new(100);
        aggregator.add(create_test_entry("INFO", "container", "Test message 1"));
        aggregator.add(create_test_entry("ERROR", "docker", "Test message 2"));

        let entries = aggregator.get_all();
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn test_buffer_eviction() {
        let aggregator = LogAggregator::new(3);
        aggregator.add(create_test_entry("INFO", "container", "Message 1"));
        aggregator.add(create_test_entry("INFO", "container", "Message 2"));
        aggregator.add(create_test_entry("INFO", "container", "Message 3"));
        aggregator.add(create_test_entry("INFO", "container", "Message 4"));

        let entries = aggregator.get_all();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].message, "Message 2");
        assert_eq!(entries[2].message, "Message 4");
    }

    #[test]
    fn test_filter_by_category() {
        let aggregator = LogAggregator::new(100);
        aggregator.add(create_test_entry("INFO", "container", "Container message"));
        aggregator.add(create_test_entry("INFO", "docker", "Docker message"));
        aggregator.add(create_test_entry("INFO", "container", "Another container message"));

        let container_logs = aggregator.get_by_category("container");
        assert_eq!(container_logs.len(), 2);
    }

    #[test]
    fn test_filter_by_level() {
        let aggregator = LogAggregator::new(100);
        aggregator.add(create_test_entry("INFO", "container", "Info message"));
        aggregator.add(create_test_entry("ERROR", "docker", "Error message"));
        aggregator.add(create_test_entry("INFO", "network", "Another info message"));

        let error_logs = aggregator.get_by_level("ERROR");
        assert_eq!(error_logs.len(), 1);
        assert_eq!(error_logs[0].message, "Error message");
    }

    #[test]
    fn test_search() {
        let aggregator = LogAggregator::new(100);
        aggregator.add(create_test_entry("INFO", "container", "Container abc123 started"));
        aggregator.add(create_test_entry("INFO", "container", "Container def456 stopped"));
        aggregator.add(create_test_entry("INFO", "docker", "Image pulled"));

        let results = aggregator.search("abc123");
        assert_eq!(results.len(), 1);
        assert!(results[0].message.contains("abc123"));
    }

    #[test]
    fn test_get_stats() {
        let aggregator = LogAggregator::new(100);
        aggregator.add(create_test_entry("INFO", "container", "Message 1"));
        aggregator.add(create_test_entry("ERROR", "docker", "Message 2"));
        aggregator.add(create_test_entry("INFO", "container", "Message 3"));

        let stats = aggregator.get_stats();
        assert_eq!(stats.total_entries, 3);
        assert_eq!(stats.buffered_entries, 3);
        assert_eq!(*stats.by_level.get("INFO").unwrap(), 2);
        assert_eq!(*stats.by_level.get("ERROR").unwrap(), 1);
        assert_eq!(*stats.by_category.get("container").unwrap(), 2);
    }
}
