package commands

// Script-backed commands for parity with bash/python implementations.
var scriptProxyCommands = map[string]*ScriptProxyCommand{
	"query-app-security": NewScriptProxyCommand(
		"query-app-security",
		"Query Application Security events",
		"python/query_app_security.py",
		"python3",
	),
	"query-cloud-security": NewScriptProxyCommand(
		"query-cloud-security",
		"Query Cloud Security events",
		"python/query_cloud_security.py",
		"python3",
	),
	"query-error-tracking": NewScriptProxyCommand(
		"query-error-tracking",
		"Query Error Tracking issues",
		"python/query_error_tracking.py",
		"python3",
	),
	"query-data-streams": NewScriptProxyCommand(
		"query-data-streams",
		"Query Data Streams Monitoring",
		"python/query_data_streams.py",
		"python3",
	),
	"query-hosts": NewScriptProxyCommand(
		"query-hosts",
		"Query infrastructure hosts",
		"python/query_hosts.py",
		"python3",
	),
	"query-session-replay": NewScriptProxyCommand(
		"query-session-replay",
		"Query Session Replay data",
		"python/query_session_replay.py",
		"python3",
	),
	"query-profiling": NewScriptProxyCommand(
		"query-profiling",
		"Query profiling data",
		"python/query_profiling.py",
		"python3",
	),
	"query-ci-tests": NewScriptProxyCommand(
		"query-ci-tests",
		"Query CI test results",
		"python/query_ci_tests.py",
		"python3",
	),
	"manage-logs-pipelines": NewScriptProxyCommand(
		"manage-logs-pipelines",
		"Manage log pipelines",
		"python/manage_logs_pipelines.py",
		"python3",
	),
	"manage-custom-metrics": NewScriptProxyCommand(
		"manage-custom-metrics",
		"Manage custom metrics",
		"python/manage_custom_metrics.py",
		"python3",
	),
	"manage-restriction-policies": NewScriptProxyCommand(
		"manage-restriction-policies",
		"Manage restriction policies",
		"python/manage_restriction_policies.py",
		"python3",
	),
	"manage-webhooks": NewScriptProxyCommand(
		"manage-webhooks",
		"Manage webhooks",
		"python/manage_webhooks.py",
		"python3",
	),
	"verify-setup": NewScriptProxyCommand(
		"verify-setup",
		"Verify Datadog setup and configuration",
		"python/verify_setup.py",
		"python3",
	),
	"investigate-service": NewScriptProxyCommand(
		"investigate-service",
		"Comprehensive service investigation",
		"python/investigate_service.py",
		"python3",
	),
	"example-monitored-script": NewScriptProxyCommand(
		"example-monitored-script",
		"Example monitored script with Datadog instrumentation",
		"scripts/example-monitored-script.sh",
		"bash",
	),
	"test-monitoring": NewScriptProxyCommand(
		"test-monitoring",
		"Run monitoring test harness",
		"scripts/TEST_MONITORING.sh",
		"bash",
	),
}

// GetScriptProxyCommand returns a proxy command if it exists.
func GetScriptProxyCommand(name string) Command {
	if cmd, ok := scriptProxyCommands[name]; ok {
		return cmd
	}
	return nil
}
