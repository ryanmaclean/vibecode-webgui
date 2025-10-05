// Log file retention and cleanup policies
// Agent 27: Staff SRE (Shopify macOS Observability Team)

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// Log retention configuration
#[derive(Debug, Clone)]
pub struct RetentionPolicy {
    /// Maximum age of log files in days
    pub max_age_days: u32,

    /// Maximum total size of log directory in MB
    pub max_size_mb: usize,

    /// Log directory path
    pub log_dir: PathBuf,
}

impl Default for RetentionPolicy {
    fn default() -> Self {
        let log_dir = if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home).join("Library/Logs/VibeCode")
        } else {
            PathBuf::from("/tmp/vibecode-logs")
        };

        Self {
            max_age_days: 7,
            max_size_mb: 500,
            log_dir,
        }
    }
}

impl RetentionPolicy {
    /// Create a new retention policy with custom settings
    pub fn new(log_dir: PathBuf, max_age_days: u32, max_size_mb: usize) -> Self {
        Self {
            max_age_days,
            max_size_mb,
            log_dir,
        }
    }

    /// Apply retention policy: delete old and oversized log files
    ///
    /// Returns the number of files deleted and bytes freed.
    pub fn apply(&self) -> std::io::Result<(usize, u64)> {
        if !self.log_dir.exists() {
            return Ok((0, 0));
        }

        let mut deleted_count = 0;
        let mut freed_bytes = 0;

        // Get all log files with metadata
        let mut log_files = self.get_log_files_with_metadata()?;

        // Sort by modification time (oldest first)
        log_files.sort_by_key(|(_, modified)| *modified);

        let now = SystemTime::now();
        let max_age = Duration::from_secs(self.max_age_days as u64 * 86400);
        let max_size_bytes = (self.max_size_mb as u64) * 1_048_576;

        // Calculate current total size
        let total_size: u64 = log_files.iter().map(|(path, _)| {
            fs::metadata(path).map(|m| m.len()).unwrap_or(0)
        }).sum();

        // Delete files that are too old
        for (path, modified) in &log_files {
            if let Ok(age) = now.duration_since(*modified) {
                if age > max_age {
                    if let Ok(metadata) = fs::metadata(path) {
                        let size = metadata.len();
                        if fs::remove_file(path).is_ok() {
                            tracing::info!(
                                path = %path.display(),
                                age_days = age.as_secs() / 86400,
                                size_mb = size / 1_048_576,
                                "Deleted old log file"
                            );
                            deleted_count += 1;
                            freed_bytes += size;
                        }
                    }
                }
            }
        }

        // If still over size limit, delete oldest files until under limit
        if total_size > max_size_bytes {
            let mut current_size = total_size - freed_bytes;

            for (path, _) in &log_files {
                if current_size <= max_size_bytes {
                    break;
                }

                // Skip already deleted files
                if !path.exists() {
                    continue;
                }

                if let Ok(metadata) = fs::metadata(path) {
                    let size = metadata.len();
                    if fs::remove_file(path).is_ok() {
                        tracing::info!(
                            path = %path.display(),
                            size_mb = size / 1_048_576,
                            reason = "size_limit",
                            "Deleted log file to free space"
                        );
                        deleted_count += 1;
                        freed_bytes += size;
                        current_size = current_size.saturating_sub(size);
                    }
                }
            }
        }

        Ok((deleted_count, freed_bytes))
    }

    /// Get all log files in the directory with their modification times
    fn get_log_files_with_metadata(&self) -> std::io::Result<Vec<(PathBuf, SystemTime)>> {
        let mut files = Vec::new();

        for entry in fs::read_dir(&self.log_dir)? {
            let entry = entry?;
            let path = entry.path();

            // Only process .log files
            if path.is_file() && path.extension().map_or(false, |ext| ext == "log") {
                if let Ok(metadata) = fs::metadata(&path) {
                    if let Ok(modified) = metadata.modified() {
                        files.push((path, modified));
                    }
                }
            }
        }

        Ok(files)
    }

