// Database connection pool predictive scaling
// Provides advanced algorithms for dynamically managing connection pool size

import { connectionPool, poolConfig, getWaitingAcquires } from './db-pool';
import { getDatabaseLogger } from './database-logger';
import { LogCategory } from './db-types';

// Time window for tracking metrics (in ms)
const TIME_WINDOWS = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 15 * 60 * 1000 // 15 minutes
};

// Prediction strategy types
export enum PredictionStrategy {
  MOVING_AVERAGE = 'moving_average',
  EXPONENTIAL_SMOOTHING = 'exponential_smoothing',
  LINEAR_REGRESSION = 'linear_regression',
  USAGE_PATTERN = 'usage_pattern'
}

// Metric collection for predictive scaling
interface MetricDataPoint {
  timestamp: number;
  connectionCount: number;
  activeConnections: number;
  acquireTime: number;
  waitingAcquires: number;
}

// Configuration for predictive scaling
interface PredictiveScalingConfig {
  enabled: boolean;
  strategy: PredictionStrategy;
  minConnections: number;
  maxConnections: number;
  scaleUpThreshold: number; // percentage of pool utilization to trigger scale up
  scaleDownThreshold: number; // percentage of pool utilization to trigger scale down
  scaleUpFactor: number; // how much to scale up (e.g., 1.5 = 50% increase)
  scaleDownFactor: number; // how much to scale down (e.g., 0.8 = 20% decrease)
  cooldownPeriod: number; // milliseconds to wait between scaling actions
  forecastWindow: number; // milliseconds to look ahead for predictions
  aggressiveness: number; // 0-1 how aggressively to scale
  usagePatternDetection: boolean; // enable time-based usage pattern detection
  burstDetectionEnabled: boolean; // enable burst traffic detection
  burstThreshold: number; // percentage increase over baseline to consider a burst
  burstScaleFactor: number; // how much to scale during burst (e.g., 2.0 = double)
  burstCooldownPeriod: number; // cooldown after burst scaling (ms)
  warmupEnabled: boolean; // enable connection warmup/preheating
  warmupSize: number; // number of connections to preheat
}

// Default configuration
const DEFAULT_CONFIG: PredictiveScalingConfig = {
  enabled: process.env.DB_POOL_PREDICTIVE_SCALING === 'true',
  strategy: (process.env.DB_POOL_PREDICTION_STRATEGY as PredictionStrategy) || PredictionStrategy.MOVING_AVERAGE,
  minConnections: poolConfig.minSize,
  maxConnections: poolConfig.maxSize,
  scaleUpThreshold: 70, // Scale up when pool is 70% utilized
  scaleDownThreshold: 30, // Scale down when pool is less than 30% utilized
  scaleUpFactor: 1.5, // Scale up by 50%
  scaleDownFactor: 0.8, // Scale down by 20%
  cooldownPeriod: 60 * 1000, // 1 minute cooldown between scaling actions
  forecastWindow: 60 * 1000, // 1 minute forecast window
  aggressiveness: 0.5, // Moderate aggressiveness
  usagePatternDetection: true, // Enable usage pattern detection
  burstDetectionEnabled: process.env.DB_POOL_BURST_DETECTION !== 'false',
  burstThreshold: 150, // 150% of baseline = burst
  burstScaleFactor: 2.0, // Double capacity during burst
  burstCooldownPeriod: 30 * 1000, // 30 second cooldown after burst scaling
  warmupEnabled: process.env.DB_POOL_WARMUP !== 'false',
  warmupSize: Math.max(2, Math.floor(poolConfig.minSize * 0.5)) // Warmup at least 2 or half of min
};

// Burst detection state
interface BurstState {
  isInBurst: boolean;
  burstStartTime: number;
  burstEndTime: number;
  baselineConnections: number;
  peakConnections: number;
  lastBurstScaling: number;
}

// Connection warmup state
interface WarmupState {
  isWarmingUp: boolean;
  warmupStartTime: number;
  connectionsWarmed: number;
  targetConnections: number;
}

