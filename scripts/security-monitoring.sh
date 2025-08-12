#!/bin/bash

# Automated Security Monitoring Script
# Continuously monitors for security threats and vulnerabilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_INTERVAL=${SECURITY_MONITORING_INTERVAL:-300} # 5 minutes default
LOG_FILE="/var/log/vibecode-security-monitor.log"
ALERT_WEBHOOK=${SECURITY_ALERT_WEBHOOK:-""}
MAX_LOG_SIZE=${MAX_LOG_SIZE:-104857600} # 100MB

echo -e "${BLUE}🛡️ VibeCode Security Monitoring Started${NC}"
echo "=============================================="
echo "Monitoring interval: ${MONITORING_INTERVAL} seconds"
echo "Log file: ${LOG_FILE}"
echo ""

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to rotate logs if they get too large
rotate_logs() {
    if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt $MAX_LOG_SIZE ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
        touch "$LOG_FILE"
        log_message "INFO: Log file rotated due to size limit"
    fi
}

# Function to send alerts
send_alert() {
    local severity=$1
    local message=$2
    local details=$3
    
    log_message "ALERT [$severity]: $message"
    
    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -s -X POST "$ALERT_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{
                \"severity\": \"$severity\",
                \"service\": \"vibecode-security\",
                \"message\": \"$message\",
                \"details\": \"$details\",
                \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
            }" || log_message "ERROR: Failed to send webhook alert"
    fi
}

# Check for suspicious processes
check_suspicious_processes() {
    log_message "INFO: Checking for suspicious processes..."
    
    # Look for common attack tools
    suspicious_processes=(
        "sqlmap" "nikto" "nmap" "masscan" "zap"
        "burpsuite" "havij" "acunetix" "nessus" "openvas"
        "metasploit" "msfconsole" "hydra" "john"
    )
    
    for process in "${suspicious_processes[@]}"; do
        if pgrep -f "$process" > /dev/null; then
            send_alert "HIGH" "Suspicious process detected: $process" "$(ps aux | grep $process | grep -v grep)"
        fi
    done
}

# Monitor failed authentication attempts
check_auth_failures() {
    log_message "INFO: Checking authentication failures..."
    
    # Check for repeated failed login attempts in application logs
    if [ -f "/var/log/vibecode/combined.log" ]; then
        recent_failures=$(tail -1000 /var/log/vibecode/combined.log | grep -c "authentication failed\|invalid credentials\|login failed" || echo 0)
        
        if [ "$recent_failures" -gt 50 ]; then
            send_alert "MEDIUM" "High number of authentication failures detected" "Failed attempts in last 1000 log entries: $recent_failures"
        fi
    fi
    
    # Check system auth logs for SSH brute force attempts
    if [ -f "/var/log/auth.log" ]; then
        ssh_failures=$(tail -1000 /var/log/auth.log | grep "$(date +'%b %d')" | grep -c "Failed password\|Invalid user" || echo 0)
        
        if [ "$ssh_failures" -gt 20 ]; then
            send_alert "HIGH" "SSH brute force attack detected" "Failed SSH attempts today: $ssh_failures"
        fi
    fi
}

# Monitor unusual network activity
check_network_activity() {
    log_message "INFO: Checking network activity..."
    
    # Check for unusual outbound connections
    if command -v netstat > /dev/null; then
        unusual_connections=$(netstat -tn | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -nr | head -10)
        
        # Alert if more than 100 connections to any single IP
        echo "$unusual_connections" | while read count ip; do
            if [ "$count" -gt 100 ]; then
                send_alert "MEDIUM" "High connection count to single IP" "IP: $ip, Connections: $count"
            fi
        done
    fi
}

# Check disk usage for potential DoS attacks
check_disk_usage() {
    log_message "INFO: Checking disk usage..."
    
    # Check if disk usage is above 90%
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 90 ]; then
        send_alert "HIGH" "Critical disk usage detected" "Disk usage: ${disk_usage}%"
    elif [ "$disk_usage" -gt 80 ]; then
        send_alert "MEDIUM" "High disk usage detected" "Disk usage: ${disk_usage}%"
    fi
    
    # Check for rapid log growth (potential log flooding attack)
    if [ -f "$LOG_FILE" ]; then
        current_size=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
        
        if [ -f "${LOG_FILE}.size" ]; then
            previous_size=$(cat "${LOG_FILE}.size")
            size_diff=$((current_size - previous_size))
            
            # Alert if log grew by more than 10MB in one interval
            if [ "$size_diff" -gt 10485760 ]; then
                send_alert "MEDIUM" "Rapid log growth detected" "Log size increased by $(($size_diff / 1024 / 1024))MB in ${MONITORING_INTERVAL} seconds"
            fi
        fi
        
        echo "$current_size" > "${LOG_FILE}.size"
    fi
}

