#!/usr/bin/env node
/**
 * Datadog Log Aggregation Module for Node.js/Python Scripts
 * Provides centralized logging functionality for all deployment scripts
 * Usage: const logAggregation = require('./log-aggregation-node.js');
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

class LogAggregation {
    constructor() {
        this.enabled = process.env.DD_LOG_AGGREGATION_ENABLED !== 'false';
        this.serviceName = process.env.DD_SERVICE || 'vibecode-webgui';
        this.environment = process.env.DD_ENV || 'development';
        this.version = process.env.DD_VERSION || '1.0.0';
        this.apiKey = process.env.DD_API_KEY;
        this.logLevel = this.parseLogLevel(process.env.DD_LOG_LEVEL || 'info');
        this.logFile = null;
        this.startTime = Date.now();
        
        // Log levels
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
        
        this.init();
    }
    
    parseLogLevel(level) {
        return this.levels[level.toLowerCase()] || this.levels.info;
    }
    
    init() {
        if (!this.enabled) {
            console.log('ℹ️ Log aggregation disabled');
            return;
        }
        
        if (!this.apiKey) {
            console.log('⚠️ Warning: DD_API_KEY not set, log aggregation disabled');
            this.enabled = false;
            return;
        }
        
        try {
            // Create log directory
            const logDir = path.join(os.tmpdir(), 'datadog-logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            // Initialize log file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const scriptName = path.basename(process.argv[1], '.js');
            this.logFile = path.join(logDir, `${scriptName}-${timestamp}.log`);
            
            // Write initial metadata
            const metadata = {
                service: this.serviceName,
                env: this.environment,
                version: this.version,
                timestamp: new Date().toISOString(),
                script: scriptName,
                pid: process.pid
            };
            
            fs.writeFileSync(this.logFile, JSON.stringify(metadata) + '\n');
            
            console.log(`✅ Log aggregation initialized: ${this.logFile}`);
            
            // Set up cleanup on exit
            process.on('exit', () => this.cleanup());
            process.on('SIGINT', () => this.cleanup());
            process.on('SIGTERM', () => this.cleanup());
            
        } catch (error) {
            console.error('❌ Failed to initialize log aggregation:', error.message);
            this.enabled = false;
        }
    }
    
    async sendLogToDatadog(level, message, context = {}) {
        if (!this.enabled) return;
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message: message,
            service: this.serviceName,
            env: this.environment,
            version: this.version,
            script: path.basename(process.argv[1]),
            pid: process.pid,
            context: {
                ...context,
                component: path.basename(process.argv[1])
            }
        };
        
        try {
            // Write to local log file
            fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
            
            // Send to Datadog Logs API
            const postData = JSON.stringify(logEntry);
            const options = {
                hostname: 'http-intake.logs.datadoghq.com',
                port: 443,
                path: `/v1/input/${this.apiKey}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };
            
            const req = https.request(options, (res) => {
                // Silently handle response
            });
            
            req.on('error', () => {
                // Silently handle errors
            });
            
            req.write(postData);
            req.end();
            
        } catch (error) {
            // Silently handle errors to avoid disrupting main script
        }
    }
    
    log(level, message, context = {}) {
        if (this.levels[level] >= this.logLevel) {
            const emoji = {
                debug: '🔍',
                info: 'ℹ️',
                warn: '⚠️',
                error: '❌'
            }[level] || 'ℹ️';
            
            console.log(`${emoji} ${level.toUpperCase()}: ${message}`);
            this.sendLogToDatadog(level, message, context);
        }
    }
    
    debug(message, context = {}) {
        this.log('debug', message, context);
    }
    
    info(message, context = {}) {
        this.log('info', message, context);
    }
    
    warn(message, context = {}) {
        this.log('warn', message, context);
    }
    
    error(message, context = {}) {
        this.log('error', message, context);
    }
    
    logScriptStart(scriptName, parameters = {}) {
        this.info(`Script started: ${scriptName}`);
        this.sendLogToDatadog('info', 'Script execution started', {
            script: scriptName,
            parameters: JSON.stringify(parameters),
            event: 'script_start'
        });
    }
    
    logScriptEnd(scriptName, exitCode = 0, duration = null) {
        const actualDuration = duration || Math.round((Date.now() - this.startTime) / 1000);
        
        if (exitCode === 0) {
            this.info(`Script completed successfully: ${scriptName} (${actualDuration}s)`);
            this.sendLogToDatadog('info', 'Script execution completed', {
                script: scriptName,
                exit_code: exitCode,
                duration: actualDuration,
                event: 'script_end'
            });
        } else {
            this.error(`Script failed: ${scriptName} (exit code: ${exitCode}, duration: ${actualDuration}s)`);
            this.sendLogToDatadog('error', 'Script execution failed', {
                script: scriptName,
                exit_code: exitCode,
                duration: actualDuration,
                event: 'script_end',
                error: true
            });
        }
    }
    
    logDeploymentEvent(eventType, component, status, details = {}) {
        this.info(`Deployment event: ${eventType} - ${component} (${status})`);
        this.sendLogToDatadog('info', 'Deployment event', {
            event_type: eventType,
            component: component,
            status: status,
            details: JSON.stringify(details),
            event: 'deployment'
        });
    }
    
    logKubernetesEvent(operation, resource, namespace, status) {
        this.info(`Kubernetes event: ${operation} ${resource} in ${namespace} (${status})`);
        this.sendLogToDatadog('info', 'Kubernetes operation', {
            operation: operation,
            resource: resource,
            namespace: namespace,
            status: status,
            event: 'kubernetes'
        });
    }
    
    logDatabaseEvent(operation, database, status, details = {}) {
        this.info(`Database event: ${operation} on ${database} (${status})`);
        this.sendLogToDatadog('info', 'Database operation', {
            operation: operation,
            database: database,
            status: status,
            details: JSON.stringify(details),
            event: 'database'
        });
    }
    
    logPerformanceMetric(metricName, value, unit = '', tags = {}) {
        this.debug(`Performance metric: ${metricName} = ${value} ${unit}`);
        this.sendLogToDatadog('info', 'Performance metric', {
            metric_name: metricName,
            value: value,
            unit: unit,
            tags: JSON.stringify(tags),
            event: 'performance'
        });
    }
    
    cleanup() {
        if (this.logFile && fs.existsSync(this.logFile)) {
            try {
                // Send final summary log
                const logContent = fs.readFileSync(this.logFile, 'utf8');
                const lineCount = logContent.split('\n').filter(line => line.trim()).length;
                
                this.sendLogToDatadog('info', 'Script execution summary', {
                    total_log_entries: lineCount,
                    log_file: this.logFile,
                    event: 'script_summary'
                });
                
                // Clean up old log files (keep last 10)
                const logDir = path.dirname(this.logFile);
                const files = fs.readdirSync(logDir)
                    .filter(file => file.endsWith('.log'))
                    .map(file => ({
                        name: file,
                        path: path.join(logDir, file),
                        mtime: fs.statSync(path.join(logDir, file)).mtime
                    }))
                    .sort((a, b) => b.mtime - a.mtime);
                
                // Keep only the 10 most recent files
                files.slice(10).forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                    } catch (error) {
                        // Silently handle cleanup errors
                    }
                });
                
            } catch (error) {
                // Silently handle cleanup errors
            }
        }
    }
}

// Export for use in other modules
module.exports = LogAggregation;

// Auto-initialize if this file is executed directly
if (require.main === module) {
    const logAggregation = new LogAggregation();
    
    // Test the logging system
    logAggregation.info('Log aggregation test started');
    logAggregation.debug('Debug message test');
    logAggregation.warn('Warning message test');
    logAggregation.error('Error message test');
    
    logAggregation.logDeploymentEvent('test', 'test-component', 'success', { test: true });
    logAggregation.logPerformanceMetric('test_metric', 100, 'ms', { test: true });
    
    logAggregation.info('Log aggregation test completed');
}