// Usage pattern detection state
interface UsagePatternData {
  hourlyPatterns: Map<number, {
    avgConnections: number;
    samples: number;
  }>;
  dayOfWeekPatterns: Map<number, {
    avgConnections: number;
    samples: number;
  }>;
  lastScalingAction: number;
}

// Predictive scaling state
class PredictiveScaler {
  private config: PredictiveScalingConfig;
  private metricHistory: MetricDataPoint[] = [];
  private usagePatterns: UsagePatternData = {
    hourlyPatterns: new Map(),
    dayOfWeekPatterns: new Map(),
    lastScalingAction: 0
  };
  private burstState: BurstState = {
    isInBurst: false,
    burstStartTime: 0,
    burstEndTime: 0,
    baselineConnections: 0,
    peakConnections: 0,
    lastBurstScaling: 0
  };
  private warmupState: WarmupState = {
    isWarmingUp: false,
    warmupStartTime: 0,
    connectionsWarmed: 0,
    targetConnections: 0
  };
  private logger = getDatabaseLogger({
    defaultCategory: LogCategory.CONNECTION
  });

  constructor(config: Partial<PredictiveScalingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger.info('Predictive connection pool scaler initialized', {
      strategy: this.config.strategy,
      enabled: this.config.enabled,
      burstDetection: this.config.burstDetectionEnabled,
      warmupEnabled: this.config.warmupEnabled
    });

    // Start warmup if enabled
    if (this.config.warmupEnabled) {
      this.initiateWarmup();
    }
  }

  /**
   * Initiate connection warmup/preheating
   */
  private initiateWarmup(): void {
    if (this.warmupState.isWarmingUp) return;

    this.warmupState = {
      isWarmingUp: true,
      warmupStartTime: Date.now(),
      connectionsWarmed: 0,
      targetConnections: this.config.warmupSize
    };

    this.logger.info('Initiating connection warmup', {
      targetConnections: this.config.warmupSize
    });

    // Warmup is handled by pre-creating connections in the pool
    // The pool's initializePool method handles this, so we just track state
    this.warmupState.isWarmingUp = false;
    this.warmupState.connectionsWarmed = this.config.warmupSize;

    this.logger.info('Connection warmup completed', {
      connectionsWarmed: this.warmupState.connectionsWarmed,
      duration: Date.now() - this.warmupState.warmupStartTime
    });
  }

  /**
   * Detect burst traffic patterns
   */
  private detectBurst(): boolean {
    if (!this.config.burstDetectionEnabled) return false;

    const now = Date.now();
    const recentMetrics = this.metricHistory.filter(
      m => m.timestamp >= now - TIME_WINDOWS.SHORT
    );

    if (recentMetrics.length < 3) return false;

    // Calculate baseline from medium-term history
    const mediumTermMetrics = this.metricHistory.filter(
      m => m.timestamp >= now - TIME_WINDOWS.MEDIUM && m.timestamp < now - TIME_WINDOWS.SHORT
    );

    if (mediumTermMetrics.length === 0) {
      // Not enough history for baseline, use recent average
      this.burstState.baselineConnections = recentMetrics.reduce(
        (sum, m) => sum + m.activeConnections, 0
      ) / recentMetrics.length;
    } else {
      this.burstState.baselineConnections = mediumTermMetrics.reduce(
        (sum, m) => sum + m.activeConnections, 0
      ) / mediumTermMetrics.length;
    }

    // Calculate current activity level
    const currentConnections = recentMetrics.reduce(
      (sum, m) => sum + m.activeConnections, 0
    ) / recentMetrics.length;

    // Check if current is significantly above baseline
    const percentageOfBaseline = this.burstState.baselineConnections > 0
      ? (currentConnections / this.burstState.baselineConnections) * 100
      : 100;

    const isBurst = percentageOfBaseline >= this.config.burstThreshold;

    if (isBurst && !this.burstState.isInBurst) {
      // Burst started
      this.burstState.isInBurst = true;
      this.burstState.burstStartTime = now;
      this.burstState.peakConnections = currentConnections;

      this.logger.info('Burst traffic detected', {
        baseline: this.burstState.baselineConnections,
        current: currentConnections,
        percentageOfBaseline
      });
    } else if (!isBurst && this.burstState.isInBurst) {
      // Burst ended
      this.burstState.isInBurst = false;
      this.burstState.burstEndTime = now;

      this.logger.info('Burst traffic ended', {
        duration: now - this.burstState.burstStartTime,
        peakConnections: this.burstState.peakConnections
      });
    } else if (isBurst) {
      // Update peak during burst
      this.burstState.peakConnections = Math.max(
        this.burstState.peakConnections,
        currentConnections
      );
    }

    return isBurst;
  }