# Check for malicious file uploads
check_malicious_uploads() {
    log_message "INFO: Checking for malicious uploads..."
    
    # Define upload directories to monitor
    upload_dirs=(
        "./uploads"
        "./public/uploads"
        "./tmp"
        "/tmp"
    )
    
    for dir in "${upload_dirs[@]}"; do
        if [ -d "$dir" ]; then
            # Look for executable files
            find "$dir" -type f -executable -newermt "$(date -d '5 minutes ago' +'%Y-%m-%d %H:%M:%S')" 2>/dev/null | while read file; do
                send_alert "HIGH" "Executable file uploaded" "File: $file"
            done
            
            # Look for suspicious file extensions
            find "$dir" -type f \( -name "*.php" -o -name "*.jsp" -o -name "*.asp" -o -name "*.aspx" -o -name "*.sh" -o -name "*.bat" -o -name "*.exe" \) -newermt "$(date -d '5 minutes ago' +'%Y-%m-%d %H:%M:%S')" 2>/dev/null | while read file; do
                send_alert "MEDIUM" "Suspicious file upload detected" "File: $file"
            done
        fi
    done
}

# Check application-specific security metrics
check_app_security() {
    log_message "INFO: Checking application security metrics..."
    
    # Check if the application is running
    if ! pgrep -f "node.*next" > /dev/null; then
        send_alert "HIGH" "Application process not running" "Next.js application appears to be down"
        return
    fi
    
    # Check for security endpoint availability
    if command -v curl > /dev/null; then
        security_check=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/monitoring/security" 2>/dev/null || echo "000")
        
        if [ "$security_check" != "200" ]; then
            send_alert "MEDIUM" "Security monitoring endpoint unavailable" "HTTP status: $security_check"
        fi
    fi
}

# Check for configuration tampering
check_config_integrity() {
    log_message "INFO: Checking configuration integrity..."
    
    # List of critical configuration files to monitor
    config_files=(
        "./package.json"
        "./next.config.js"
        "./src/middleware.ts"
        "./src/middleware/security-middleware.ts"
        "./.env"
        "./.env.local"
    )
    
    for config_file in "${config_files[@]}"; do
        if [ -f "$config_file" ]; then
            # Check if file was modified in the last monitoring interval
            if [ "$config_file" -nt "/tmp/vibecode-last-check" ]; then
                # Get file hash for integrity checking
                current_hash=$(shasum "$config_file" | awk '{print $1}')
                hash_file="/tmp/vibecode-$(basename "$config_file").hash"
                
                if [ -f "$hash_file" ]; then
                    previous_hash=$(cat "$hash_file")
                    if [ "$current_hash" != "$previous_hash" ]; then
                        send_alert "HIGH" "Configuration file modified" "File: $config_file"
                    fi
                fi
                
                echo "$current_hash" > "$hash_file"
            fi
        fi
    done
    
    # Update check timestamp
    touch "/tmp/vibecode-last-check"
}

# Run vulnerability scan
run_vulnerability_scan() {
    log_message "INFO: Running periodic vulnerability scan..."
    
    # Run npm audit and check for high/critical vulnerabilities
    if command -v npm > /dev/null; then
        audit_result=$(npm audit --audit-level=high --json 2>/dev/null || echo '{"metadata":{"vulnerabilities":{"high":0,"critical":0}}}')
        
        if command -v jq > /dev/null; then
            high_vulns=$(echo "$audit_result" | jq -r '.metadata.vulnerabilities.high // 0')
            critical_vulns=$(echo "$audit_result" | jq -r '.metadata.vulnerabilities.critical // 0')
            
            if [ "$critical_vulns" -gt 0 ]; then
                send_alert "HIGH" "Critical vulnerabilities detected" "Critical: $critical_vulns, High: $high_vulns"
            elif [ "$high_vulns" -gt 0 ]; then
                send_alert "MEDIUM" "High-severity vulnerabilities detected" "High: $high_vulns"
            fi
        fi
    fi
}

# Cleanup function
cleanup() {
    log_message "INFO: Security monitoring stopped (PID: $$)"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Main monitoring loop
main() {
    log_message "INFO: Security monitoring started (PID: $$)"
    
    vulnerability_scan_counter=0
    
    while true; do
        rotate_logs
        
        check_suspicious_processes
        check_auth_failures
        check_network_activity
        check_disk_usage
        check_malicious_uploads
        check_app_security
        check_config_integrity
        
        # Run vulnerability scan every hour (12 cycles of 5-minute intervals)
        vulnerability_scan_counter=$((vulnerability_scan_counter + 1))
        if [ $((vulnerability_scan_counter % 12)) -eq 0 ]; then
            run_vulnerability_scan
        fi
        
        log_message "INFO: Security check cycle completed"
        sleep "$MONITORING_INTERVAL"
    done
}

# Start monitoring
main "$@"