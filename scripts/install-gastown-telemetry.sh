#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
METRICS_SCRIPT="$REPO_ROOT/scripts/send_gastown_metrics.py"
PYTHON_BIN=${PYTHON_BIN:-python3}
INTERVAL_SECONDS=${GASTOWN_TELEMETRY_INTERVAL_SECONDS:-60}
LOOKBACK=${GASTOWN_TELEMETRY_LOOKBACK:-1h}
ENV_FILE=${GASTOWN_TELEMETRY_ENV_FILE:-"$REPO_ROOT/.env.gastown.telemetry"}
SERVICE_NAME=${GASTOWN_TELEMETRY_SERVICE_NAME:-com.gastown.telemetry}

if [[ ! -x "$PYTHON_BIN" && -z "$(command -v "$PYTHON_BIN" 2>/dev/null)" ]]; then
  echo "Python not found: $PYTHON_BIN" >&2
  exit 1
fi

if [[ ! -f "$METRICS_SCRIPT" ]]; then
  echo "Metrics script not found: $METRICS_SCRIPT" >&2
  exit 1
fi

create_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi

  cat <<EOF > "$ENV_FILE"
# Datadog + Gas Town telemetry env
DD_ENV=${DD_ENV:-studio}
DD_AGENT_HOST=${DD_AGENT_HOST:-127.0.0.1}
DD_DOGSTATSD_PORT=${DD_DOGSTATSD_PORT:-8125}
DD_LLMOBS_ML_APP=${DD_LLMOBS_ML_APP:-gastown}
AI_AGENT_EVENTS_ENABLED=${AI_AGENT_EVENTS_ENABLED:-true}
AI_AGENT_MIRROR_RAW=${AI_AGENT_MIRROR_RAW:-true}
AI_AGENT_MIRROR_PREFIXES=${AI_AGENT_MIRROR_PREFIXES:-gastown.,ralph.,sequential_thinking.,claude.,openai.,tokens.}
GASTOWN_METRICS_MIRROR_NAMESPACE=${GASTOWN_METRICS_MIRROR_NAMESPACE:-ai_agent}
GASTOWN_METRICS_MIRROR_PREFIXES=${GASTOWN_METRICS_MIRROR_PREFIXES:-gastown.,ralph.,sequential_thinking.,claude.,openai.,tokens.,mcp.}
EOF

  echo "Created env file: $ENV_FILE"
}

install_launchd() {
  create_env_file

  local plist="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
  mkdir -p "$HOME/Library/LaunchAgents"

  cat <<EOF > "$plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${PYTHON_BIN}</string>
    <string>${METRICS_SCRIPT}</string>
    <string>--since</string>
    <string>${LOOKBACK}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
$(awk -F= 'NF==2 {printf "    <key>%s</key>\n    <string>%s</string>\n", $1, $2}' "$ENV_FILE")
  </dict>
  <key>StartInterval</key>
  <integer>${INTERVAL_SECONDS}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${REPO_ROOT}/logs/gastown-telemetry.out.log</string>
  <key>StandardErrorPath</key>
  <string>${REPO_ROOT}/logs/gastown-telemetry.err.log</string>
</dict>
</plist>
EOF

  launchctl unload "$plist" >/dev/null 2>&1 || true
  launchctl load "$plist"
  echo "LaunchAgent installed: $plist"
}

install_systemd_user() {
  create_env_file

  local systemd_dir="$HOME/.config/systemd/user"
  local service_file="$systemd_dir/gastown-telemetry.service"
  local timer_file="$systemd_dir/gastown-telemetry.timer"
  mkdir -p "$systemd_dir"

  cat <<EOF > "$service_file"
[Unit]
Description=Gas Town Datadog telemetry

[Service]
Type=oneshot
WorkingDirectory=${REPO_ROOT}
EnvironmentFile=${ENV_FILE}
ExecStart=${PYTHON_BIN} ${METRICS_SCRIPT} --since ${LOOKBACK}
EOF

  cat <<EOF > "$timer_file"
[Unit]
Description=Run Gas Town telemetry every ${INTERVAL_SECONDS}s

[Timer]
OnBootSec=30s
OnUnitActiveSec=${INTERVAL_SECONDS}s
AccuracySec=10s

[Install]
WantedBy=timers.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable --now gastown-telemetry.timer
  echo "Systemd user service installed: $service_file"
}

uninstall_launchd() {
  local plist="$HOME/Library/LaunchAgents/${SERVICE_NAME}.plist"
  if [[ -f "$plist" ]]; then
    launchctl unload "$plist" >/dev/null 2>&1 || true
    rm -f "$plist"
    echo "Removed $plist"
  fi
}

uninstall_systemd_user() {
  systemctl --user disable --now gastown-telemetry.timer >/dev/null 2>&1 || true
  systemctl --user disable --now gastown-telemetry.service >/dev/null 2>&1 || true
  rm -f "$HOME/.config/systemd/user/gastown-telemetry.timer"
  rm -f "$HOME/.config/systemd/user/gastown-telemetry.service"
  systemctl --user daemon-reload || true
  echo "Removed systemd user service"
}

if [[ "${1:-}" == "--uninstall" ]]; then
  if [[ "$(uname -s)" == "Darwin" ]]; then
    uninstall_launchd
  else
    uninstall_systemd_user
  fi
  exit 0
fi

case "$(uname -s)" in
  Darwin)
    install_launchd
    ;;
  Linux)
    install_systemd_user
    ;;
  *)
    echo "Unsupported OS: $(uname -s)" >&2
    exit 1
    ;;
esac

cat <<EOF
Gas Town telemetry installed.
- Env: ${ENV_FILE}
- Metrics script: ${METRICS_SCRIPT}
- Interval: ${INTERVAL_SECONDS}s

Run this script on each machine that hosts Gas Town.
EOF