  /**
   * Handle burst scaling
   */
  private handleBurstScaling(): boolean {
    if (!this.config.burstDetectionEnabled || !this.burstState.isInBurst) {
      return false;
    }

    const now = Date.now();

    // Check burst cooldown
    if (now - this.burstState.lastBurstScaling < this.config.burstCooldownPeriod) {
      return false;
    }

    // Calculate burst target size
    const burstTargetSize = Math.min(
      this.config.maxConnections,
      Math.ceil(connectionPool.clients.size * this.config.burstScaleFactor)
    );

    if (burstTargetSize > connectionPool.maxSize) {
      connectionPool.maxSize = burstTargetSize;
      this.burstState.lastBurstScaling = now;

      this.logger.info('Burst scaling applied', {
        newMaxSize: burstTargetSize,
        burstScaleFactor: this.config.burstScaleFactor,
        peakConnections: this.burstState.peakConnections
      });

      return true;
    }

    return false;
  }

  /**
   * Record a new metric data point
   */
  public recordMetrics(): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const dataPoint: MetricDataPoint = {
      timestamp: now,
      connectionCount: connectionPool.clients.size,
      activeConnections: connectionPool.inUse,
      acquireTime: connectionPool.usage.acquireTimeAvg,
      waitingAcquires: getWaitingAcquires()
    };

    // Add to metric history
    this.metricHistory.push(dataPoint);

    // Update usage patterns
    this.updateUsagePatterns(dataPoint);

    // Clean up old metrics
    const oldestToKeep = now - TIME_WINDOWS.LONG;
    this.metricHistory = this.metricHistory.filter(m => m.timestamp >= oldestToKeep);

    // Check for burst traffic
    const isBurst = this.detectBurst();

    // Handle burst scaling first (priority over regular scaling)
    if (isBurst) {
      const burstScaled = this.handleBurstScaling();
      if (burstScaled) return; // Skip regular scaling if burst scaling was applied
    }