    /// Get current disk usage statistics
    pub fn get_usage_stats(&self) -> std::io::Result<UsageStats> {
        if !self.log_dir.exists() {
            return Ok(UsageStats {
                total_files: 0,
                total_size_bytes: 0,
                oldest_file_age_days: 0,
                newest_file_age_days: 0,
            });
        }

        let log_files = self.get_log_files_with_metadata()?;
        let now = SystemTime::now();

        let total_files = log_files.len();
        let total_size_bytes: u64 = log_files.iter().map(|(path, _)| {
            fs::metadata(path).map(|m| m.len()).unwrap_or(0)
        }).sum();

        let mut oldest_age = Duration::from_secs(0);
        let mut newest_age = Duration::from_secs(u64::MAX);

        for (_, modified) in &log_files {
            if let Ok(age) = now.duration_since(*modified) {
                if age > oldest_age {
                    oldest_age = age;
                }
                if age < newest_age {
                    newest_age = age;
                }
            }
        }

        Ok(UsageStats {
            total_files,
            total_size_bytes,
            oldest_file_age_days: (oldest_age.as_secs() / 86400) as u32,
            newest_file_age_days: (newest_age.as_secs() / 86400) as u32,
        })
    }

    /// Compress old log files (keep last 1 day uncompressed)
    pub fn compress_old_logs(&self) -> std::io::Result<(usize, u64)> {
        // TODO: Implement gzip compression for logs older than 24h
        // This would save significant disk space while keeping recent logs accessible
        Ok((0, 0))
    }
}

/// Disk usage statistics for log directory
#[derive(Debug, Clone, serde::Serialize)]
pub struct UsageStats {
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub oldest_file_age_days: u32,
    pub newest_file_age_days: u32,
}

impl UsageStats {
    pub fn total_size_mb(&self) -> f64 {
        self.total_size_bytes as f64 / 1_048_576.0
    }

    pub fn is_over_limit(&self, max_size_mb: usize) -> bool {
        self.total_size_mb() > max_size_mb as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_log_file(dir: &Path, name: &str, size: usize, age_days: u32) -> PathBuf {
        let path = dir.join(name);
        let mut file = File::create(&path).unwrap();

        // Write dummy data
        let data = vec![b'x'; size];
        file.write_all(&data).unwrap();

        // Set modification time
        let modified = SystemTime::now() - Duration::from_secs(age_days as u64 * 86400);
        filetime::set_file_mtime(&path, filetime::FileTime::from_system_time(modified)).unwrap();

        path
    }

    #[test]
    fn test_retention_policy_age() {
        let temp_dir = TempDir::new().unwrap();

        // Create test log files
        create_test_log_file(temp_dir.path(), "old.log", 1024, 10);
        create_test_log_file(temp_dir.path(), "recent.log", 1024, 1);

        let policy = RetentionPolicy::new(
            temp_dir.path().to_path_buf(),
            7,  // 7 days
            100, // 100 MB
        );

        let (deleted, _) = policy.apply().unwrap();
        assert_eq!(deleted, 1, "Should delete 1 old file");

        assert!(!temp_dir.path().join("old.log").exists());
        assert!(temp_dir.path().join("recent.log").exists());
    }

    #[test]
    fn test_retention_policy_size() {
        let temp_dir = TempDir::new().unwrap();

        // Create files totaling 3MB (over 1MB limit)
        create_test_log_file(temp_dir.path(), "file1.log", 1_048_576, 3);
        create_test_log_file(temp_dir.path(), "file2.log", 1_048_576, 2);
        create_test_log_file(temp_dir.path(), "file3.log", 1_048_576, 1);

        let policy = RetentionPolicy::new(
            temp_dir.path().to_path_buf(),
            365, // Don't delete by age
            1,   // 1 MB limit
        );

        let (deleted, freed_bytes) = policy.apply().unwrap();
        assert!(deleted > 0, "Should delete files to meet size limit");
        assert!(freed_bytes > 0, "Should free bytes");

        let stats = policy.get_usage_stats().unwrap();
        assert!(stats.total_size_mb() <= 1.1, "Should be under size limit (with margin)");
    }

    #[test]
    fn test_usage_stats() {
        let temp_dir = TempDir::new().unwrap();

        create_test_log_file(temp_dir.path(), "file1.log", 1_048_576, 5);
        create_test_log_file(temp_dir.path(), "file2.log", 2_097_152, 2);

        let policy = RetentionPolicy::new(
            temp_dir.path().to_path_buf(),
            7,
            100,
        );

        let stats = policy.get_usage_stats().unwrap();
        assert_eq!(stats.total_files, 2);
        assert!((stats.total_size_mb() - 3.0).abs() < 0.1);
        assert_eq!(stats.oldest_file_age_days, 5);
    }
}
