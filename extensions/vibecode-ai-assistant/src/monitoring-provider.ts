import * as vscode from 'vscode';
import axios from 'axios';

interface SystemMetrics {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    uptime: number;
    request_rate: number;
    error_rate: number;
}

interface UsageMetrics {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    avg_response_time: number;
    total_tokens: number;
    total_cost: number;
    active_users: number;
    active_sessions: number;
}

interface PerformanceMetrics {
    p50_response_time: number;
    p95_response_time: number;
    p99_response_time: number;
    throughput: number;
    cache_hit_rate: number;
    queue_size: number;
}

interface AlertMetrics {
    active_alerts: number;
    critical_alerts: number;
    warning_alerts: number;
    recent_alerts: Alert[];
}

interface Alert {
    id: string;
    level: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string;
    service: string;
    resolved: boolean;
}

interface DeploymentMetrics {
    total_deployments: number;
    successful_deployments: number;
    failed_deployments: number;
    avg_deployment_time: number;
    active_deployments: number;
}

export class MonitoringProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vibeCodeMonitoring';

    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;
    private _apiBaseUrl: string;
    private _refreshInterval: NodeJS.Timeout | null = null;
    private _isRefreshing = false;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._apiBaseUrl = 'http://localhost:3000';
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'refresh':
                    await this._refreshMetrics();
                    break;
                case 'toggleAutoRefresh':
                    this._toggleAutoRefresh(data.enabled);
                    break;
                case 'openFullDashboard':
                    await this._openFullDashboard();
                    break;
                case 'exportMetrics':
                    await this._exportMetrics(data.format);
                    break;
                case 'acknowledgeAlert':
                    await this._acknowledgeAlert(data.alertId);
                    break;
                case 'clearAlerts':
                    await this._clearAllAlerts();
                    break;
            }
        });

        // Initial load
        this._refreshMetrics();

        // Auto-refresh every 30 seconds by default
        this._toggleAutoRefresh(true);
    }

    private async _refreshMetrics(): Promise<void> {
        if (this._isRefreshing || !this._view) {
            return;
        }

        this._isRefreshing = true;

        try {
            const [systemMetrics, usageMetrics, performanceMetrics, alertMetrics, deploymentMetrics] = await Promise.allSettled([
                this._fetchSystemMetrics(),
                this._fetchUsageMetrics(),
                this._fetchPerformanceMetrics(),
                this._fetchAlertMetrics(),
                this._fetchDeploymentMetrics()
            ]);

            const data = {
                system: systemMetrics.status === 'fulfilled' ? systemMetrics.value : this._getMockSystemMetrics(),
                usage: usageMetrics.status === 'fulfilled' ? usageMetrics.value : this._getMockUsageMetrics(),
                performance: performanceMetrics.status === 'fulfilled' ? performanceMetrics.value : this._getMockPerformanceMetrics(),
                alerts: alertMetrics.status === 'fulfilled' ? alertMetrics.value : this._getMockAlertMetrics(),
                deployments: deploymentMetrics.status === 'fulfilled' ? deploymentMetrics.value : this._getMockDeploymentMetrics(),
                lastUpdated: new Date().toISOString()
            };

            this._view.webview.postMessage({
                command: 'updateMetrics',
                data: data
            });

        } catch (error) {
            console.error('Failed to refresh metrics:', error);
        } finally {
            this._isRefreshing = false;
        }
    }

    private async _fetchSystemMetrics(): Promise<SystemMetrics> {
        const response = await axios.get(`${this._apiBaseUrl}/api/monitoring/system`);
        return response.data;
    }

    private async _fetchUsageMetrics(): Promise<UsageMetrics> {
        const response = await axios.get(`${this._apiBaseUrl}/api/monitoring/usage`);
        return response.data;
    }

    private async _fetchPerformanceMetrics(): Promise<PerformanceMetrics> {
        const response = await axios.get(`${this._apiBaseUrl}/api/monitoring/performance`);
        return response.data;
    }

    private async _fetchAlertMetrics(): Promise<AlertMetrics> {
        const response = await axios.get(`${this._apiBaseUrl}/api/monitoring/alerts`);
        return response.data;
    }

    private async _fetchDeploymentMetrics(): Promise<DeploymentMetrics> {
        const response = await axios.get(`${this._apiBaseUrl}/api/monitoring/deployments`);
        return response.data;
    }

    private _getMockSystemMetrics(): SystemMetrics {
        return {
            cpu_usage: 45.2,
            memory_usage: 68.9,
            disk_usage: 23.1,
            uptime: 432000, // 5 days
            request_rate: 125.3,
            error_rate: 0.8
        };
    }

    private _getMockUsageMetrics(): UsageMetrics {
        return {
            total_requests: 15420,
            successful_requests: 15298,
            failed_requests: 122,
            avg_response_time: 245,
            total_tokens: 2840567,
            total_cost: 45.67,
            active_users: 23,
            active_sessions: 8
        };
    }

    private _getMockPerformanceMetrics(): PerformanceMetrics {
        return {
            p50_response_time: 180,
            p95_response_time: 450,
            p99_response_time: 890,
            throughput: 98.5,
            cache_hit_rate: 85.2,
            queue_size: 3
        };
    }

    private _getMockAlertMetrics(): AlertMetrics {
        return {
            active_alerts: 2,
            critical_alerts: 0,
            warning_alerts: 2,
            recent_alerts: [
                {
                    id: 'alert-1',
                    level: 'warning',
                    message: 'Memory usage above 70%',
                    timestamp: new Date(Date.now() - 300000).toISOString(),
                    service: 'ai-gateway',
                    resolved: false
                },
                {
                    id: 'alert-2',
                    level: 'warning',
                    message: 'Response time increased by 15%',
                    timestamp: new Date(Date.now() - 600000).toISOString(),
                    service: 'templates-api',
                    resolved: false
                }
            ]
        };
    }

    private _getMockDeploymentMetrics(): DeploymentMetrics {
        return {
            total_deployments: 156,
            successful_deployments: 148,
            failed_deployments: 8,
            avg_deployment_time: 127,
            active_deployments: 2
        };
    }

    private _toggleAutoRefresh(enabled: boolean): void {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = null;
        }

        if (enabled) {
            this._refreshInterval = setInterval(() => {
                this._refreshMetrics();
            }, 30000); // Refresh every 30 seconds

            this._context.subscriptions.push({ dispose: () => {
                if (this._refreshInterval) {
                    clearInterval(this._refreshInterval);
                }
            }});
        }
    }

    private async _openFullDashboard(): Promise<void> {
        const dashboardUrl = `${this._apiBaseUrl}/dashboard`;
        try {
            await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open dashboard: ${error}`);
        }
    }

    private async _exportMetrics(format: 'json' | 'csv'): Promise<void> {
        try {
            const response = await axios.get(`${this._apiBaseUrl}/api/monitoring/export`, {
                params: { format }
            });

            const timestamp = new Date().toISOString().split('T')[0];
            const extension = format === 'json' ? 'json' : 'csv';
            const defaultFilename = `metrics-${timestamp}.${extension}`;

            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultFilename),
                filters: format === 'json' ? 
                    { 'JSON files': ['json'] } : 
                    { 'CSV files': ['csv'] }
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(response.data));
                vscode.window.showInformationMessage(`Metrics exported to ${uri.fsPath}`);
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to export metrics: ${error.response?.data?.error || error.message}`);
        }
    }

    private async _acknowledgeAlert(alertId: string): Promise<void> {
        try {
            await axios.post(`${this._apiBaseUrl}/api/monitoring/alerts/${alertId}/acknowledge`);
            await this._refreshMetrics();
            vscode.window.showInformationMessage('Alert acknowledged');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to acknowledge alert: ${error.response?.data?.error || error.message}`);
        }
    }

    private async _clearAllAlerts(): Promise<void> {
        const confirmation = await vscode.window.showWarningMessage(
            'Are you sure you want to clear all alerts?',
            'Yes', 'Cancel'
        );

        if (confirmation !== 'Yes') {
            return;
        }

        try {
            await axios.delete(`${this._apiBaseUrl}/api/monitoring/alerts`);
            await this._refreshMetrics();
            vscode.window.showInformationMessage('All alerts cleared');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to clear alerts: ${error.response?.data?.error || error.message}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Monitoring Dashboard</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 12px;
                    margin: 0;
                    line-height: 1.4;
                }
                
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                
                .title {
                    font-weight: 600;
                    font-size: 14px;
                }
                
                .controls {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                
                .controls button {
                    background: none;
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-foreground);
                    padding: 4px 8px;
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 11px;
                }
                
                .controls button:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                
                .checkbox {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                }
                
                .section {
                    margin-bottom: 16px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                    padding: 12px;
                }
                
                .section-title {
                    font-weight: 600;
                    font-size: 13px;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .metrics-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                }
                
                .metric {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 6px 8px;
                    background-color: var(--vscode-list-hoverBackground);
                    border-radius: 2px;
                }
                
                .metric-label {
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .metric-value {
                    font-size: 12px;
                    font-weight: 600;
                    font-family: var(--vscode-editor-font-family);
                }
                
                .status-good { color: #4caf50; }
                .status-warning { color: #ff9800; }
                .status-error { color: #f44336; }
                
                .alerts-list {
                    max-height: 120px;
                    overflow-y: auto;
                }
                
                .alert {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 6px 8px;
                    margin-bottom: 4px;
                    background-color: var(--vscode-list-hoverBackground);
                    border-radius: 2px;
                    border-left: 3px solid;
                }
                
                .alert.warning { border-left-color: #ff9800; }
                .alert.critical { border-left-color: #f44336; }
                .alert.info { border-left-color: #2196f3; }
                
                .alert-content {
                    flex: 1;
                    font-size: 11px;
                }
                
                .alert-message {
                    font-weight: 500;
                    margin-bottom: 2px;
                }
                
                .alert-details {
                    color: var(--vscode-descriptionForeground);
                }
                
                .alert-actions {
                    display: flex;
                    gap: 4px;
                }
                
                .alert-btn {
                    background: none;
                    border: none;
                    color: var(--vscode-descriptionForeground);
                    cursor: pointer;
                    padding: 2px 4px;
                    font-size: 10px;
                }
                
                .alert-btn:hover {
                    background-color: var(--vscode-list-activeSelectionBackground);
                }
                
                .no-alerts {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    padding: 16px;
                }
                
                .last-updated {
                    text-align: center;
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid var(--vscode-panel-border);
                }
                
                .loading {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    padding: 20px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">📊 Monitoring Dashboard</div>
                <div class="controls">
                    <label class="checkbox">
                        <input type="checkbox" id="autoRefresh" checked>
                        Auto-refresh
                    </label>
                    <button id="refreshBtn">↻ Refresh</button>
                    <button id="fullDashboardBtn">🔍 Full Dashboard</button>
                </div>
            </div>
            
            <div id="loading" class="loading">
                Loading metrics...
            </div>
            
            <div id="content" style="display: none;">
                <!-- System Health -->
                <div class="section">
                    <div class="section-title">🖥️ System Health</div>
                    <div class="metrics-grid">
                        <div class="metric">
                            <span class="metric-label">CPU Usage</span>
                            <span class="metric-value" id="cpuUsage">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Memory</span>
                            <span class="metric-value" id="memoryUsage">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Disk Usage</span>
                            <span class="metric-value" id="diskUsage">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Uptime</span>
                            <span class="metric-value" id="uptime">-</span>
                        </div>
                    </div>
                </div>
                
                <!-- Usage Statistics -->
                <div class="section">
                    <div class="section-title">📈 Usage Statistics</div>
                    <div class="metrics-grid">
                        <div class="metric">
                            <span class="metric-label">Total Requests</span>
                            <span class="metric-value" id="totalRequests">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Success Rate</span>
                            <span class="metric-value" id="successRate">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Avg Response</span>
                            <span class="metric-value" id="avgResponse">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Total Cost</span>
                            <span class="metric-value" id="totalCost">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Active Users</span>
                            <span class="metric-value" id="activeUsers">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Active Sessions</span>
                            <span class="metric-value" id="activeSessions">-</span>
                        </div>
                    </div>
                </div>
                
                <!-- Performance Metrics -->
                <div class="section">
                    <div class="section-title">⚡ Performance</div>
                    <div class="metrics-grid">
                        <div class="metric">
                            <span class="metric-label">P50 Response</span>
                            <span class="metric-value" id="p50Response">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">P95 Response</span>
                            <span class="metric-value" id="p95Response">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Throughput</span>
                            <span class="metric-value" id="throughput">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Cache Hit Rate</span>
                            <span class="metric-value" id="cacheHitRate">-</span>
                        </div>
                    </div>
                </div>
                
                <!-- Deployments -->
                <div class="section">
                    <div class="section-title">🚀 Deployments</div>
                    <div class="metrics-grid">
                        <div class="metric">
                            <span class="metric-label">Total Deployments</span>
                            <span class="metric-value" id="totalDeployments">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Success Rate</span>
                            <span class="metric-value" id="deploymentSuccessRate">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Avg Time</span>
                            <span class="metric-value" id="avgDeploymentTime">-</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Active Now</span>
                            <span class="metric-value" id="activeDeployments">-</span>
                        </div>
                    </div>
                </div>
                
                <!-- Alerts -->
                <div class="section">
                    <div class="section-title">
                        🚨 Active Alerts 
                        <span id="alertCount" class="status-good">(0)</span>
                        <button id="clearAlertsBtn" class="alert-btn" style="margin-left: auto;">Clear All</button>
                    </div>
                    <div id="alertsList" class="alerts-list">
                        <div class="no-alerts">No active alerts</div>
                    </div>
                </div>
                
                <div class="last-updated">
                    Last updated: <span id="lastUpdated">-</span>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                document.getElementById('refreshBtn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'refresh' });
                });
                
                document.getElementById('autoRefresh').addEventListener('change', (e) => {
                    vscode.postMessage({ 
                        command: 'toggleAutoRefresh', 
                        enabled: e.target.checked 
                    });
                });
                
                document.getElementById('fullDashboardBtn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'openFullDashboard' });
                });
                
                document.getElementById('clearAlertsBtn').addEventListener('click', () => {
                    vscode.postMessage({ command: 'clearAlerts' });
                });
                
                function updateMetrics(data) {
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('content').style.display = 'block';
                    
                    // System metrics
                    document.getElementById('cpuUsage').textContent = data.system.cpu_usage.toFixed(1) + '%';
                    document.getElementById('memoryUsage').textContent = data.system.memory_usage.toFixed(1) + '%';
                    document.getElementById('diskUsage').textContent = data.system.disk_usage.toFixed(1) + '%';
                    document.getElementById('uptime').textContent = formatUptime(data.system.uptime);
                    
                    // Usage metrics
                    document.getElementById('totalRequests').textContent = data.usage.total_requests.toLocaleString();
                    const successRate = ((data.usage.successful_requests / data.usage.total_requests) * 100).toFixed(1);
                    document.getElementById('successRate').textContent = successRate + '%';
                    document.getElementById('avgResponse').textContent = data.usage.avg_response_time + 'ms';
                    document.getElementById('totalCost').textContent = '$' + data.usage.total_cost.toFixed(2);
                    document.getElementById('activeUsers').textContent = data.usage.active_users;
                    document.getElementById('activeSessions').textContent = data.usage.active_sessions;
                    
                    // Performance metrics
                    document.getElementById('p50Response').textContent = data.performance.p50_response_time + 'ms';
                    document.getElementById('p95Response').textContent = data.performance.p95_response_time + 'ms';
                    document.getElementById('throughput').textContent = data.performance.throughput.toFixed(1) + '%';
                    document.getElementById('cacheHitRate').textContent = data.performance.cache_hit_rate.toFixed(1) + '%';
                    
                    // Deployment metrics
                    document.getElementById('totalDeployments').textContent = data.deployments.total_deployments;
                    const deploySuccessRate = ((data.deployments.successful_deployments / data.deployments.total_deployments) * 100).toFixed(1);
                    document.getElementById('deploymentSuccessRate').textContent = deploySuccessRate + '%';
                    document.getElementById('avgDeploymentTime').textContent = data.deployments.avg_deployment_time + 's';
                    document.getElementById('activeDeployments').textContent = data.deployments.active_deployments;
                    
                    // Alerts
                    updateAlerts(data.alerts);
                    
                    // Last updated
                    document.getElementById('lastUpdated').textContent = new Date(data.lastUpdated).toLocaleTimeString();
                }
                
                function updateAlerts(alerts) {
                    const alertCount = document.getElementById('alertCount');
                    const alertsList = document.getElementById('alertsList');
                    
                    alertCount.textContent = \`(\${alerts.active_alerts})\`;
                    alertCount.className = alerts.critical_alerts > 0 ? 'status-error' : 
                                          alerts.warning_alerts > 0 ? 'status-warning' : 'status-good';
                    
                    if (alerts.recent_alerts.length === 0) {
                        alertsList.innerHTML = '<div class="no-alerts">No active alerts</div>';
                    } else {
                        alertsList.innerHTML = alerts.recent_alerts.map(alert => \`
                            <div class="alert \${alert.level}">
                                <div class="alert-content">
                                    <div class="alert-message">\${alert.message}</div>
                                    <div class="alert-details">
                                        \${alert.service} • \${new Date(alert.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                                <div class="alert-actions">
                                    <button class="alert-btn" onclick="acknowledgeAlert('\${alert.id}')">✓</button>
                                </div>
                            </div>
                        \`).join('');
                    }
                }
                
                function acknowledgeAlert(alertId) {
                    vscode.postMessage({ 
                        command: 'acknowledgeAlert', 
                        alertId: alertId 
                    });
                }
                
                function formatUptime(seconds) {
                    const days = Math.floor(seconds / 86400);
                    const hours = Math.floor((seconds % 86400) / 3600);
                    const mins = Math.floor((seconds % 3600) / 60);
                    
                    if (days > 0) return \`\${days}d \${hours}h\`;
                    if (hours > 0) return \`\${hours}h \${mins}m\`;
                    return \`\${mins}m\`;
                }
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    if (message.command === 'updateMetrics') {
                        updateMetrics(message.data);
                    }
                });
            </script>
        </body>
        </html>`;
    }
}