    // Check if we should scale the pool (regular scaling)
    this.evaluatePoolScaling();
  }

  /**
   * Update usage patterns
   */
  private updateUsagePatterns(dataPoint: MetricDataPoint): void {
    if (!this.config.usagePatternDetection) return;

    const date = new Date(dataPoint.timestamp);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    // Update hourly pattern
    const hourPattern = this.usagePatterns.hourlyPatterns.get(hour) || {
      avgConnections: 0,
      samples: 0
    };

    // Update the moving average
    hourPattern.avgConnections = 
      (hourPattern.avgConnections * hourPattern.samples + dataPoint.activeConnections) / 
      (hourPattern.samples + 1);
    hourPattern.samples++;

    this.usagePatterns.hourlyPatterns.set(hour, hourPattern);

    // Update day of week pattern
    const dayPattern = this.usagePatterns.dayOfWeekPatterns.get(dayOfWeek) || {
      avgConnections: 0,
      samples: 0
    };

    // Update the moving average
    dayPattern.avgConnections = 
      (dayPattern.avgConnections * dayPattern.samples + dataPoint.activeConnections) / 
      (dayPattern.samples + 1);
    dayPattern.samples++;

    this.usagePatterns.dayOfWeekPatterns.set(dayOfWeek, dayPattern);
  }

  /**
   * Predict future connection needs
   */
  private predictFutureConnections(): number {
    // Get recent metrics for the prediction window
    const now = Date.now();
    const recentMetrics = this.metricHistory.filter(
      m => m.timestamp >= now - TIME_WINDOWS.MEDIUM
    );

    if (recentMetrics.length === 0) {
      return connectionPool.inUse; // No data for prediction, use current value
    }

    // Apply the selected prediction strategy
    switch (this.config.strategy) {
      case PredictionStrategy.MOVING_AVERAGE:
        return this.predictUsingMovingAverage(recentMetrics);
      
      case PredictionStrategy.EXPONENTIAL_SMOOTHING:
        return this.predictUsingExponentialSmoothing(recentMetrics);
      
      case PredictionStrategy.LINEAR_REGRESSION:
        return this.predictUsingLinearRegression(recentMetrics);
      
      case PredictionStrategy.USAGE_PATTERN:
        return this.predictUsingUsagePattern();
      
      default:
        return this.predictUsingMovingAverage(recentMetrics);
    }
  }

  /**
   * Predict using simple moving average
   */
  private predictUsingMovingAverage(metrics: MetricDataPoint[]): number {
    // Simple moving average of active connections
    const sum = metrics.reduce((total, m) => total + m.activeConnections, 0);
    const avg = sum / metrics.length;

    // Add a small buffer based on the variance
    const variance = metrics.reduce((total, m) => {
      const diff = m.activeConnections - avg;
      return total + (diff * diff);
    }, 0) / metrics.length;

    const stdDev = Math.sqrt(variance);
    
    // Predicted value is average plus buffer based on standard deviation
    // and aggressiveness factor
    return Math.round(avg + (stdDev * this.config.aggressiveness));
  }

  /**
   * Predict using exponential smoothing
   */
  private predictUsingExponentialSmoothing(metrics: MetricDataPoint[]): number {
    // Sort metrics by timestamp
    const sortedMetrics = [...metrics].sort((a, b) => a.timestamp - b.timestamp);
    
    // Alpha is smoothing factor (higher value gives more weight to recent observations)
    // Use aggressiveness to influence alpha
    const alpha = 0.3 + (this.config.aggressiveness * 0.4); // Range: 0.3-0.7
    
    // Initialize with first value
    let smoothedValue = sortedMetrics[0].activeConnections;
    
    // Apply exponential smoothing formula
    for (let i = 1; i < sortedMetrics.length; i++) {
      smoothedValue = alpha * sortedMetrics[i].activeConnections + (1 - alpha) * smoothedValue;
    }
    
    // Add trend component (simple trend based on last few points)
    const recentCount = Math.min(5, sortedMetrics.length);
    const recentMetrics = sortedMetrics.slice(-recentCount);
    
    if (recentMetrics.length >= 2) {
      const firstValue = recentMetrics[0].activeConnections;
      const lastValue = recentMetrics[recentMetrics.length - 1].activeConnections;
      const trend = (lastValue - firstValue) / (recentMetrics.length - 1);
      
      // Add trend with a dampening factor based on aggressiveness
      smoothedValue += trend * this.config.aggressiveness * 3;
    }
    
    return Math.round(Math.max(1, smoothedValue));
  }

  /**
   * Predict using linear regression
   */
  private predictUsingLinearRegression(metrics: MetricDataPoint[]): number {
    // Simple linear regression y = mx + b
    // where x is time and y is active connections
    
    // Convert timestamps to relative values (seconds from first point)
    const firstTimestamp = metrics[0].timestamp;
    const xValues = metrics.map(m => (m.timestamp - firstTimestamp) / 1000);
    const yValues = metrics.map(m => m.activeConnections);
    
    // Calculate mean of x and y
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / xValues.length;
    const yMean = yValues.reduce((sum, y) => sum + y, 0) / yValues.length;
    
    // Calculate slope (m) and y-intercept (b)
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < xValues.length; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) * (xValues[i] - xMean);
    }
    
    // Avoid division by zero
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - (slope * xMean);
    
    // Predict value at forecast window (in seconds)
    const forecastTime = (this.config.forecastWindow / 1000);
    const lastX = xValues[xValues.length - 1];
    const prediction = intercept + slope * (lastX + forecastTime);
    
    // Apply aggressiveness factor
    const adjustedPrediction = yMean + (prediction - yMean) * this.config.aggressiveness;
    
    return Math.round(Math.max(1, adjustedPrediction));
  }

  /**
   * Predict using time-based usage patterns
   */
  private predictUsingUsagePattern(): number {
    if (!this.config.usagePatternDetection) {
      return connectionPool.inUse;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const nextHour = (currentHour + 1) % 24;
    const dayOfWeek = now.getDay();
    
    // Get current hour pattern
    const currentHourPattern = this.usagePatterns.hourlyPatterns.get(currentHour);
    
    // Get next hour pattern for prediction
    const nextHourPattern = this.usagePatterns.hourlyPatterns.get(nextHour);
    
    // Get day of week pattern
    const dayPattern = this.usagePatterns.dayOfWeekPatterns.get(dayOfWeek);
    
    let prediction = connectionPool.inUse; // Default to current usage
    
    if (currentHourPattern && nextHourPattern) {
      // Weight between current and next hour based on minutes into the hour
      const minutesIntoHour = now.getMinutes() / 60;
      const hoursWeight = 0.7; // How much to weigh hourly patterns vs day patterns
      
      // Interpolate between current and next hour
      const hourlyPrediction = 
        currentHourPattern.avgConnections * (1 - minutesIntoHour) + 
        nextHourPattern.avgConnections * minutesIntoHour;
      
      if (dayPattern) {
        // Blend hourly prediction with day of week pattern
        prediction = (hourlyPrediction * hoursWeight) + 
                     (dayPattern.avgConnections * (1 - hoursWeight));
      } else {
        prediction = hourlyPrediction;
      }
    } else if (currentHourPattern) {
      prediction = currentHourPattern.avgConnections;
    } else if (dayPattern) {
      prediction = dayPattern.avgConnections;
    }
    
    // Add buffer based on aggressiveness
    prediction *= (1 + (this.config.aggressiveness * 0.2));
    
    return Math.round(Math.max(1, prediction));
  }

  /**
   * Evaluate if pool scaling is needed
   */
  private evaluatePoolScaling(): void {
    if (!this.config.enabled) return;
    
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.usagePatterns.lastScalingAction < this.config.cooldownPeriod) {
      return;
    }
    
    // Calculate current utilization
    const currentSize = connectionPool.clients.size;
    const activeConnections = connectionPool.inUse;
    const utilization = currentSize > 0 ? (activeConnections / currentSize) * 100 : 0;
    
    // Get predicted connections
    const predictedConnections = this.predictFutureConnections();
    
    // Determine if scaling is needed
    let newSize = currentSize;
    let scalingAction: string | null = null;
    
    if (utilization >= this.config.scaleUpThreshold) {
      // Scale up needed
      newSize = Math.min(
        this.config.maxConnections,
        Math.ceil(currentSize * this.config.scaleUpFactor)
      );
      scalingAction = 'scale_up';
    } else if (utilization <= this.config.scaleDownThreshold && 
              currentSize > this.config.minConnections) {
      // Scale down needed, but ensure we have enough capacity for predicted connections
      const predictedSize = Math.ceil(predictedConnections * 1.2); // 20% buffer
      newSize = Math.max(
        this.config.minConnections,
        Math.min(
          predictedSize,
          Math.floor(currentSize * this.config.scaleDownFactor)
        )
      );
      scalingAction = 'scale_down';
    }
    
    // Apply scaling if needed
    if (newSize !== currentSize && scalingAction) {
      this.applyPoolScaling(newSize, scalingAction);
      this.usagePatterns.lastScalingAction = now;
    }
  }

  /**
   * Apply pool scaling
   */
  private applyPoolScaling(newSize: number, action: string): void {
    // Update pool configuration
    connectionPool.maxSize = newSize;

    this.logger.info(`Predictive scaling applied: ${action}`, {
      oldSize: connectionPool.clients.size,
      newMaxSize: newSize,
      strategy: this.config.strategy,
      predictedConnections: this.predictFutureConnections(),
      activeConnections: connectionPool.inUse
    });
  }

  /**
   * Get current prediction metrics
   */
  public getPredictionMetrics() {
    const predictedConnections = this.predictFutureConnections();
    const currentConnections = connectionPool.inUse;

    return {
      enabled: this.config.enabled,
      strategy: this.config.strategy,
      currentConnections,
      predictedConnections,
      poolSize: connectionPool.clients.size,
      maxPoolSize: connectionPool.maxSize,
      lastScalingAction: this.usagePatterns.lastScalingAction,
      usagePatterns: {
        hourlyPatterns: Array.from(this.usagePatterns.hourlyPatterns.entries())
          .map(([hour, data]) => ({
            hour,
            avgConnections: data.avgConnections,
            samples: data.samples
          })),
        dayOfWeekPatterns: Array.from(this.usagePatterns.dayOfWeekPatterns.entries())
          .map(([day, data]) => ({
            day,
            avgConnections: data.avgConnections,
            samples: data.samples
          }))
      },
      burstState: {
        isInBurst: this.burstState.isInBurst,
        baselineConnections: this.burstState.baselineConnections,
        peakConnections: this.burstState.peakConnections,
        burstDuration: this.burstState.isInBurst
          ? Date.now() - this.burstState.burstStartTime
          : 0
      },
      warmupState: {
        connectionsWarmed: this.warmupState.connectionsWarmed,
        targetConnections: this.warmupState.targetConnections
      }
    };
  }

  /**
   * Get burst state for external monitoring
   */
  public getBurstState(): BurstState {
    return { ...this.burstState };
  }

  /**
   * Get warmup state for external monitoring
   */
  public getWarmupState(): WarmupState {
    return { ...this.warmupState };
  }

  /**
   * Trigger manual warmup (useful for scheduled warmup before known traffic spikes)
   */
  public triggerWarmup(targetConnections?: number): void {
    const target = targetConnections || this.config.warmupSize;
    this.warmupState = {
      isWarmingUp: true,
      warmupStartTime: Date.now(),
      connectionsWarmed: 0,
      targetConnections: target
    };

    this.logger.info('Manual warmup triggered', { targetConnections: target });

    // Update pool min size temporarily to trigger warmup
    const currentMinSize = connectionPool.minSize;
    if (target > currentMinSize) {
      connectionPool.minSize = target;

      // Reset after warmup period
      setTimeout(() => {
        connectionPool.minSize = currentMinSize;
        this.warmupState.isWarmingUp = false;
        this.warmupState.connectionsWarmed = target;

        this.logger.info('Manual warmup completed', {
          connectionsWarmed: target,
          duration: Date.now() - this.warmupState.warmupStartTime
        });
      }, 5000); // 5 seconds to allow connections to be created
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PredictiveScalingConfig>): void {
    this.config = { ...this.config, ...newConfig };

    this.logger.info('Predictive scaling configuration updated', {
      enabled: this.config.enabled,
      strategy: this.config.strategy,
      minConnections: this.config.minConnections,
      maxConnections: this.config.maxConnections
    });
  }
}

// Create singleton instance
const predictiveScaler = new PredictiveScaler();

// Register periodic metric collection
const METRIC_COLLECTION_INTERVAL = 30 * 1000; // 30 seconds
setInterval(() => {
  predictiveScaler.recordMetrics();
}, METRIC_COLLECTION_INTERVAL);

export default predictiveScaler;