package sub

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func repoRoot() string {
	return envOr("TD_REPO_ROOT", "/Users/studio/gt")
}

func tdDsmScript() string {
	if v := os.Getenv("TD_DSM_TD"); v != "" {
		return v
	}

	// Prefer new script name; fall back to legacy td.old that still ships with DSM.
	candidates := []string{
		filepath.Join(repoRoot(), "daemon", "kafka-dsm", "td"),
		filepath.Join(repoRoot(), "daemon", "kafka-dsm", "td.old"),
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}

func tdKafkaStatusScript() string {
	if v := os.Getenv("TD_KAFKA_STATUS_SCRIPT"); v != "" {
		return v
	}
	return filepath.Join(repoRoot(), "td", "scripts", "kafka-queue-status.sh")
}

func tdKafkaSummaryScript() string {
	if v := os.Getenv("TD_KAFKA_SUMMARY_SCRIPT"); v != "" {
		return v
	}
	return filepath.Join(repoRoot(), "td", "scripts", "kafka-queue-summary.sh")
}

func tdKafkaTopicsFile() string {
	if v := os.Getenv("TD_KAFKA_TOPICS_FILE"); v != "" {
		return v
	}
	return filepath.Join(repoRoot(), "daemon", "kafka-dsm", "kafka-topics.txt")
}

func runExternal(bin string, args ...string) error {
	if bin == "" {
		return fmt.Errorf("command not set")
	}
	c := exec.Command(bin, args...)
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	c.Stdin = os.Stdin
	return c.Run()
}
